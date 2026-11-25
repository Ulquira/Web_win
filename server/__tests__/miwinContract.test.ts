import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpaqueToken,
  decodeOpaqueToken,
  isOpaqueTokenExpired,
  LINK_EXPIRATION_MS
} from '../opaqueToken.ts';
import {
  buildMiWinVisitasPayload,
  shouldExposePinToClient,
  isPrefixedTicketCode,
  generateSecureFourDigitPin,
  safeTimingEqual
} from '../shared/orderHelpers.ts';
import { BoundedTtlCache } from '../shared/ttlCache.ts';

test('MiWIN OpaqueToken: round-trips DNI and preserves 72h validity', () => {
  const dni = '72345678';
  const token = createOpaqueToken(dni);
  assert.ok(token.length >= 28, 'Token must be URL-safe base64 >= 28 chars');

  const decoded = decodeOpaqueToken(token);
  assert.ok(decoded, 'Valid token must decode');
  assert.equal(decoded.documento, dni);
  assert.equal(isOpaqueTokenExpired(decoded.timestamp), false);
});

test('MiWIN OpaqueToken: rejects tampered tokens and expired timestamps', () => {
  const token = createOpaqueToken('44556677');
  const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
  assert.equal(decodeOpaqueToken(tampered), null);
  assert.equal(decodeOpaqueToken(''), null);
  assert.equal(decodeOpaqueToken('short'), null);

  const expiredTs = Date.now() - LINK_EXPIRATION_MS - 1000;
  assert.equal(isOpaqueTokenExpired(expiredTs), true);
});

test('MiWIN OpaqueToken: supports seamless dual-key rotation without breaking active 72h links', () => {
  const oldSecret = 'legacy-miwin-secret-v1';
  const newSecret = 'rotated-miwin-secret-v2';
  const legacyLinkToken = createOpaqueToken('12345678', oldSecret);

  const decodedDuringRotation = decodeOpaqueToken(legacyLinkToken, [newSecret, oldSecret]);
  assert.ok(decodedDuringRotation);
  assert.equal(decodedDuringRotation.documento, '12345678');
});

test('MiWIN Payload Contract: preserves exact response shape, deduplicates cases, and redacts PIN unless en_camino', () => {
  const rows = [
    {
      idoperacion: 3561769,
      Estado: 'AGENDADA',
      token: '289764bbf041c03350c5709c163871',
      Pin_token: '4221',
      codisegui: 'VTEXT-49233233',
      codiseguiclien: null,
      producto: 'AVERIA FTTH',
      campana: 'Paquete: Mono 200 Mbps',
      direccion: 'Av. Javier Prado 1234',
      fecha_programacion: '2026-11-25',
      tramo: '08:00:00',
      nom_cliente: 'JUAN PEREZ',
      tipo_servicio: 'AVERIAS'
    },
    // Older row of same case (should be deduplicated)
    {
      idoperacion: 3561000,
      Estado: 'REGESTION',
      token: 'oldtoken0000000000000000000000',
      Pin_token: '4221',
      codisegui: 'VTEXT-49233233',
      codiseguiclien: null,
      producto: 'AVERIA FTTH',
      campana: 'Paquete: Mono 200 Mbps',
      direccion: 'Av. Javier Prado 1234',
      fecha_programacion: '2026-11-24',
      tramo: '12:00:00',
      nom_cliente: 'JUAN PEREZ',
      tipo_servicio: 'AVERIAS'
    },
    // Second service in en_camino state (must expose pin_token for technician arrival overlay)
    {
      idoperacion: 3446646,
      Estado: 'EN CAMINO',
      token: 'd2d22fce47e31bdbbb1ed980441390',
      Pin_token: '4204',
      codisegui: null,
      codiseguiclien: '3164556',
      producto: 'FTTH RESIDENCIAL',
      campana: 'Paquete: Duo 500 Mbps',
      direccion: 'Calle Los Pinos 456',
      fecha_programacion: '2026-11-25',
      tramo: '12:00:00',
      nom_cliente: 'JUAN PEREZ',
      tipo_servicio: 'INSTALACION'
    }
  ];

  const payload = buildMiWinVisitasPayload(rows);
  assert.equal(payload.success, true);
  assert.equal(payload.count, 2);
  assert.equal(payload.cliente_nombre, 'JUAN PEREZ');
  assert.equal(payload.visitas.length, 2);

  // First item: AGENDADA -> asignado -> pin_token hidden (null)
  assert.equal(payload.visitas[0].token, '289764bbf041c03350c5709c163871');
  assert.equal(payload.visitas[0].estado, 'asignado');
  assert.equal(payload.visitas[0].tipo, 'ticket');
  assert.equal(payload.visitas[0].pin_token, null);

  // Second item: EN CAMINO -> en_camino -> pin_token exposed ('4204')
  assert.equal(payload.visitas[1].token, 'd2d22fce47e31bdbbb1ed980441390');
  assert.equal(payload.visitas[1].estado, 'en_camino');
  assert.equal(payload.visitas[1].tipo, 'instalacion');
  assert.equal(payload.visitas[1].pin_token, '4204');
});

test('Security Helpers: PIN redaction, IDOR ticket filter, CSPRNG PIN, and timing-safe compare', () => {
  assert.equal(shouldExposePinToClient('programada'), false);
  assert.equal(shouldExposePinToClient('asignado'), false);
  assert.equal(shouldExposePinToClient('en_camino'), true);
  assert.equal(shouldExposePinToClient('finalizada'), false);

  // Blocks sequential numeric OrdenId while permitting prefixed ticket codes
  assert.equal(isPrefixedTicketCode('3561769'), false);
  assert.equal(isPrefixedTicketCode('3164556'), false);
  assert.equal(isPrefixedTicketCode('VTEXT-49233233'), true);
  assert.equal(isPrefixedTicketCode('AT-49264239'), true);

  for (let i = 0; i < 20; i++) {
    const pin = generateSecureFourDigitPin();
    assert.match(pin, /^[1-9]\d{3}$/);
  }

  assert.equal(safeTimingEqual('M1w1n4pp_secret', 'M1w1n4pp_secret'), true);
  assert.equal(safeTimingEqual('M1w1n4pp_secret', 'M1w1n4pp_wrong'), false);
  assert.equal(safeTimingEqual('short', 'longer_string'), false);
});

test('BoundedTtlCache: enforces maxEntries eviction and TTL expiration', async () => {
  const cache = new BoundedTtlCache<string>(2, 60_000);
  cache.set('a', '1', 5000);
  cache.set('b', '2', 5000);
  // Access 'a' so 'b' becomes oldest
  assert.equal(cache.get('a'), '1');
  cache.set('c', '3', 5000);

  assert.equal(cache.size, 2);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), '1');
  assert.equal(cache.get('c'), '3');

  cache.set('short', 'ttl', 15);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(cache.get('short'), undefined);
});
