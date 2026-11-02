import React from 'react';
import { formatTipoServicioLabel } from '../../lib/utils';
import { 
  Database, 
  Send, 
  CheckCheck, 
  Navigation, 
  Activity, 
  MapPin, 
  CalendarClock,
  BarChart3,
  RefreshCw,
  PieChart,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Filter
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
                const estadosOtList: Array<any> = dashboardStats.estadosOt || [];
                const partnersList: Array<any> = dashboardStats.partners || [];
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

                    {/* 2. Sección Central: Resumen Ejecutivo (Izquierda, más amplio) y Distribución WSP (Derecha, compacto) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Card Resumen Ejecutivo (Tabla de Indicadores Día a Día) - 8 columnas */}
                      <div className="lg:col-span-8 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-cyan-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Resumen Ejecutivo
                            </h4>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {avanceDiarioList.length} {avanceDiarioList.length === 1 ? 'día' : 'días'}
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-[350px] scrollbar-thin scrollbar-thumb-slate-700">
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
                                      <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap font-sans">
                                        {formatDia(dia.fecha)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-200">
                                        {diaTotal.toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-emerald-400 font-bold">{diaEnv.toLocaleString()}</span>
                                        <span className="text-[10px] text-emerald-400/80 ml-1 font-normal">({diaPctEnv}%)</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-cyan-400 font-bold">{diaRead.toLocaleString()}</span>
                                        <span className="text-[10px] text-cyan-400/80 ml-1 font-normal">({diaPctRead}%)</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-amber-400 font-bold">{diaTrack.toLocaleString()}</span>
                                        <span className="text-[10px] text-amber-300 ml-1" title="s/ Enviados">({diaPctTrackEnv}%)</span>
                                        <span className="text-[10px] text-cyan-300 ml-1" title="s/ Read">[{diaPctTrackRead}%]</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-300">
                                        {diaVistas.toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-purple-400 font-bold">
                                        {diaReprog.toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                                        {diaEnc.toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-rose-400 font-bold">
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

                      {/* Card Estados WSP (A la derecha, más compacto) - 4 columnas */}
                      <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                              <Send className="w-4 h-4 text-emerald-400" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                                Distribución por Estado WSP
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
                    </div>

                    {/* 2.1 Nueva Sección: Eficiencia y Conversión por Estado OT (Cuadro + Gráfico Comparativo) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Cuadro / Tabla por Estado OT - 7 columnas */}
                      <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Conversión por Estado OT (% Leído & % Ingreso)
                            </h4>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {estadosOtList.length} {estadosOtList.length === 1 ? 'estado' : 'estados'}
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-[350px] scrollbar-thin scrollbar-thumb-slate-700">
                          <table className="w-full text-left text-xs text-slate-300 border-collapse">
                            <thead className="bg-slate-950/90 sticky top-0 z-10 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3 whitespace-nowrap">Estado OT</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Total OTs</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">WSP Env.</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Leídos (Read)</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">% Leído</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Tracking</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">% Ingreso s/env</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">% Ingreso s/read</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                              {estadosOtList.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans text-xs">
                                    No hay registros disponibles por estado en este rango
                                  </td>
                                </tr>
                              ) : (
                                estadosOtList.map((item: any, idx: number) => {
                                  const tot = Number(item.total_ots || 0);
                                  const env = Number(item.wsp_enviados || 0);
                                  const pctEnv = tot > 0 ? ((env / tot) * 100).toFixed(1) : '0.0';
                                  const read = Number(item.read_total || 0);
                                  const pctRead = env > 0 ? ((read / env) * 100).toFixed(1) : '0.0';
                                  const track = Number(item.tracking_ingresados || 0);
                                  const pctTrackEnv = env > 0 ? ((track / env) * 100).toFixed(1) : '0.0';
                                  const pctTrackRead = read > 0 ? ((track / read) * 100).toFixed(1) : '0.0';

                                  const estLower = String(item.estado || '').toLowerCase();
                                  const isDone = estLower.includes('fin') || estLower.includes('liquid') || estLower.includes('complet') || estLower.includes('inic');
                                  const isAgendada = estLower.includes('agend') || estLower.includes('pend');
                                  const isCancel = estLower.includes('cancel') || estLower.includes('anul');

                                  const badgeClass = isDone
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : isAgendada
                                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                    : isCancel
                                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

                                  return (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                      <td className="py-2.5 px-3 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                                          {item.estado}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-200">
                                        {tot.toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-emerald-400 font-bold">{env.toLocaleString()}</span>
                                        <span className="text-[10px] text-emerald-400/80 ml-1 font-normal">({pctEnv}%)</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-cyan-400 font-bold">{read.toLocaleString()}</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-cyan-300 font-bold">{pctRead}%</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-amber-400 font-bold">{track.toLocaleString()}</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-amber-300 font-bold">{pctTrackEnv}%</span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <span className="text-cyan-300 font-bold">[{pctTrackRead}%]</span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Gráfico Comparativo por Estado OT - 5 columnas */}
                      <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-cyan-400" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                                Comparativo: % Leído vs % Ingreso
                              </h4>
                            </div>
                            <div className="flex items-center gap-2.5 text-[10px] font-mono">
                              <span className="flex items-center gap-1 text-cyan-400">
                                <span className="w-2 h-2 rounded-full bg-cyan-400" /> % Read
                              </span>
                              <span className="flex items-center gap-1 text-amber-400">
                                <span className="w-2 h-2 rounded-full bg-amber-400" /> % Ingreso
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                            {estadosOtList.length === 0 ? (
                              <div className="py-8 text-center text-slate-500 text-xs">
                                Sin datos de estado para graficar
                              </div>
                            ) : (
                              estadosOtList.map((item: any, idx: number) => {
                                const tot = Number(item.total_ots || 0);
                                const env = Number(item.wsp_enviados || 0);
                                const read = Number(item.read_total || 0);
                                const track = Number(item.tracking_ingresados || 0);
                                const pctRead = env > 0 ? ((read / env) * 100).toFixed(1) : '0.0';
                                const pctTrackEnv = env > 0 ? ((track / env) * 100).toFixed(1) : '0.0';

                                const estLower = String(item.estado || '').toLowerCase();
                                const isDone = estLower.includes('fin') || estLower.includes('liquid') || estLower.includes('complet') || estLower.includes('inic');
                                const isAgendada = estLower.includes('agend') || estLower.includes('pend');
                                const isCancel = estLower.includes('cancel') || estLower.includes('anul');

                                const badgeClass = isDone
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : isAgendada
                                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                  : isCancel
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

                                return (
                                  <div key={idx} className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${badgeClass}`}>
                                        {item.estado}
                                      </span>
                                      <span className="text-[11px] font-mono text-slate-400">
                                        <strong className="text-white font-bold">{tot.toLocaleString()}</strong> OTs
                                      </span>
                                    </div>

                                    {/* Barra 1: % Leído */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-slate-400">% Leído s/envíos:</span>
                                        <span className="font-mono font-bold text-cyan-400">{pctRead}% ({read.toLocaleString()})</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                        <div 
                                          className="h-full bg-cyan-400 rounded-full transition-all duration-500" 
                                          style={{ width: `${Math.min(Number(pctRead), 100)}%` }} 
                                        />
                                      </div>
                                    </div>

                                    {/* Barra 2: % Ingreso al mapa */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-slate-400">% Ingreso s/envíos:</span>
                                        <span className="font-mono font-bold text-amber-400">{pctTrackEnv}% ({track.toLocaleString()})</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                        <div 
                                          className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                                          style={{ width: `${Math.min(Number(pctTrackEnv), 100)}%` }} 
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
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
                                  <span className="font-bold text-white truncate max-w-[150px]">{formatTipoServicioLabel(op.operacion)}</span>
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

                    {/* ======================================================== */}
                    {/* NUEVA SECCIÓN AVANZADA: EMBUDO, EVOLUCIÓN, DONUT & PARTNERS */}
                    {/* ======================================================== */}

                    {/* 1. EMBUDO DE INTERACCIÓN & EVOLUCIÓN TEMPORAL */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* EMBUDO VISUAL EJECUTIVO (5 cols) */}
                      <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                              <Filter className="w-4 h-4 text-orange-400" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                Embudo de Interacción del Cliente
                              </h4>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">100% Base a Ingreso</span>
                          </div>

                          <div className="space-y-3">
                            {/* Paso 1: Órdenes Evaluadas */}
                            <div className="p-3.5 bg-blue-950/30 border border-blue-800/40 rounded-xl relative overflow-hidden">
                              <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                                    1
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">Órdenes Evaluadas</div>
                                    <div className="text-base font-extrabold text-white font-mono">{totalOts.toLocaleString()}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-blue-400 font-mono">100%</span>
                                  <span className="text-[10px] text-slate-400 block">Base total</span>
                                </div>
                              </div>
                              <div className="h-1 w-full bg-blue-500/20 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
                              </div>
                            </div>

                            {/* Paso 2: Mensajes Enviados */}
                            <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl relative overflow-hidden">
                              <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                                    2
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">Mensajes Enviados</div>
                                    <div className="text-base font-extrabold text-emerald-400 font-mono">{wspEnviados.toLocaleString()}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-emerald-400 font-mono">{pctEnviados}%</span>
                                  <span className="text-[10px] text-slate-400 block">s/ base</span>
                                </div>
                              </div>
                              <div className="h-1 w-full bg-emerald-500/20 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pctEnviados}%` }} />
                              </div>
                            </div>

                            {/* Paso 3: Mensajes Leídos */}
                            <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/40 rounded-xl relative overflow-hidden">
                              <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                                    3
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">Mensajes Leídos</div>
                                    <div className="text-base font-extrabold text-cyan-400 font-mono">{readTotal.toLocaleString()}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-cyan-400 font-mono">{pctRead}%</span>
                                  <span className="text-[10px] text-slate-400 block">s/ enviados</span>
                                </div>
                              </div>
                              <div className="h-1 w-full bg-cyan-500/20 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${pctRead}%` }} />
                              </div>
                            </div>

                            {/* Paso 4: Ingreso a Tracking */}
                            <div className="p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-xl relative overflow-hidden">
                              <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                                    4
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">Ingreso a Tracking</div>
                                    <div className="text-base font-extrabold text-amber-400 font-mono">{trackingIngresados.toLocaleString()}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-amber-400 font-mono">{pctTrackingDeEnviados}%</span>
                                  <span className="text-[10px] text-cyan-300 block font-mono">[{pctTrackingDeRead}% s/read]</span>
                                </div>
                              </div>
                              <div className="h-1 w-full bg-amber-500/20 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctTrackingDeEnviados}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* EVOLUCIÓN MULTILÍNEA DE INDICADORES (7 cols) */}
                      <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-emerald-400" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                Evolución Diaria de Indicadores Clave (%)
                              </h4>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] font-mono">
                              <span className="flex items-center gap-1.5 text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> % Envío WSP
                              </span>
                              <span className="flex items-center gap-1.5 text-cyan-400">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> % Lectura
                              </span>
                              <span className="flex items-center gap-1.5 text-amber-400">
                                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> % Ingreso Tracking
                              </span>
                            </div>
                          </div>

                          {/* Gráfico SVG Multilínea Reactivo */}
                          {avanceDiarioList.length === 0 ? (
                            <div className="h-60 flex items-center justify-center text-xs text-slate-500">
                              Sin datos de evolución diaria en este rango
                            </div>
                          ) : (() => {
                            // Invertir para mostrar de izquierda (más antiguo) a derecha (más reciente)
                            const chartData = [...avanceDiarioList].reverse().slice(-14);
                            const maxVal = 100;
                            const h = 200;
                            const w = 550;
                            const padX = 35;
                            const padY = 20;
                            const plotW = w - padX * 2;
                            const plotH = h - padY * 2;
                            const n = chartData.length;
                            const getX = (i: number) => n === 1 ? w / 2 : padX + (i / (n - 1)) * plotW;
                            const getY = (val: number) => padY + plotH - (Math.min(100, Math.max(0, val)) / maxVal) * plotH;

                            const ptsEnv = chartData.map((d, i) => {
                              const tot = Number(d.total_ots || 0);
                              const env = Number(d.wsp_enviados || 0);
                              const pct = tot > 0 ? (env / tot) * 100 : 0;
                              return { x: getX(i), y: getY(pct), pct, dia: formatDia(d.fecha) };
                            });

                            const ptsRead = chartData.map((d, i) => {
                              const env = Number(d.wsp_enviados || 0);
                              const r = Number(d.read_total || 0);
                              const pct = env > 0 ? (r / env) * 100 : 0;
                              return { x: getX(i), y: getY(pct), pct, dia: formatDia(d.fecha) };
                            });

                            const ptsTrack = chartData.map((d, i) => {
                              const env = Number(d.wsp_enviados || 0);
                              const tr = Number(d.tracking_ingresados || 0);
                              const pct = env > 0 ? (tr / env) * 100 : 0;
                              return { x: getX(i), y: getY(pct), pct, dia: formatDia(d.fecha) };
                            });

                            const lineEnvPath = ptsEnv.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
                            const lineReadPath = ptsRead.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
                            const lineTrackPath = ptsTrack.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

                            return (
                              <div className="w-full overflow-x-auto">
                                <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56 select-none font-mono">
                                  {/* Grid Lines */}
                                  {[0, 25, 50, 75, 100].map(gridVal => (
                                    <g key={gridVal}>
                                      <line 
                                        x1={padX} 
                                        y1={getY(gridVal)} 
                                        x2={w - padX} 
                                        y2={getY(gridVal)} 
                                        stroke="#1e293b" 
                                        strokeDasharray="3 3" 
                                      />
                                      <text 
                                        x={padX - 8} 
                                        y={getY(gridVal) + 3} 
                                        textAnchor="end" 
                                        className="text-[9px] fill-slate-500"
                                      >
                                        {gridVal}%
                                      </text>
                                    </g>
                                  ))}

                                  {/* Lines */}
                                  <path d={lineEnvPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d={lineReadPath} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d={lineTrackPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                                  {/* Points */}
                                  {ptsEnv.map((p, i) => (
                                    <circle key={'e' + i} cx={p.x} cy={p.y} r="3" fill="#10b981" />
                                  ))}
                                  {ptsRead.map((p, i) => (
                                    <circle key={'r' + i} cx={p.x} cy={p.y} r="3" fill="#06b6d4" />
                                  ))}
                                  {ptsTrack.map((p, i) => (
                                    <circle key={'t' + i} cx={p.x} cy={p.y} r="3" fill="#f59e0b" />
                                  ))}

                                  {/* Fechas en eje X */}
                                  {ptsEnv.map((p, i) => (
                                    <text 
                                      key={'x' + i} 
                                      x={p.x} 
                                      y={h - 4} 
                                      textAnchor="middle" 
                                      className="text-[8px] fill-slate-400"
                                    >
                                      {p.dia.slice(0, 5)}
                                    </text>
                                  ))}
                                </svg>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* 2. DISTRIBUCIÓN DONUT DE MENSAJES & RENDIMIENTO POR PARTNER COMPLETO */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* DONUT CHART WSP & ESTADOS (4 cols) */}
                      <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                              <PieChart className="w-4 h-4 text-emerald-400" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                Distribución de Mensajes WSP
                              </h4>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {(wspEnviados + wspNoEnviados).toLocaleString()} msgs
                            </span>
                          </div>

                          {/* Donut SVG con Centro Informativo */}
                          {(() => {
                            const totalMsgs = wspEnviados + wspNoEnviados || 1;
                            const items = [
                              { label: 'READ', val: readTotal, color: '#10b981', textColor: 'text-emerald-400' },
                              { label: 'DELIVERED', val: deliveredTotal, color: '#06b6d4', textColor: 'text-cyan-400' },
                              { label: 'SENT', val: sentTotal, color: '#3b82f6', textColor: 'text-blue-400' },
                              { label: 'FAILED', val: failedTotal, color: '#f43f5e', textColor: 'text-rose-400' },
                              { label: 'NO ENVIADO', val: wspNoEnviados, color: '#64748b', textColor: 'text-slate-400' }
                            ].filter(i => i.val > 0);

                            const r = 50;
                            const circ = 2 * Math.PI * r;
                            let accumOffset = 0;

                            return (
                              <div className="space-y-4">
                                <div className="flex items-center justify-center relative py-2">
                                  <svg width="150" height="150" viewBox="0 0 130 130" className="transform -rotate-90">
                                    <circle cx="65" cy="65" r={r} fill="transparent" stroke="#0f172a" strokeWidth="18" />
                                    {items.map((it, idx) => {
                                      const strokeLength = (it.val / totalMsgs) * circ;
                                      const strokeDasharray = `${strokeLength} ${circ - strokeLength}`;
                                      const strokeDashoffset = -accumOffset;
                                      accumOffset += strokeLength;
                                      return (
                                        <circle
                                          key={idx}
                                          cx="65"
                                          cy="65"
                                          r={r}
                                          fill="transparent"
                                          stroke={it.color}
                                          strokeWidth="18"
                                          strokeDasharray={strokeDasharray}
                                          strokeDashoffset={strokeDashoffset}
                                          className="transition-all duration-700"
                                        />
                                      );
                                    })}
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Base</span>
                                    <span className="text-sm font-extrabold text-white font-mono">{totalMsgs.toLocaleString()}</span>
                                  </div>
                                </div>

                                {/* Desglose Lateral */}
                                <div className="space-y-2 pt-2 border-t border-slate-800">
                                  {items.map((it, idx) => {
                                    const pct = ((it.val / totalMsgs) * 100).toFixed(1);
                                    return (
                                      <div key={idx} className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2">
                                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: it.color }} />
                                          <span className="text-slate-300 font-medium">{it.label}</span>
                                        </span>
                                        <div className="flex items-center gap-2 font-mono">
                                          <span className="text-white font-bold">{it.val.toLocaleString()}</span>
                                          <span className={`text-[11px] ${it.textColor} w-12 text-right`}>({pct}%)</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* TABLA COMPLETA: INGRESO A TRACKING POR PARTNER / CONTRATA (8 cols) */}
                      <div className="lg:col-span-8 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-orange-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Ingreso a Tracking por Partner / Cuadrilla (Completo)
                            </h4>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {partnersList.length} {partnersList.length === 1 ? 'cuadrilla' : 'cuadrillas registradas'}
                          </span>
                        </div>

                        <div className="overflow-x-auto max-h-[360px] scrollbar-thin scrollbar-thumb-slate-700">
                          <table className="w-full text-left text-xs text-slate-300 border-collapse">
                            <thead className="bg-slate-950/90 sticky top-0 z-10 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3 whitespace-nowrap">Partner / Cuadrilla</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Órdenes</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">WSP Env.</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Leídos</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Tracking</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">% Ingreso s/env</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">% Ingreso s/read</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                              {partnersList.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans text-xs">
                                    No hay datos de cuadrillas disponibles en el rango
                                  </td>
                                </tr>
                              ) : (
                                partnersList.map((p: any, pIdx: number) => {
                                  const pTot = Number(p.total_ots || 0);
                                  const pEnv = Number(p.wsp_enviados || 0);
                                  const pRead = Number(p.read_total || 0);
                                  const pTrack = Number(p.tracking_ingresados || 0);
                                  const pPctEnv = pEnv > 0 ? ((pTrack / pEnv) * 100).toFixed(1) : '0.0';
                                  const pPctRead = pRead > 0 ? ((pTrack / pRead) * 100).toFixed(1) : '0.0';

                                  return (
                                    <tr key={pIdx} className="hover:bg-slate-800/30 transition-colors">
                                      <td className="py-2 px-3 font-semibold text-white whitespace-nowrap max-w-[260px] truncate font-sans">
                                        {p.partner}
                                      </td>
                                      <td className="py-2 px-3 text-right text-slate-200">
                                        {pTot.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right text-emerald-400">
                                        {pEnv.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right text-cyan-400">
                                        {pRead.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right text-amber-400 font-bold">
                                        {pTrack.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        <span className="text-amber-300 font-bold">{pPctEnv}%</span>
                                      </td>
                                      <td className="py-2 px-3 text-right whitespace-nowrap">
                                        <span className="text-cyan-300 font-bold">[{pPctRead}%]</span>
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

                    {/* 3. ALERTAS OPERATIVAS & OPORTUNIDADES DE MEJORA */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* ALERTAS OPERATIVAS (7 cols) */}
                      <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Alertas Operativas (Fugas del Embudo)
                            </h4>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">Detección Automática</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300 border-collapse">
                            <thead className="border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              <tr>
                                <th className="py-2 px-3">Motivo de Alerta</th>
                                <th className="py-2 px-3 text-right">Cantidad</th>
                                <th className="py-2 px-3 text-right">% Sobre Base</th>
                                <th className="py-2 px-3">Detalle</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                              <tr>
                                <td className="py-2.5 px-3 font-semibold text-rose-300 flex items-center gap-1.5 font-sans">
                                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                                  Mensajes no enviados
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-white">
                                  {wspNoEnviados.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right text-rose-400">
                                  {totalOts > 0 ? ((wspNoEnviados / totalOts) * 100).toFixed(1) : '0'}%
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 text-[10px] font-sans">
                                  Órdenes sin WhatsApp válido o sin autorización de envío.
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-semibold text-amber-300 flex items-center gap-1.5 font-sans">
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  Mensajes leídos sin ingreso
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-white">
                                  {Math.max(0, readTotal - trackingIngresados).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right text-amber-400">
                                  {totalOts > 0 ? (((Math.max(0, readTotal - trackingIngresados)) / totalOts) * 100).toFixed(1) : '0'}%
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 text-[10px] font-sans">
                                  Clientes que abrieron el WhatsApp pero no hicieron clic en el enlace.
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2.5 px-3 font-semibold text-red-400 flex items-center gap-1.5 font-sans">
                                  <span className="w-2 h-2 rounded-full bg-red-600" />
                                  Fallidos en envío (Failed)
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-white">
                                  {failedTotal.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right text-red-400">
                                  {totalOts > 0 ? ((failedTotal / totalOts) * 100).toFixed(1) : '0'}%
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 text-[10px] font-sans">
                                  Errores de entrega (número inválido, bloqueado o desconectado).
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* OPORTUNIDADES DE MEJORA (5 cols) */}
                      <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                Oportunidades de Mejora
                              </h4>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-mono">Plan de Acción</span>
                          </div>

                          <div className="space-y-3 text-xs text-slate-300">
                            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                              <div>
                                <strong className="text-white block font-medium">Validación preventiva de datos</strong>
                                <span className="text-slate-400 text-[11px] leading-relaxed">
                                  Reducir el {totalOts > 0 ? ((wspNoEnviados / totalOts) * 100).toFixed(1) : '0'}% de no envíos validando números de teléfono en el alta de la orden.
                                </span>
                              </div>
                            </div>

                            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                              <div>
                                <strong className="text-white block font-medium">Conversión de lectura a tracking</strong>
                                <span className="text-slate-400 text-[11px] leading-relaxed">
                                  Optimizar el llamado a la acción (CTA) del WhatsApp para elevar el ingreso desde el {pctTrackingDeRead}% actual sobre leídos.
                                </span>
                              </div>
                            </div>

                            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                              <div>
                                <strong className="text-white block font-medium">Potenciar autogestión y encuestas</strong>
                                <span className="text-slate-400 text-[11px] leading-relaxed">
                                  Incentivar reprogramaciones y encuestas en la vista web del cliente para reducir costos de call center.
                                </span>
                              </div>
                            </div>
                          </div>
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
