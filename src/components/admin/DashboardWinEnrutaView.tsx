import React from 'react';
import { 
  Database, 
  Send, 
  CheckCheck, 
  Navigation, 
  Activity, 
  MapPin, 
  CalendarClock, 
  TrendingUp, 
  RefreshCw,
  PieChart
} from 'lucide-react';

interface DashboardWinEnrutaViewProps {
  loadingStats: boolean;
  dashboardStats: any;
  fechaInicio?: string;
}

export const DashboardWinEnrutaView: React.FC<DashboardWinEnrutaViewProps> = ({
  loadingStats,
  dashboardStats,
  fechaInicio = ''
}) => {
  const getTodayPeruString = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      return `${y}-${m}-${d}`;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  };

  return (
          <div className="space-y-4">
            {loadingStats ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 backdrop-blur min-h-[350px]">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs text-slate-300 font-medium">Calculando métricas agregadas del embudo y sectores...</p>
              </div>
            ) : !dashboardStats || !dashboardStats.kpis ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-16 text-center text-slate-400 backdrop-blur min-h-[300px] flex items-center justify-center">
                No se encontraron registros para generar el dashboard con los filtros seleccionados
              </div>
            ) : (
              (() => {
                const k = dashboardStats.kpis || {};
                const totalOts = Number(k.total_ots || 0);
                const wspEnviados = Number(k.wsp_enviados || 0);
                const wspNoEnviados = Number(k.wsp_no_enviados || 0);
                const trackingIngresados = Number(k.tracking_ingresados || 0);
                const reprogramados = Number(k.reprogramados || 0);
                const encuestas = Number(k.encuestas_respondidas || 0);
                const soporte = Number(k.pulso_soporte || 0);
                const vistasMapa = Number(k.total_vistas_mapa || 0);

                const pctEnviados = totalOts > 0 ? ((wspEnviados / totalOts) * 100).toFixed(1) : '0.0';
                const pctNoEnviados = totalOts > 0 ? ((wspNoEnviados / totalOts) * 100).toFixed(1) : '0.0';
                const pctTracking = totalOts > 0 ? ((trackingIngresados / totalOts) * 100).toFixed(1) : '0.0';
                const pctTrackingDeEnviados = wspEnviados > 0 ? ((trackingIngresados / wspEnviados) * 100).toFixed(1) : '0.0';

                const estadosList: Array<{ estado: string; total: number }> = dashboardStats.estadosWsp || [];
                const readTotal = estadosList.find(e => e.estado.toLowerCase() === 'read')?.total || 0;
                const deliveredTotal = estadosList.find(e => e.estado.toLowerCase() === 'delivered')?.total || 0;
                const sentTotal = estadosList.find(e => e.estado.toLowerCase() === 'sent')?.total || 0;
                const failedTotal = estadosList.find(e => e.estado.toLowerCase() === 'failed')?.total || 0;
                const pctRead = wspEnviados > 0 ? ((readTotal / wspEnviados) * 100).toFixed(1) : '0.0';
                const pctTrackingDeRead = readTotal > 0 ? ((trackingIngresados / readTotal) * 100).toFixed(1) : '0.0';
                const avanceDiarioList: Array<any> = (dashboardStats.avanceDiario && dashboardStats.avanceDiario.length > 0)
                  ? dashboardStats.avanceDiario
                  : totalOts > 0
                    ? [{
                        fecha: fechaInicio || getTodayPeruString(),
                        total_ots: totalOts,
                        wsp_enviados: wspEnviados,
                        wsp_no_enviados: wspNoEnviados,
                        read_total: readTotal,
                        delivered_total: deliveredTotal,
                        sent_total: sentTotal,
                        failed_total: failedTotal,
                        tracking_ingresados: trackingIngresados,
                        total_vistas_mapa: vistasMapa,
                        reprogramados: reprogramados,
                        encuestas_respondidas: encuestas,
                        pulso_soporte: soporte
                      }]
                    : [];

                const formatDia = (fechaStr: string) => {
                  if (!fechaStr || fechaStr === 'Sin fecha') return 'Sin fecha';
                  try {
                    const parts = fechaStr.split('-');
                    if (parts.length === 3) {
                      return `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                    return fechaStr;
                  } catch {
                    return fechaStr;
                  }
                };

                return (
                  <div className="space-y-4">
                    {/* 1. Tarjetas KPI Principales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                      {/* KPI 1 */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden backdrop-blur">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-medium text-slate-400">Total OTs Visita</span>
                          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                            <Database className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-white font-mono">{totalOts.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 mt-1">Órdenes evaluadas en rango</div>
                        <div className="absolute top-0 right-0 h-1 w-full bg-blue-500/40" />
                      </div>

                      {/* KPI 2 */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden backdrop-blur">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-medium text-slate-400">WSP Enviados</span>
                          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                            <Send className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-bold text-emerald-400 font-mono">{wspEnviados.toLocaleString()}</div>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">
                            {pctEnviados}%
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          No enviados: <span className="text-slate-300 font-mono">{wspNoEnviados.toLocaleString()}</span> ({pctNoEnviados}%)
                        </div>
                        <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500/50" />
                      </div>

                      {/* KPI 3 */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden backdrop-blur">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-medium text-slate-400">Mensajes Leídos (Read)</span>
                          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                            <CheckCheck className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-bold text-cyan-400 font-mono">{readTotal.toLocaleString()}</div>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold font-mono">
                            {pctRead}%
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate">
                          Delivered: <span className="text-slate-300 font-mono">{deliveredTotal}</span> · Sent: <span className="text-blue-400 font-mono">{sentTotal}</span> · Failed: <span className="text-rose-400 font-mono">{failedTotal}</span>
                        </div>
                        <div className="absolute top-0 right-0 h-1 w-full bg-cyan-500/50" />
                      </div>

                      {/* KPI 4 */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden backdrop-blur">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-medium text-slate-400">Ingreso a Tracking</span>
                          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                            <Navigation className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <div className="text-2xl font-bold text-amber-400 font-mono">{trackingIngresados.toLocaleString()}</div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span 
                              className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono border border-amber-500/30"
                              title="Ingresos sobre total de mensajes enviados"
                            >
                              {pctTrackingDeEnviados}% s/Env
                            </span>
                            <span 
                              className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold font-mono border border-cyan-500/30"
                              title="Ingresos sobre total de mensajes leídos (Read)"
                            >
                              {pctTrackingDeRead}% s/Read
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                          <span>Vistas de mapa: <span className="text-slate-300 font-mono">{vistasMapa.toLocaleString()}</span></span>
                          <span className="text-slate-500 font-mono text-[10px]">({pctTracking}% base)</span>
                        </div>
                        <div className="absolute top-0 right-0 h-1 w-full bg-amber-500/50" />
                      </div>

                      {/* KPI 5 */}
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden backdrop-blur">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-medium text-slate-400">Autogestión & Calidad</span>
                          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                            <Activity className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 justify-center flex-1 my-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-medium">Reprogramaron:</span>
                            <span className="font-mono font-bold text-purple-400 text-sm">{reprogramados.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-medium">Encuestas:</span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">{encuestas.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-medium">SOS:</span>
                            <span className="font-mono font-bold text-rose-400 text-sm">{soporte.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="absolute top-0 right-0 h-1 w-full bg-purple-500/50" />
                      </div>
                    </div>

                    {/* 2. Sección Central: Estados de WhatsApp y Tabla de Avance Diario */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {/* Card Estados WSP */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                              <Send className="w-4 h-4 text-emerald-400" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                Distribución por Estado del Mensaje WSP
                              </h4>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">{wspEnviados + wspNoEnviados} msgs</span>
                          </div>
                          <div className="space-y-3">
                            {estadosList.map((item, idx) => {
                              const count = Number(item.total || 0);
                              const grandTotal = totalOts || 1;
                              const pct = ((count / grandTotal) * 100).toFixed(1);
                              const isRead = item.estado.toLowerCase() === 'read';
                              const isDelivered = item.estado.toLowerCase() === 'delivered';
                              const isSent = item.estado.toLowerCase() === 'sent';
                              const isFailed = item.estado.toLowerCase() === 'failed';

                              const colorClass = isRead ? 'bg-emerald-500' : isDelivered ? 'bg-cyan-500' : isSent ? 'bg-blue-500' : isFailed ? 'bg-rose-500' : 'bg-slate-600';
                              const badgeBorder = isRead ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : isDelivered ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' : isSent ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : isFailed ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' : 'text-slate-400 border-slate-700 bg-slate-800/40';

                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${badgeBorder}`}>
                                      {item.estado.toUpperCase()}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-white">{count.toLocaleString()}</span>
                                      <span className="text-[10px] text-slate-400 font-mono w-12 text-right">({pct}%)</span>
                                    </div>
                                  </div>
                                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                                    <div 
                                      className={`h-full ${colorClass} rounded-full transition-all duration-500`} 
                                      style={{ width: `${pct}%` }} 
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Card Avance Diario (Tabla de Indicadores Día a Día) */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-cyan-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Avance Diario de Indicadores
                            </h4>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {avanceDiarioList.length} {avanceDiarioList.length === 1 ? 'día' : 'días'}
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-[320px] scrollbar-thin scrollbar-thumb-slate-700">
                          <table className="w-full text-left text-xs text-slate-300 border-collapse">
                            <thead className="bg-slate-950/90 sticky top-0 z-10 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Total Base</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">WSP Env.</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Leídos (Read)</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Tracking</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Vistas</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Reprog.</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Encuestas</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">SOS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                              {avanceDiarioList.length === 0 ? (
                                <tr>
                                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans text-xs">
                                    No hay registros diarios en el rango seleccionado
                                  </td>
                                </tr>
                              ) : (
                                avanceDiarioList.map((dia: any, dIdx: number) => {
                                  const diaTotal = Number(dia.total_ots || 0);
                                  const diaEnv = Number(dia.wsp_enviados || 0);
                                  const diaPctEnv = diaTotal > 0 ? ((diaEnv / diaTotal) * 100).toFixed(1) : '0.0';
                                  const diaRead = Number(dia.read_total || 0);
                                  const diaPctRead = diaEnv > 0 ? ((diaRead / diaEnv) * 100).toFixed(1) : '0.0';
                                  const diaTrack = Number(dia.tracking_ingresados || 0);
                                  const diaPctTrackEnv = diaEnv > 0 ? ((diaTrack / diaEnv) * 100).toFixed(1) : '0.0';
                                  const diaPctTrackRead = diaRead > 0 ? ((diaTrack / diaRead) * 100).toFixed(1) : '0.0';
                                  const diaVistas = Number(dia.total_vistas_mapa || 0);
                                  const diaReprog = Number(dia.reprogramados || 0);
                                  const diaEnc = Number(dia.encuestas_respondidas || 0);
                                  const diaSos = Number(dia.pulso_soporte || 0);

                                  return (
                                    <tr key={dIdx} className="hover:bg-slate-800/30 transition-colors">
                                      <td className="py-2 px-3 font-semibold text-white whitespace-nowrap font-sans">
                                        {formatDia(dia.fecha)}
                                      </td>
                                      <td className="py-2 px-3 text-right text-slate-200">
                                        {diaTotal.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        <span className="text-emerald-400 font-bold">{diaEnv.toLocaleString()}</span>
                                        <span className="text-[10px] text-emerald-400/80 ml-1 font-normal">({diaPctEnv}%)</span>
                                      </td>
                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        <span className="text-cyan-400 font-bold">{diaRead.toLocaleString()}</span>
                                        <span className="text-[10px] text-cyan-400/80 ml-1 font-normal">({diaPctRead}%)</span>
                                      </td>
                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        <span className="text-amber-400 font-bold">{diaTrack.toLocaleString()}</span>
                                        <span className="text-[10px] text-amber-300 ml-1" title="s/ Enviados">({diaPctTrackEnv}%)</span>
                                        <span className="text-[10px] text-cyan-300 ml-1" title="s/ Read">[{diaPctTrackRead}%]</span>
                                      </td>
                                      <td className="py-2 px-3 text-right text-slate-300">
                                        {diaVistas.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right text-purple-400 font-bold">
                                        {diaReprog.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                                        {diaEnc.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right text-rose-400 font-bold">
                                        {diaSos.toLocaleString()}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* 3. Panel Embudo de Conversión Operativa (Reubicado debajo de Distribución y Avance Diario) */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-orange-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Embudo de Conversión Operativa
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-orange-400 font-semibold">{pctTrackingDeEnviados}% apertura s/env</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-cyan-400 font-semibold">{pctTrackingDeRead}% s/read</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Paso 1 */}
                        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center">1</span>
                            <span className="text-[10px] text-slate-500 font-mono">100% Base</span>
                          </div>
                          <div className="text-xs text-slate-300 font-medium mb-1">Órdenes Programadas</div>
                          <div className="font-mono font-bold text-white text-lg">{totalOts.toLocaleString()}</div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2.5 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full w-full" />
                          </div>
                        </div>

                        {/* Paso 2 */}
                        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center">2</span>
                            <span className="text-[10px] text-emerald-400/80 font-mono">{pctEnviados}% de base</span>
                          </div>
                          <div className="text-xs text-slate-300 font-medium mb-1">WhatsApp Notificados</div>
                          <div className="font-mono font-bold text-emerald-400 text-lg">{wspEnviados.toLocaleString()}</div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2.5 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pctEnviados}%` }} />
                          </div>
                        </div>

                        {/* Paso 3 */}
                        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-[10px] flex items-center justify-center">3</span>
                            <span className="text-[10px] text-cyan-400/80 font-mono">{pctRead}% de env.</span>
                          </div>
                          <div className="text-xs text-slate-300 font-medium mb-1">Leídos por Cliente</div>
                          <div className="font-mono font-bold text-cyan-400 text-lg">{readTotal.toLocaleString()}</div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2.5 overflow-hidden">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${pctRead}%` }} />
                          </div>
                        </div>

                        {/* Paso 4 */}
                        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center">4</span>
                            <span className="text-[10px] text-amber-400/80 font-mono">{pctTrackingDeEnviados}% s/env · {pctTrackingDeRead}% s/read</span>
                          </div>
                          <div className="text-xs text-slate-300 font-medium mb-1">Ingresaron al Mapa</div>
                          <div className="font-mono font-bold text-amber-400 text-lg">{trackingIngresados.toLocaleString()}</div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2.5 overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctTrackingDeEnviados}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Desglose por Sector Operativo y Tipo de Operación */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Tabla de Sectores Operativos (2 columnas) */}
                      <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-orange-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Rendimiento por Sector Operativo (Top Sectores)
                            </h4>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">{dashboardStats.sectores?.length || 0} sectores</span>
                        </div>
                        <div className="overflow-x-auto max-h-[380px] scrollbar-thin scrollbar-thumb-slate-700">
                          <table className="w-full text-left text-xs text-slate-300 border-collapse">
                            <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3">Sector Operativo</th>
                                <th className="py-2.5 px-3 text-right">Total OTs</th>
                                <th className="py-2.5 px-3 text-right">Enviados</th>
                                <th className="py-2.5 px-3 text-right">No Env.</th>
                                <th className="py-2.5 px-3 text-center">% Cobertura WSP</th>
                                <th className="py-2.5 px-3 text-right">Tracking</th>
                                <th className="py-2.5 px-3 text-right">Leídos</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                              {(dashboardStats.sectores || []).map((sec: any, sIdx: number) => {
                                const secTotal = Number(sec.total || 0);
                                const secEnv = Number(sec.enviados || 0);
                                const secNoEnv = Number(sec.no_enviados || 0);
                                const secTrack = Number(sec.tracking_ingresados || 0);
                                const secRead = Number(sec.leidos || 0);
                                const pct = secTotal > 0 ? Math.round((secEnv / secTotal) * 100) : 0;

                                return (
                                  <tr key={sIdx} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="py-2 px-3 font-sans font-medium text-slate-200">
                                      {sec.sector}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-white">{secTotal.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right text-emerald-400">{secEnv.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right text-slate-500">{secNoEnv.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <div className="w-16 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                          <div className={`h-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'} rounded-full`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className={`text-[10px] font-bold ${pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>{pct}%</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-right text-amber-400">{secTrack}</td>
                                    <td className="py-2 px-3 text-right text-cyan-400">{secRead}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Card Tipos de Operación (1 columna) */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <PieChart className="w-4 h-4 text-orange-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Tipo de Operación
                            </h4>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">{dashboardStats.operaciones?.length || 0} tipos</span>
                        </div>
                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
                          {(dashboardStats.operaciones || []).map((op: any, oIdx: number) => {
                            const opTotal = Number(op.total || 0);
                            const opEnv = Number(op.enviados || 0);
                            const pctOp = totalOts > 0 ? ((opTotal / totalOts) * 100).toFixed(1) : '0';
                            const pctCob = opTotal > 0 ? Math.round((opEnv / opTotal) * 100) : 0;

                            return (
                              <div key={oIdx} className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-white truncate max-w-[150px]">{op.operacion}</span>
                                  <span className="font-mono text-slate-300 font-bold">{opTotal.toLocaleString()} ({pctOp}%)</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Enviados WSP: <strong className="text-emerald-400 font-mono">{opEnv}</strong></span>
                                  <span>Cobertura: <strong className="text-orange-400 font-mono">{pctCob}%</strong></span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pctCob}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>

  );
};
