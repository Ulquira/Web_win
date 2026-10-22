import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  FileSpreadsheet, 
  FileCode, 
  Eye, 
  CheckCircle2, 
  CalendarClock, 
  Layers,
  MessageSquare,
  X,
  ExternalLink
} from 'lucide-react';

type TabType = 'principal' | 'encuestas' | 'reprogramaciones' | 'chats_mantra';

interface FiltroOpciones {
  tiposTraba: string[];
  productos: string[];
  tiposServicio: Array<{ IDservicio: number; Servicio: string; Tipo: string }>;
  tiposClasificados: string[];
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('principal');
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');

  // Opciones de selects
  const [filtrosOpciones, setFiltrosOpciones] = useState<FiltroOpciones>({
    tiposTraba: [],
    productos: [],
    tiposServicio: [],
    tiposClasificados: []
  });

  // Modal para ver registro completo
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  // Endpoint estrictamente local
  const apiUrl = 'http://localhost:3001';

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar catálogo de filtros al inicio
  useEffect(() => {
    fetch(`${apiUrl}/api/admin/filtros`)
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(res => {
        if (res.success) {
          setFiltrosOpciones({
            tiposTraba: res.tiposTraba || [],
            productos: res.productos || [],
            tiposServicio: res.tiposServicio || [],
            tiposClasificados: res.tiposClasificados || []
          });
        }
      })
      .catch(err => {
        console.warn('Advertencia cargando catálogo de filtros:', err);
      });
  }, [apiUrl]);

  // Cargar datos al cambiar tab, paginación o aplicar filtros
  const fetchData = async (targetPage = page) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        tabla: activeTab,
        page: String(targetPage),
        limit: String(limit)
      });

      if (search) params.append('search', search);
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (tipoServicio && activeTab === 'principal') params.append('tipoServicio', tipoServicio);

      const res = await fetch(`${apiUrl}/api/admin/data?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`El servidor (${apiUrl}) respondió con error ${res.status} (${res.statusText})`);
      }
      const json = await res.json();

      if (json.success) {
        setData(json.data || []);
        setTotal(json.total || 0);
        setPage(json.page || 1);
        setTotalPages(json.totalPages || 1);
      } else {
        throw new Error(json.message || 'Error desconocido al consultar datos');
      }
    } catch (err: any) {
      console.error('Error cargando datos de BD:', err);
      setErrorMsg(err.message || 'No se pudo conectar con el servidor backend');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchData(1);
  }, [activeTab, limit, apiUrl]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setFechaInicio('');
    setFechaFin('');
    setTipoServicio('');
    setPage(1);
    fetchData(1);
  };

  // Descargar archivo (CSV o JSON)
  const handleDownload = (format: 'csv' | 'json') => {
    const params = new URLSearchParams({
      tabla: activeTab,
      format
    });

    if (search) params.append('search', search);
    if (fechaInicio) params.append('fechaInicio', fechaInicio);
    if (fechaFin) params.append('fechaFin', fechaFin);
    if (tipoServicio && activeTab === 'principal') params.append('tipoServicio', tipoServicio);

    window.open(`${apiUrl}/api/admin/export?${params.toString()}`, '_blank');
  };

  const formatDate = (val: any) => {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(val);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Superior */}
      <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-xl shadow-lg shadow-orange-500/20 text-white">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Panel de Base de Datos <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30">Admin Local</span>
            </h1>
            <p className="text-xs text-slate-400">
              Visualización, filtrado avanzado y exportación de órdenes, encuestas y reprogramaciones
            </p>
          </div>
        </div>

        {/* Acciones de exportación */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Indicador de entorno estrictamente local */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-400 font-mono text-[11px]">Backend Local: <strong className="text-white">http://localhost:3001</strong></span>
          </div>

          <button
            onClick={() => handleDownload('csv')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-md shadow-emerald-900/30 active:scale-95"
            title="Descargar en formato CSV compatible con Microsoft Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Descargar CSV
          </button>
          <button
            onClick={() => handleDownload('json')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-all active:scale-95"
            title="Descargar JSON estructurado"
          >
            <FileCode className="w-4 h-4" />
            Descargar JSON
          </button>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className="flex-1 p-6 max-w-[1700px] w-full mx-auto flex flex-col gap-5">
        {/* Banner de Error si falla la conexión */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold">⚠️ Error de conexión:</span>
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => fetchData()}
              className="px-3 py-1 bg-rose-600/30 hover:bg-rose-600 text-white rounded-lg transition-colors font-medium"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Selector de Tablas */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('principal')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'principal'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Tabla Principal (Órdenes de Trabajo)</span>
          </button>

          <button
            onClick={() => setActiveTab('encuestas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'encuestas'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Encuestas de Satisfacción</span>
          </button>

          <button
            onClick={() => setActiveTab('reprogramaciones')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'reprogramaciones'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>Reprogramaciones</span>
          </button>

          <button
            onClick={() => setActiveTab('chats_mantra')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'chats_mantra'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Historial Chats Mantra</span>
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Buscador general */}
            <div className="relative">
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Búsqueda rápida</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={
                    activeTab === 'principal' 
                      ? 'Cliente, DNI, Token, OT, Dirección...' 
                      : activeTab === 'chats_mantra'
                      ? 'Ticket, Teléfono, Cliente, Orden ID, Asesor...'
                      : 'Token, comentario, motivo...'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Fecha Inicio */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                {activeTab === 'principal' ? 'Fecha Visita Desde' : activeTab === 'chats_mantra' ? 'Fecha Gestión/Msg Desde' : 'Fecha Desde'}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Fecha Fin */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                {activeTab === 'principal' ? 'Fecha Visita Hasta' : activeTab === 'chats_mantra' ? 'Fecha Gestión/Msg Hasta' : 'Fecha Hasta'}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Tipo de Servicio (Solo visible en Tabla Principal) */}
            {activeTab === 'principal' && (
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Tipo de Servicio Cruzado</label>
                <select
                  value={tipoServicio}
                  onChange={e => setTipoServicio(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="">Todos los tipos</option>
                  <optgroup label="Tipos Cruzados (tiposervicio)">
                    {filtrosOpciones.tiposClasificados.map(tc => (
                      <option key={tc} value={tc}>{tc}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Tipos de Trabajo (vw)">
                    {filtrosOpciones.tiposTraba.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Productos (vw)">
                    {filtrosOpciones.productos.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Botones de acción */}
            <div className={`flex items-end gap-2 ${activeTab !== 'principal' ? 'lg:col-span-2' : ''}`}>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs rounded-xl transition-all shadow-md shadow-orange-950 active:scale-95"
              >
                <Filter className="w-3.5 h-3.5" />
                Filtrar
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl border border-slate-700 transition-all active:scale-95"
                title="Limpiar filtros"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => fetchData()}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all active:scale-95"
                title="Refrescar datos"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-400' : ''}`} />
              </button>
            </div>
          </form>
        </div>

        {/* Resumen y paginación superior */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 px-1">
          <div>
            Mostrando <span className="font-semibold text-white">{data.length}</span> de <span className="font-semibold text-orange-400">{total.toLocaleString()}</span> registros encontrados
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span>Filas por página:</span>
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1 focus:outline-none focus:border-orange-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  fetchData(p);
                }}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">Página <strong className="text-white">{page}</strong> de {totalPages}</span>
              <button
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  fetchData(p);
                }}
                disabled={page >= totalPages || loading}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de Resultados */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
              <p className="text-xs text-slate-300 font-medium">Cargando registros de la base de datos...</p>
            </div>
          )}

          <div className="overflow-x-auto max-h-[650px] scrollbar-thin scrollbar-thumb-slate-700">
            {activeTab === 'principal' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th className="py-3 px-4">Orden ID</th>
                    <th className="py-3 px-4">Tipo Servicio (Cruzado)</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">Fecha Visita</th>
                    <th className="py-3 px-4">Tipo Trabajo</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Localidad / Zona</th>
                    <th className="py-3 px-4">Cuadrilla</th>
                    <th className="py-3 px-4">PIN</th>
                    <th className="py-3 px-4">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-500">
                        No se encontraron registros con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="p-1.5 bg-slate-800 hover:bg-orange-500/20 hover:text-orange-400 text-slate-400 rounded-lg transition-colors"
                            title="Ver detalle completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-white">{row.OrdenId}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] tracking-wide uppercase border ${
                            row.TipoServicioCalculado === 'INSTALACION' 
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : row.TipoServicioCalculado === 'AVERIAS' || row.TipoServicioCalculado === 'AVERIAS PRV'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : row.TipoServicioCalculado === 'POSTVENTA'
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              : row.TipoServicioCalculado === 'PROVINCIA'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {row.TipoServicioCalculado || row.TipoTraba || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-100 max-w-[200px] truncate" title={row.Cliente}>
                          {row.Cliente}
                        </td>
                        <td className="py-2.5 px-4 font-mono">{row.NumeroDocumento || row['Número Documento'] || '-'}</td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-amber-300/90">{formatDate(row.FechaVisita || row['F.Visita'])}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                            {row.TipoTraba || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 max-w-[180px] truncate" title={row.Producto}>{row.Producto || '-'}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                            {row.Estado || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 max-w-[150px] truncate" title={`${row.Localidad || ''} - ${row.Zona || ''}`}>
                          {row.Localidad || row.Zona || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400">{row.Cuadrilla_nombre || '-'}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-orange-400">{row.Pin_token || '-'}</td>
                        <td className="py-2.5 px-4">
                          {row.token ? (
                            <a
                              href={`/seguimiento/${row.token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-orange-400 hover:text-orange-300 underline"
                              title="Abrir vista de seguimiento"
                            >
                              <span>{row.token.slice(0, 8)}...</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'encuestas' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Fecha Registro</th>
                    <th className="py-3 px-4">Concretada</th>
                    <th className="py-3 px-4">Satisfacción</th>
                    <th className="py-3 px-4">Trato</th>
                    <th className="py-3 px-4">Puntualidad</th>
                    <th className="py-3 px-4">Claridad</th>
                    <th className="py-3 px-4">Comentarios</th>
                    <th className="py-3 px-4">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        No hay encuestas registradas con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="p-1.5 bg-slate-800 hover:bg-orange-500/20 hover:text-orange-400 text-slate-400 rounded-lg transition-colors"
                            title="Ver detalle completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-white">#{row.id}</td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-amber-300/90">{formatDate(row.fecha_registro)}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            String(row.instalacion_concretada).toLowerCase() === 'si'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {row.instalacion_concretada || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-orange-400 text-sm">
                          {row.satisfaccion_general ?? '-'}
                        </td>
                        <td className="py-2.5 px-4">{row.tecnico_trato ?? '-'}</td>
                        <td className="py-2.5 px-4">{row.tecnico_puntualidad ?? '-'}</td>
                        <td className="py-2.5 px-4">{row.tecnico_claridad ?? '-'}</td>
                        <td className="py-2.5 px-4 max-w-[280px] truncate" title={row.satisfaccion_comentario || row.facilidad_motivo}>
                          {row.satisfaccion_comentario || row.facilidad_motivo || '-'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{row.token || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'chats_mantra' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Orden ID</th>
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Grupo Serv.</th>
                    <th className="py-3 px-4">Distrito / Prov.</th>
                    <th className="py-3 px-4">Palabra</th>
                    <th className="py-3 px-4">Estado Chat</th>
                    <th className="py-3 px-4">SLA</th>
                    <th className="py-3 px-4">Último Mensaje</th>
                    <th className="py-3 px-4">Fecha Último Msg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-500">
                        No hay chats de Mantra registrados con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="p-1.5 bg-slate-800 hover:bg-orange-500/20 hover:text-orange-400 text-slate-400 rounded-lg transition-colors"
                            title="Ver detalle completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-white">#{row.id}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">{row.orden_id || '-'}</td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-orange-400">{row.ticket || '-'}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">{row.phone || '-'}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-100 max-w-[180px] truncate" title={row.cliente_nombre}>
                          {row.cliente_nombre || '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                            {row.grupo_servicio || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 max-w-[150px] truncate" title={`${row.distrito || ''} ${row.provincia ? `(${row.provincia})` : ''}`}>
                          {row.distrito || row.provincia || '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.quien_tiene_la_palabra === 'CLIENTE'
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              : row.quien_tiene_la_palabra === 'ASESOR'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          }`}>
                            {row.quien_tiene_la_palabra || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                            {row.estado_chat || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.semaforo_sla === 'VERDE'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : row.semaforo_sla === 'AMARILLO'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}>
                            {row.semaforo_sla || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 max-w-[220px] truncate" title={row.ultimo_mensaje_texto}>
                          {row.ultimo_mensaje_texto || '-'}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-amber-300/90">
                          {formatDate(row.ultimo_mensaje_fecha || row.cliente_ultima_fecha)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'reprogramaciones' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Fecha Solicitud</th>
                    <th className="py-3 px-4">Fecha Solicitada</th>
                    <th className="py-3 px-4">Turno</th>
                    <th className="py-3 px-4">Motivo</th>
                    <th className="py-3 px-4">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No hay reprogramaciones registradas con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="p-1.5 bg-slate-800 hover:bg-orange-500/20 hover:text-orange-400 text-slate-400 rounded-lg transition-colors"
                            title="Ver detalle completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-white">#{row.id}</td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-slate-400">{formatDate(row.fecha_registro)}</td>
                        <td className="py-2.5 px-4 whitespace-nowrap font-semibold text-amber-300">{formatDate(row.fecha_solicitada)}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">
                            {row.turno || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 max-w-[300px] truncate" title={row.motivo}>{row.motivo || '-'}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{row.token || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Modal para ver registro completo */}
      {selectedRow && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-500" />
                  Detalle Completo del Registro ({activeTab})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mostrando todas las {Object.keys(selectedRow).length} columnas disponibles en la base de datos
                </p>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700 grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(selectedRow).map(([key, value]: [string, any]) => (
                <div key={key} className="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 gap-1 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-orange-400/90 font-mono tracking-wide">{key}</span>
                    {key === 'TipoServicioCalculado' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold">CRUZADO</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-100 font-mono break-all select-all">
                    {value === null || value === undefined || value === '' ? (
                      <span className="text-slate-600 italic">null</span>
                    ) : typeof value === 'object' ? (
                      <pre className="text-[10px] bg-slate-900 p-2 rounded-lg text-emerald-400 overflow-x-auto max-h-48 border border-slate-800 font-mono">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : key.toLowerCase().includes('fecha') || key === 'F.Visita' || key === 'F.Soli' ? (
                      formatDate(value)
                    ) : (
                      String(value)
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedRow(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
