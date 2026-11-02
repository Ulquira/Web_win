import React from 'react';
import { 
  MessageSquare, 
  TrendingUp, 
  Layers, 
  CheckCircle2, 
  Activity, 
  Headset, 
  User, 
  RefreshCw 
} from 'lucide-react';

interface DashboardChatsViewProps {
  loadingChatsStats: boolean;
  chatsDashboardStats: any;
}

export const DashboardChatsView: React.FC<DashboardChatsViewProps> = ({
  loadingChatsStats,
  chatsDashboardStats
}) => {
  return (
          <div className="space-y-5">
            {loadingChatsStats ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs text-slate-400 font-medium">Calculando métricas analíticas de chats...</p>
              </div>
            ) : !chatsDashboardStats?.kpis ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                No hay datos disponibles para el rango y filtros seleccionados
              </div>
            ) : (
              (() => {
                const kpis = chatsDashboardStats.kpis || {};
                const totalChats = Number(kpis.totalChats || 0);
                const confirmados = Number(kpis.totalConfirmados || 0);
                const abiertos = Number(kpis.chatsAbiertos || 0);
                const slaVerde = Number(kpis.slaVerde || 0);
                const slaRojo = Number(kpis.slaRojo || 0);
                const pctConfirmados = totalChats > 0 ? Math.round((confirmados / totalChats) * 100) : 0;
                const pctSlaVerde = totalChats > 0 ? Math.round((slaVerde / totalChats) * 100) : 0;

                return (
                  <div className="space-y-5">
                    {/* Tarjetas KPI Superiores */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Total Chats */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400">Total Chats Gest.</span>
                          <div className="p-2 bg-orange-500/10 text-orange-400 rounded-xl">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-white font-mono">{totalChats.toLocaleString()}</div>
                        <div className="text-[11px] text-slate-500 mt-1">Conversaciones registradas</div>
                      </div>

                      {/* Confirmaciones por Botón */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400">Confirmadas (Botón)</span>
                          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-emerald-400 font-mono">{confirmados.toLocaleString()}</div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                          <span>"Si, confirmo" / Auto</span>
                          <span className="font-bold text-emerald-400 font-mono">{pctConfirmados}%</span>
                        </div>
                      </div>

                      {/* Chats Abiertos (Requieren Asesor) */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400">Abiertos (Esperando Asesor)</span>
                          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                            <Activity className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-rose-400 font-mono">{abiertos.toLocaleString()}</div>
                        <div className="text-[11px] text-rose-300/80 mt-1">Consultas reales de clientes</div>
                      </div>

                      {/* Cumplimiento SLA */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400">Cumplimiento SLA</span>
                          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-cyan-400 font-mono">{pctSlaVerde}%</div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                          <span>Verde: <strong className="text-emerald-400 font-mono">{slaVerde}</strong></span>
                          <span>Rojo: <strong className="text-rose-400 font-mono">{slaRojo}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Fila Media: Distribución Quién Tiene la Palabra & Estados */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Quién Tiene la Palabra */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <User className="w-4 h-4 text-orange-400" />
                            Distribución de Último Mensaje (Quién tiene la palabra)
                          </h4>
                        </div>
                        <div className="space-y-3.5">
                          {(chatsDashboardStats.palabra || []).map((p: any) => {
                            const pTotal = Number(p.total || 0);
                            const pPct = totalChats > 0 ? ((pTotal / totalChats) * 100).toFixed(1) : '0';
                            const badgeColor = 
                              p.palabra === 'CONFIRMADO' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                              p.palabra === 'CLIENTE' ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' :
                              p.palabra === 'PLANTILLA' ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' :
                              'text-orange-400 bg-orange-500/10 border-orange-500/30';

                            return (
                              <div key={p.palabra} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                                    {p.palabra}
                                  </span>
                                  <span className="font-mono text-slate-300 font-semibold">{pTotal.toLocaleString()} ({pPct}%)</span>
                                </div>
                                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      p.palabra === 'CONFIRMADO' ? 'bg-emerald-500' :
                                      p.palabra === 'CLIENTE' ? 'bg-blue-500' :
                                      p.palabra === 'PLANTILLA' ? 'bg-purple-500' : 'bg-orange-500'
                                    }`}
                                    style={{ width: `${pPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Grupos de Servicio / Operaciones */}
                      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-sm backdrop-blur">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-4 h-4 text-orange-400" />
                            Volumen por Grupo de Servicio / Trabajo
                          </h4>
                        </div>
                        <div className="space-y-3.5">
                          {(chatsDashboardStats.grupos || []).map((g: any) => {
                            const gTotal = Number(g.total || 0);
                            const gPct = totalChats > 0 ? ((gTotal / totalChats) * 100).toFixed(1) : '0';
                            return (
                              <div key={g.grupo} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-300">{g.grupo}</span>
                                  <span className="font-mono text-slate-300 font-bold">{gTotal.toLocaleString()} ({gPct}%)</span>
                                </div>
                                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                  <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" style={{ width: `${gPct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Fila Inferior: Tabla de Rendimiento por Asesor */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-sm backdrop-blur">
                      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Headset className="w-4 h-4 text-orange-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Rendimiento y Productividad por Asesor
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {chatsDashboardStats.asesores?.length || 0} asesores activos
                        </span>
                      </div>

                      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
                        <table className="w-full text-left text-xs text-slate-300 border-collapse">
                          <thead className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            <tr>
                              <th className="py-2.5 px-4">Asesor</th>
                              <th className="py-2.5 px-4 text-right">Total Chats</th>
                              <th className="py-2.5 px-4 text-right">Atendidos / Cerrados</th>
                              <th className="py-2.5 px-4 text-right">Abiertos (Pendientes)</th>
                              <th className="py-2.5 px-4 text-right">SLA Verde</th>
                              <th className="py-2.5 px-4 text-right">SLA Rojo</th>
                              <th className="py-2.5 px-4 text-right">% Cumplimiento</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                            {(chatsDashboardStats.asesores || []).map((a: any, aIdx: number) => {
                              const aTotal = Number(a.total || 0);
                              const aAtend = Number(a.atendidos || 0);
                              const aAbiert = Number(a.abiertos || 0);
                              const aVerd = Number(a.verdes || 0);
                              const aRoj = Number(a.rojos || 0);
                              const aCumpl = aTotal > 0 ? Math.round((aVerd / aTotal) * 100) : 100;

                              return (
                                <tr key={aIdx} className="hover:bg-slate-800/40 transition-colors">
                                  <td className="py-2.5 px-4 font-sans font-semibold text-white">
                                    {a.asesor}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-bold text-white">
                                    {aTotal.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-emerald-400">
                                    {aAtend.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-rose-400">
                                    {aAbiert.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-cyan-400">
                                    {aVerd.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-rose-400">
                                    {aRoj.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-bold">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                      aCumpl >= 80 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                                      aCumpl >= 60 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                                      'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                    }`}>
                                      {aCumpl}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>

  );
};
