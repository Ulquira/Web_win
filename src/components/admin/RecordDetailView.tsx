import React, { useState } from 'react';
import { formatTipoServicioLabel } from '../../lib/utils';
import { 
  User, 
  MapPin, 
  Calendar, 
  Users, 
  Layers, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Navigation,
  Phone, 
  Mail, 
  Shield,
  Building2,
  FileText
} from 'lucide-react';

interface RecordDetailViewProps {
  row: Record<string, any>;
  activeTab?: string;
  formatDate: (val: any) => string;
  formatDateOnly: (val: any) => string;
}

export const RecordDetailView: React.FC<RecordDetailViewProps> = ({
  row,
  formatDate,
  formatDateOnly
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'resumen' | 'todos'>('resumen');

  const copyToClipboard = (text: string, keyName: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const tokenVal = row.token || row.token_tracking;
  const trackingLink = row.link_tracking || (tokenVal ? `https://enruta.win.pe/seguimiento/${tokenVal}` : null);
  const pinVal = row.Pin_token || row.pin;
  const ordenId = row.OrdenId || row.orden_id || row.id;
  const tipoServicio = row.TipoServicioCalculado || row.tipo_operacion || row.TipoTraba || '-';
  const estadoOt = row.Estado || row.estado_ot || row['Estado OT'] || '-';

  // Filtrado de metadatos completos para la pestaña técnica
  const allEntries = Object.entries(row).filter(([k]) => {
    if (k === 'ultimos_mensajes_json') return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const valStr = String(row[k] ?? '').toLowerCase();
    return k.toLowerCase().includes(term) || valStr.includes(term);
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3.5">
      {/* 1. BARRA SUPERIOR CON ACCIONES CLAVE */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-md backdrop-blur flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Orden ID */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400">OT:</span>
            <span className="font-mono font-bold text-white text-sm">{ordenId}</span>
            <button
              onClick={() => copyToClipboard(String(ordenId), 'hero-ot')}
              className="text-slate-400 hover:text-orange-400 transition-colors p-0.5"
              title="Copiar Orden ID"
            >
              {copiedKey === 'hero-ot' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Tipo de Servicio */}
          {(() => {
            const display = formatTipoServicioLabel(tipoServicio);
            const isInstaLima = display === 'INSTA - LIMA' || tipoServicio === 'INSTALACION';
            const isInstaProv = display === 'INSTA - PROV' || tipoServicio === 'PROVINCIA';
            const isAverLima = display === 'AVER - LIMA' || tipoServicio === 'AVERIAS';
            const isAverProv = display === 'AVER - PROV' || tipoServicio === 'AVERIAS PRV';
            const isPost = display === 'POSTVENTA';

            return (
              <span className={`px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wide inline-flex items-center gap-1.5 border shadow-sm ${
                isInstaLima 
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : isAverLima || isAverProv
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : isPost
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : isInstaProv
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {display}
              </span>
            );
          })()}

          {/* Estado OT */}
          <span className="px-3 py-1 rounded-full font-semibold text-xs inline-flex items-center gap-1.5 bg-slate-900 text-slate-200 border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${
              estadoOt === 'Iniciada' || estadoOt === 'Completada' ? 'bg-emerald-400' :
              estadoOt === 'Agendada' ? 'bg-sky-400' :
              estadoOt === 'Cancelada' ? 'bg-rose-400' : 'bg-amber-400'
            }`} />
            {estadoOt}
          </span>

          {/* Fecha Visita */}
          {(row.FechaVisita || row['F.Visita'] || row.fecha_visita) && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 font-mono text-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatDateOnly(row.FechaVisita || row['F.Visita'] || row.fecha_visita)}</span>
            </div>
          )}

          {/* PIN */}
          {pinVal && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>PIN: {pinVal}</span>
            </div>
          )}
        </div>

        {/* Tracking Link directo */}
        {trackingLink && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(trackingLink, 'hero-tracking')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-all border border-slate-700 shadow-sm"
              title="Copiar Enlace de Seguimiento"
            >
              {copiedKey === 'hero-tracking' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'hero-tracking' ? 'Copiado' : 'Copiar Link'}</span>
            </button>
            <a
              href={trackingLink}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Abrir Seguimiento</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Selector de Vista: Cuadrícula Resumida vs Todos los Campos */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('resumen')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'resumen'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Vista Principal
          </button>
          <button
            onClick={() => setActiveSubTab('todos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'todos'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todos los Metadatos ({Object.keys(row).length})
          </button>
        </div>

        {activeSubTab === 'todos' && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar campo o valor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-1 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL: DISEÑO 2x2 CUADRADO MODERNO */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 min-h-0">
        {activeSubTab === 'resumen' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
            {/* PANEL 1: CLIENTE & CONTACTO */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                      <User className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cliente & Contacto</h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    {row.Tipo || row.tipo_cliente || 'Residencial'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Nombre / Razón Social</span>
                    <div className="font-bold text-white text-base mt-0.5 leading-snug">
                      {row.Cliente || row.ClienteFinal || row.cliente || row.cliente_nombre || '-'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Documento</span>
                      <span className="font-mono text-slate-200 font-bold text-sm">
                        {row.NumeroDocumento || row['Número Documento'] || row.documento || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Móvil / WhatsApp</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {row.TeleMovilNume || row.telefono || row.phone || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {row.Email && (
                <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40">
                  <Mail className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <span className="truncate select-all" title={row.Email}>{row.Email}</span>
                </div>
              )}
            </div>

            {/* PANEL 2: DIRECCIÓN & ZONA */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Dirección & Zona</h4>
                  </div>
                  {row['Sector Operativo'] && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {row['Sector Operativo']}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Dirección de Instalación</span>
                    <div className="font-medium text-slate-100 mt-1 text-xs leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/70 select-all">
                      {row.Direccion || row.direccion || '-'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Distrito / Zona</span>
                      <span className="font-bold text-cyan-300 text-sm">
                        {row.Zona || row.distrito || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Provincia</span>
                      <span className="text-slate-200 font-semibold text-sm">
                        {row.Provincia || row.provincia || row.Localidad || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {row.Georeferencia && (
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Coordenadas:</span>
                  <span className="text-slate-300 select-all">{row.Georeferencia}</span>
                </div>
              )}
            </div>

            {/* PANEL 3: CUADRILLA & OPERACIÓN (LIMPIO, SIN TÉCNICO NI ASIGNADO POR) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                      <Users className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cuadrilla Asignada</h4>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{formatDateOnly(row.FechaVisita || row['F.Visita'] || row.fecha_visita)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Cuadrilla Completa</span>
                    <div className="font-bold text-amber-300 text-sm mt-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/70 select-all">
                      {row.Cuadrilla || row.cuadrilla || '-'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Contratista / Empresa</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-200 font-bold text-xs truncate">
                          {row.Proveedeor || row.Empresa || '-'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Fecha Solicitud</span>
                      <span className="font-mono text-slate-300 text-xs">
                        {formatDate(row['F.Soli'] || row.fecha_solicitud)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PANEL 4: SERVICIO & DETALLES */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Servicio & Detalles</h4>
                  </div>
                  {row.ticket && (
                    <div className="flex items-center gap-1 font-mono text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700">
                      <FileText className="w-3 h-3 text-orange-400" />
                      <span>{row.ticket}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Producto Contratado</span>
                    <div className="font-bold text-white text-sm mt-0.5">
                      {row.Producto || row.producto || '-'}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Tipo Trabajo</span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-bold">
                        {row.TipoTraba || row.tipo_trabajo || '-'}
                      </span>
                    </div>
                  </div>

                  {(row['Motivo Trabajo'] || row.motivo_trabajo || row.Motivo) && (
                    <div className="pt-2 border-t border-slate-800/60">
                      <span className="text-[10px] text-slate-400 uppercase block font-semibold">Motivo Trabajo</span>
                      <p className="text-slate-300 text-xs leading-relaxed mt-0.5">
                        {row['Motivo Trabajo'] || row.motivo_trabajo || row.Motivo}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* METADATOS TÉCNICOS EN CUADRÍCULA COMPACTA */
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {allEntries.map(([k, v]) => (
                <div 
                  key={k} 
                  className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/70 hover:border-slate-700 transition-colors flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-orange-400/90">
                    <span className="font-semibold truncate max-w-[200px]" title={k}>{k}</span>
                    <button
                      onClick={() => copyToClipboard(String(v ?? ''), k)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-orange-400 transition-all p-0.5"
                      title="Copiar valor"
                    >
                      {copiedKey === k ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="text-xs text-slate-200 font-mono break-all mt-1 select-all">
                    {v === null || v === undefined || v === '' ? (
                      <span className="text-slate-600 italic">null</span>
                    ) : typeof v === 'object' ? (
                      <pre className="text-[10px] bg-slate-950 p-1.5 rounded text-emerald-400 overflow-x-auto max-h-24 font-mono">
                        {JSON.stringify(v, null, 2)}
                      </pre>
                    ) : k.toLowerCase().includes('fecha') || k === 'F.Visita' || k === 'F.Soli' ? (
                      formatDate(v)
                    ) : (
                      String(v)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
