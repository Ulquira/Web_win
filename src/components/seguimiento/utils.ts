export const LINK_EXPIRATION_MS = 72 * 60 * 60 * 1000;

export const parseSafeDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const [year, month, day] = match[1].split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

export const isOrderExpired72h = (fechaStr?: string, tramoStr?: string): boolean => {
  if (!fechaStr) return false;
  const dateMatch = String(fechaStr).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return false;
  const timeMatch = String(tramoStr || '').match(/^(\d{2}:\d{2}(?::\d{2})?)/);
  const timePart = timeMatch
    ? (timeMatch[1].length === 5 ? `${timeMatch[1]}:00` : timeMatch[1])
    : '23:59:59';
  const orderMs = Date.parse(`${dateMatch[1]}T${timePart}-05:00`);
  if (isNaN(orderMs)) return false;
  return Date.now() - orderMs > LINK_EXPIRATION_MS;
};

export const formatTramoToRange = (tramoStr?: string) => {
  if (!tramoStr) return 'De 8:00 am. a 12:00 pm';

  const t = tramoStr.toLowerCase().trim();
  if (t.startsWith('08') || t.startsWith('8')) return 'De 8:00 am. a 12:00 pm';
  if (t.startsWith('12')) return 'De 12:00 pm. a 4:00 pm';
  if (t.startsWith('16') || t.startsWith('4')) return 'De 4:00 pm. a 8:00 pm';

  if (tramoStr.includes('-') || tramoStr.toLowerCase().includes(' a ')) return tramoStr;

  return tramoStr;
};

export const parsePlanData = (campana?: string) => {
  if (!campana) return { paquete: '', svas: [] as string[], tienePromoAumento: false };
  if (!campana.includes('|')) return { paquete: '', svas: [] as string[], tienePromoAumento: false };

  const parts = campana.split('|');
  let paquete = '';
  let rawSvas: string[] = [];
  let cantidadMesh = 0;
  let instalacionMesh = false;

  parts.forEach(part => {
    const [key, ...valueParts] = part.split(':');
    if (!key || valueParts.length === 0) return;
    const value = valueParts.join(':').trim();
    const cleanKey = key.trim().toLowerCase();

    if (cleanKey === 'paquete') {
      paquete = value;
    } else if (cleanKey === "sva's" || cleanKey === "svas") {
      rawSvas = value.split('+')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !/^(ninguno|no|n\/a|na|no aplica|-|0|null|sin\s*sva|sin\s*sva's)$/i.test(s));
    } else if (cleanKey === 'cantidad de mesh') {
      const match = value.match(/\d+/);
      if (match) cantidadMesh = parseInt(match[0], 10);
    } else if (cleanKey === 'instalacion de mesh' || cleanKey === 'instalación de mesh') {
      const match = value.match(/\d+/);
      if (match && parseInt(match[0], 10) > 0) instalacionMesh = true;
      else if (/^(si|sí|true)/i.test(value)) instalacionMesh = true;
    }
  });

  const finalSvas: string[] = [];
  let meshAgregado = false;

  rawSvas.forEach(s => {
    let text = s;
    text = text.replace(/\(?\s*en\s+(comodato|alquiler|venta)\s*\)?/gi, '');
    text = text.replace(/\(?\s*\b(comodato|alquiler|venta)\b\s*\)?/gi, '');
    text = text.trim();

    const esItemMesh = /mesh/i.test(text);
    const esServicioCableado = /servicio\s+cableado/i.test(text);

    if (esItemMesh) {
      if (esServicioCableado) instalacionMesh = true;
      if (!meshAgregado) {
        meshAgregado = true;
        let meshText = cantidadMesh > 0 ? `${cantidadMesh} Mesh` : 'Mesh';
        if (instalacionMesh) {
          meshText += ' + Instalación Cableada';
        }
        finalSvas.push(meshText);
      }
    } else if (text.length > 0) {
      finalSvas.push(text);
    }
  });

  if (cantidadMesh > 0 && !meshAgregado) {
    let meshText = `${cantidadMesh} Mesh`;
    if (instalacionMesh) meshText += ' + Instalación Cableada';
    finalSvas.push(meshText);
  }

  const uniqueSvas = Array.from(new Set(finalSvas));

  let tienePromoAumento = false;
  if (campana) {
    const matchAumento = campana.match(/aumento\s+de\s+velocidad\s*:?([^|]+)/i);
    if (matchAumento) {
      const val = matchAumento[1].trim();
      if (!/no\s*aplica/i.test(val) && val.length > 0) {
        tienePromoAumento = true;
      }
    }
    if (!tienePromoAumento && /duplica\s*(?:por|x)?\s*\d+\s*(?:meses|mes|m)/i.test(campana)) {
      tienePromoAumento = true;
    }
  }

  return { paquete, svas: uniqueSvas, tienePromoAumento };
};

export const toTitleCase = (text?: string) => {
  if (!text) return '';
  return text.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};

export const cleanCommercialTags = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/\(?\s*(?:en\s+)?(comodato|alquiler|venta)\s*\)?/gi, '')
    .replace(/\(?\s*(?:al\s+)?(contado|credito|crédito)\s*\)?/gi, '')
    .replace(/\(?\s*(?:en\s+)?(cuotas|financiado)\s*\)?/gi, '')
    .replace(/\(?\s*(promo|promoción|promocion)\s*\)?/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const formatSvaName = (text?: string) => {
  if (!text) return '';
  const cleanText = cleanCommercialTags(text);
  if (!cleanText) return '';
  const specialWords: Record<string, string> = {
    'win': 'Win',
    'fono': 'Fono',
    'dgo': 'Dgo',
    'tv': 'TV',
    'ont': 'ONT',
    'ap': 'AP',
    'ip': 'IP',
    'vpn': 'VPN',
    'wifi': 'Wifi',
    'wi-fi': 'Wi-Fi',
    'mesh': 'Mesh',
    'kit': 'Kit',
    'pro': 'Pro',
    'plus': 'Plus',
    'full': 'Full',
    'de': 'de',
    'en': 'en',
    'instalación': 'Instalación',
    'instalacion': 'Instalación',
    'cableada': 'Cableada',
    'cableado': 'Cableado',
    'utp': 'UTP',
    'entrega': 'Entrega'
  };

  return cleanText
    .trim()
    .split(' ')
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (specialWords[lower]) {
        if (idx === 0) {
          const w = specialWords[lower];
          return w.charAt(0).toUpperCase() + w.slice(1);
        }
        return specialWords[lower];
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

export const formatPostventaServices = (rawText?: string): string[] => {
  if (!rawText) return ['Atención Postventa'];
  let clean = cleanCommercialTags(rawText);
  if (!clean) return ['Atención Postventa'];

  clean = clean.replace(/\bpendiente\s+de\s+/gi, '');
  clean = clean.replace(/\bentrega\s+mesh\b/gi, 'Entrega de Mesh');

  const hasMesh = /mesh/i.test(clean);
  const hasCableado = /cablead|instalaci[oó]n\s*cableada/i.test(clean);

  if (hasMesh && hasCableado) {
    const match = clean.match(/(\d+)\s*mesh/i);
    const count = match ? parseInt(match[1], 10) : '';
    const meshLabel = count ? `${count} Mesh + Instalación Cableada` : 'Mesh + Instalación Cableada';

    const others = clean
      .split('+')
      .map(p => p.trim())
      .filter(p => p.length > 0 && !/mesh/i.test(p) && !/cablead/i.test(p));

    return [meshLabel, ...others.map(formatSvaName)];
  }

  if (clean.includes('+') || clean.includes('/')) {
    return clean
      .split(/[+/]/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(formatSvaName);
  }

  return [formatSvaName(clean)];
};

export const formatMaskedDni = (dni?: string) => {
  if (!dni) return '';
  const clean = dni.trim();
  if (clean.length <= 4) return clean;
  if (clean.startsWith('****')) return clean;
  return '****' + clean.slice(4);
};

export const extractTechnicianName = (nombre?: string, _cuadrilla?: string) => {
  if (nombre && nombre.trim() && nombre !== "Técnico Asignado") {
    return toTitleCase(nombre.trim());
  }
  return "Técnico Asignado";
};

export const formatAddress = (address?: string) => {
  if (!address) return 'Cargando...';
  let clean = address;

  clean = clean.split(/\|\|\s*referencia/i)[0];
  clean = clean.split(/\|\s*referencia/i)[0];
  clean = clean.split(/\breferencia\s*:/i)[0];

  clean = clean.replace(/PISO\s*-?\s*$/i, '').replace(/DPTO\/INTERIOR\s*-?\s*$/i, '').trim();
  clean = clean.replace(/[\|,\s-]+$/, '').trim();
  return toTitleCase(clean);
};
