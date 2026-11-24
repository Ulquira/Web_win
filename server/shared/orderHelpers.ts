export const LINK_EXPIRATION_SECONDS = 72 * 60 * 60; // 72 horas

const CLOSED_ESTADOS = [
  'ANULADA',
  'REGESTION',
  'CANCELADA',
  'REVISIÓN',
  'REVISION',
  'AUSENTE',
  'CANCELADO',
  'DULPLICADO',
  'INASISTENCIA',
  'PEXT',
  'REPROGRAMA'
];

export function isOrderExpired(segundosDesdeSoli: any): boolean {
  return (
    segundosDesdeSoli !== null &&
    segundosDesdeSoli !== undefined &&
    Number(segundosDesdeSoli) > LINK_EXPIRATION_SECONDS
  );
}

export function mapEstadoToStatusFront(estadoRaw?: string | null): string {
  const estadoDB = (estadoRaw || '').toUpperCase().trim();
  if (estadoDB === 'PENDIENTE') return 'programada';
  if (estadoDB === 'AGENDADA' || estadoDB === 'PROGRAMADO') return 'asignado';
  if (estadoDB === 'EN CAMINO') return 'en_camino';
  if (estadoDB === 'INICIADA' || estadoDB === 'EN PROCESO') return 'en_proceso';
  if (estadoDB === 'FINALIZADA' || estadoDB === 'FINALIZADO') return 'finalizada';
  if (CLOSED_ESTADOS.includes(estadoDB)) return 'cerrada';
  return 'programada';
}

export function parseCoordinates(raw?: string | null): [number, number] | null {
  if (!raw) return null;
  try {
    const str = String(raw).replace(/\s/g, '');
    const match = str.match(/(-?\d+\.\d+)(-?\d+\.\d+)/);
    if (match) return [parseFloat(match[1]), parseFloat(match[2])];
    const parts = str.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
  } catch {
    return null;
  }
  return null;
}

export function isFotoAprobadaFlag(flag: any): boolean {
  return Boolean(
    flag === 1 ||
    flag === '1' ||
    flag === true ||
    String(flag || '').trim().toLowerCase() === 'yes' ||
    String(flag || '').trim().toLowerCase() === 'true'
  );
}

export function parseValidImage(imgCandidate?: string | null): string | null {
  if (!imgCandidate) return null;
  const clean = String(imgCandidate).trim();
  if (clean.startsWith('data:image/')) return clean;
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  if (clean.startsWith('/9j/') || clean.startsWith('iVBORw0KGgo')) return `data:image/jpeg;base64,${clean}`;
  return null;
}

export function maskDni(dni?: string | null): string | null {
  if (!dni) return null;
  const clean = String(dni).trim();
  if (clean.length <= 4) return clean;
  return '****' + clean.slice(4);
}

export function classifyOrderType(op: {
  tipo_servicio?: string | null;
  producto?: string | null;
  tipo_trabajo?: string | null;
  codisegui?: any;
  codiseguiclien?: any;
}): { isPostventa: boolean; isTicket: boolean } {
  const tipoServicioUpper = (op.tipo_servicio || '').toUpperCase().trim();
  const productoUpper = (op.producto || '').toUpperCase().trim();
  const tipoTrabajoUpper = (op.tipo_trabajo || '').toUpperCase().trim();
  const codiSeguiUpper = String(op.codisegui || '').toUpperCase().trim();
  const codiSeguiClienUpper = String(op.codiseguiclien || '').toUpperCase().trim();

  const isPostventa = tipoServicioUpper === 'POSTVENTA' || productoUpper.includes('POSTVENTA');
  const isTicket =
    tipoServicioUpper === 'AVERIAS' ||
    tipoServicioUpper.includes('POST') ||
    productoUpper.includes('AVERIA') ||
    productoUpper.includes('POST') ||
    productoUpper === 'MOTOWIN' ||
    /^[A-Z]/.test(codiSeguiUpper) ||
    /^[A-Z]/.test(codiSeguiClienUpper) ||
    (tipoTrabajoUpper !== '' && tipoTrabajoUpper !== 'INSTALACION' && !tipoTrabajoUpper.includes('INSTALA'));

  return { isPostventa, isTicket };
}

export function buildMiWinVisitasPayload(activeList: any[]) {
  const casesMap = new Map<string, any>();
  for (const item of activeList) {
    const caseKey = item.codisegui || item.codiseguiclien || `ord_${item.idoperacion}`;
    if (!casesMap.has(caseKey)) {
      casesMap.set(caseKey, item);
    }
  }

  const uniqueCases = Array.from(casesMap.values());
  const clienteNombre = activeList[0].nom_cliente || 'Cliente';

  const visitas = uniqueCases.map((op: any) => {
    const tipoServicioUpper = (op.tipo_servicio || '').toUpperCase().trim();
    const productoUpper = (op.producto || '').toUpperCase().trim();
    const isTicket = tipoServicioUpper === 'AVERIAS' || productoUpper.includes('AVERIA') || productoUpper === 'MOTOWIN';
    const statusFront = mapEstadoToStatusFront(op.Estado);

    let titulo = isTicket ? 'Avería' : 'Instalación';
    if (productoUpper.includes('MOTO')) titulo = 'Avería Motowin';
    else if (productoUpper.includes('PLANTA EXTERNA')) titulo = 'Avería Planta Externa';

    const ticketLabel = op.codisegui ? `Ticket: ${op.codisegui}` : (isTicket ? `Ticket: ${op.idoperacion}` : 'Instalación');

    return {
      idoperacion: op.idoperacion,
      token: op.token,
      pin_token: op.Pin_token || null,
      tipo: isTicket ? 'ticket' : 'instalacion',
      titulo,
      ticketLabel,
      codisegui: op.codisegui || null,
      producto: op.producto || (isTicket ? 'Visita Técnica' : 'Instalación Fibra'),
      campana: op.campana || null,
      direccion: op.direccion || 'Dirección registrada',
      estado: statusFront,
      estado_raw: op.Estado,
      fecha: op.fecha_programacion,
      tramo: op.tramo
    };
  });

  return {
    success: true,
    count: visitas.length,
    cliente_nombre: clienteNombre,
    visitas
  };
}
