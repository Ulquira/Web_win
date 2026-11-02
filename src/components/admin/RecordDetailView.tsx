import React, { useState } from 'react';
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
  Shield 
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
      {/* 1. HERO BAR: Resumen Ejecutivo Superior */}
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
          <span className={`px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wide inline-flex items-center gap-1.5 border shadow-sm ${
            tipoServicio === 'INSTALACION' 
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : tipoServicio.includes('AVERIAS')
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              : tipoServicio === 'POSTVENTA'
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
              : tipoServicio === 'PROVINCIA'
              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {tipoServicio}
          </span>

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

      {/* Selector de Vista: Resumen Organizado vs Todos los Metadatos */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('resumen')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'resumen'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Vista Organizada por Bloques
          </button>
          <button
            onClick={() => setActiveSubTab('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'todos'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todos los Campos ({Object.keys(row).length})
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

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 min-h-0">
        {activeSubTab === 'resumen' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {/* BLOQUE 1: DATOS DEL CLIENTE */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                  <User className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cliente & Contacto</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Nombre / Razón Social</span>
                  <div className="font-bold text-slate-100 text-sm mt-0.5">
                    {row.Cliente || row.ClienteFinal || row.cliente || row.cliente_nombre || '-'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/40">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Documento</span>
                    <span className="font-mono text-slate-200 font-medium">
                      {row.NumeroDocumento || row['Número Documento'] || row.documento || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Tipo Cliente</span>
                    <span className="text-slate-200 font-medium">{row.Tipo || row.tipo_cliente || 'Residencial'}</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-400" /> Móvil:
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {row.TeleMovilNume || row.telefono || row.phone || '-'}
                    </span>
                  </div>
                  {row.TeleFijoNume && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase">Fijo:</span>
                      <span className="font-mono text-slate-300">{row.TeleFijoNume}</span>
                    </div>
                  )}
                  {row.Email && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3 text-cyan-400" /> Email:
                      </span>
                      <span className="text-slate-300 truncate max-w-[160px]" title={row.Email}>{row.Email}</span>
                    </div>
                  )}
                  {row.CodiClien && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase">Cód. Cliente:</span>
                      <span className="font-mono text-slate-400">{row.CodiClien}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BLOQUE 2: DIRECCIÓN Y UBICACIÓN */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">
                  <MapPin className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Dirección & Zona</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Dirección de Instalación</span>
                  <div className="font-medium text-slate-200 mt-0.5 leading-relaxed bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 break-words" title={row.Direccion || '-'}>
                    {row.Direccion || row.direccion || '-'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/40">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Distrito / Zona</span>
                    <span className="font-bold text-cyan-300">{row.Zona || row.distrito || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Provincia</span>
                    <span className="text-slate-300 font-medium">{row.Provincia || row.provincia || row.Localidad || '-'}</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800/40 space-y-1.5">
                  {row['Sector Operativo'] && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase">Sector:</span>
                      <span className="font-semibold text-amber-300">{row['Sector Operativo']}</span>
                    </div>
                  )}
                  {row.Region && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase">Región:</span>
                      <span className="text-slate-300">{row.Region}</span>
                    </div>
                  )}
                  {row.Georeferencia && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Georreferencia:</span>
                      <span className="font-mono text-[10px] text-slate-400 truncate block mt-0.5">{row.Georeferencia}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BLOQUE 3: CUADRILLA Y OPERACIÓN */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cuadrilla & Asignación</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Cuadrilla Completa</span>
                  <div className="font-bold text-slate-100 mt-0.5 bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 leading-snug">
                    {row.Cuadrilla || row.cuadrilla || '-'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/40">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Técnico Principal</span>
                    <span className="font-medium text-orange-300">{row.Cuadrilla_nombre || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Proveedor / Contratista</span>
                    <span className="text-slate-300 font-medium truncate block">{row.Proveedeor || row.Empresa || '-'}</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase">F. Visita:</span>
                    <span className="font-mono font-bold text-amber-300">{formatDateOnly(row.FechaVisita || row['F.Visita'] || row.fecha_visita)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase">F. Solicitud:</span>
                    <span className="font-mono text-slate-300">{formatDate(row['F.Soli'] || row.fecha_solicitud)}</span>
                  </div>
                  {row['Usuario Asignó'] && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase">Asignado por:</span>
                      <span className="text-slate-400 text-[11px] truncate">{row['Usuario Asignó']}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BLOQUE 4: SERVICIO Y DIAGNÓSTICO */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Servicio & Detalles</h4>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Producto Contratado</span>
                  <div className="font-bold text-slate-100 mt-0.5">{row.Producto || row.producto || '-'}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/40">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Tipo Trabajo</span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-medium inline-block mt-0.5">
                      {row.TipoTraba || row.tipo_trabajo || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Ticket</span>
                    <span className="font-mono text-slate-200 font-medium">{row.ticket || row.CodiSegui || '-'}</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800/40 space-y-1.5">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Motivo de Trabajo</span>
                    <span className="text-slate-300 text-[11px] leading-tight block mt-0.5">
                      {row['Motivo Trabajo'] || row.motivo_trabajo || row.Motivo || '-'}
                    </span>
                  </div>
                  {(row['Observaciones OT'] || row['Diagnóstico Técnico']) && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Observaciones / Diagnóstico</span>
                      <span className="text-slate-400 text-[11px] line-clamp-2 block mt-0.5">
                        {row['Observaciones OT'] || row['Diagnóstico Técnico']}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PESTAÑA: TODOS LOS METADATOS TÉCNICOS (Micro-grid compacto) */
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
