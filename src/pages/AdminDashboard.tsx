import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  FileSpreadsheet, 
  FileCode, 
  Eye, 
  Check,
  RotateCcw,
  CheckCircle2, 
  CalendarClock, 
  Layers,
  MessageSquare,
  MessageCircle,
  User,
  Headset,
  Code,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ExternalLink,
  Sparkles,
  Loader2,
  BarChart3,
  Send,
  Navigation,
  LayoutDashboard,
  PieChart,
  Activity,
  CheckCheck,
  TrendingUp,
  MapPin
} from 'lucide-react';

type TabType = 'principal' | 'reporte' | 'dashboard' | 'encuestas' | 'reprogramaciones' | 'chats_mantra';

const getTodayPeruString = () => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

interface FiltroOpciones {
  tiposTraba: string[];
  productos: string[];
  tiposServicio: Array<{ IDservicio: number; Servicio: string; Tipo: string }>;
  tiposClasificados: string[];
  gruposServicioMantra?: string[];
}

// Parse WhatsApp interactive buttons and links
function renderFormattedChatMessage(rawText: string) {
  if (!rawText) return null;

  // Split buttons if present (e.g. "Text | [Btn 1,url] | [Btn 2]")
  const parts = rawText.split(/\|\s*(?=\[)/);
  const mainText = parts[0].trim();
  const rawButtons = parts.slice(1);

  const parsedButtons: Array<{ text: string; url?: string }> = [];
  rawButtons.forEach(btnStr => {
    const clean = btnStr.trim();
    const match = clean.match(/^\[([^\]]+)\]$/);
    if (match) {
      const inside = match[1];
      if (inside.includes(',')) {
        const [label, ...urlParts] = inside.split(',');
        parsedButtons.push({ text: label.trim(), url: urlParts.join(',').trim() });
      } else {
        parsedButtons.push({ text: inside.trim() });
      }
    }
  });

  return (
    <div className="space-y-2.5">
      <div className="whitespace-pre-wrap leading-relaxed">{mainText}</div>
      {parsedButtons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-700/50 mt-2">
          {parsedButtons.map((btn, bIdx) => (
            btn.url ? (
              <a
                key={bIdx}
                href={btn.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 text-xs font-semibold transition-all hover:scale-105"
              >
                <span>{btn.text}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span
                key={bIdx}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700 text-xs font-medium"
              >
                {btn.text}
              </span>
            )
          ))}
        </div>
      )}
    </div>
  );
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
  const [fechaInicio, setFechaInicio] = useState(getTodayPeruString());
  const [fechaFin, setFechaFin] = useState(getTodayPeruString());
  const [tipoServicio, setTipoServicio] = useState<string[]>([]);
  const [tipoServicioOpen, setTipoServicioOpen] = useState(false);
  const tipoServicioDropdownRef = useRef<HTMLDivElement>(null);
  const [grupoServicio, setGrupoServicio] = useState('');
  const [estadoChatFiltro, setEstadoChatFiltro] = useState('');
  const [updatingChatId, setUpdatingChatId] = useState<number | null>(null);

  // Ordenamiento de columnas (ascendente / descendente)
  const [sortField, setSortField] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Opciones de selects
  const [filtrosOpciones, setFiltrosOpciones] = useState<FiltroOpciones>({
    tiposTraba: [],
    productos: [],
    tiposServicio: [],
    tiposClasificados: [],
    gruposServicioMantra: []
  });

  // Modal para ver registro completo
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [chatViewMode, setChatViewMode] = useState<'bubbles' | 'raw'>('bubbles');
  const [liveChatMessages, setLiveChatMessages] = useState<any[] | null>(null);
  const [liveChatTotal, setLiveChatTotal] = useState<number | null>(null);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [chatLimit, setChatLimit] = useState<number>(15);
  const [dashboardStats, setDashboardStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Endpoint en línea (Azure App Service con soporte para variable de entorno)
  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'https://webwin-api-service-eus.azurewebsites.net';

  // Atajos de teclado interactivos: ESC (cerrar), ArrowLeft/ArrowRight (navegar registros), V (alternar vista)
  useEffect(() => {
    if (!selectedRow) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Omitir si se está escribiendo en campos de formulario
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedRow(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentIdx = data.findIndex(r => 
          (r.id !== undefined && selectedRow.id !== undefined && r.id === selectedRow.id) ||
          (r.OrdenId !== undefined && selectedRow.OrdenId !== undefined && r.OrdenId === selectedRow.OrdenId) ||
          (r.orden_id !== undefined && selectedRow.orden_id !== undefined && r.orden_id === selectedRow.orden_id)
        );
        if (currentIdx > 0) {
          setSelectedRow(data[currentIdx - 1]);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const currentIdx = data.findIndex(r => 
          (r.id !== undefined && selectedRow.id !== undefined && r.id === selectedRow.id) ||
          (r.OrdenId !== undefined && selectedRow.OrdenId !== undefined && r.OrdenId === selectedRow.OrdenId) ||
          (r.orden_id !== undefined && selectedRow.orden_id !== undefined && r.orden_id === selectedRow.orden_id)
        );
        if (currentIdx >= 0 && currentIdx < data.length - 1) {
          setSelectedRow(data[currentIdx + 1]);
        }
      } else if (e.key === 'v' || e.key === 'V') {
        if (activeTab === 'chats_mantra') {
          e.preventDefault();
          setChatViewMode(prev => prev === 'bubbles' ? 'raw' : 'bubbles');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRow, data, activeTab]);

  // Cargar hasta 15 mensajes en vivo directamente desde la API de Mantra al abrir un chat
  useEffect(() => {
    if (!selectedRow || activeTab !== 'chats_mantra' || !selectedRow.phone) {
      setLiveChatMessages(null);
      setLiveChatTotal(null);
      return;
    }

    let isMounted = true;
    setLoadingChat(true);

    fetch(`${apiUrl}/api/4dm1n_/mantra-chat?phone=${encodeURIComponent(selectedRow.phone)}&grupoServicio=${encodeURIComponent(selectedRow.grupo_servicio || '')}&limit=${chatLimit}`)
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(res => {
        if (isMounted && res.success && Array.isArray(res.messages)) {
          setLiveChatMessages(res.messages);
          if (res.total !== undefined) setLiveChatTotal(res.total);
        }
      })
      .catch(err => {
        console.warn('Fallback a historial en BD (Mantra API en vivo no disponible):', err);
      })
      .finally(() => {
        if (isMounted) setLoadingChat(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRow, activeTab, apiUrl, chatLimit]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Actualizar estado del chat (Cerrar / Reabrir)
  const handleToggleEstadoChat = async (id: number, nuevoEstado: 'Cerrado' | 'Abierto') => {
    setUpdatingChatId(id);
    setData(prev => prev.map(item => item.id === id ? { ...item, estado_chat: nuevoEstado } : item));
    if (selectedRow && selectedRow.id === id) {
      setSelectedRow((prev: any) => ({ ...prev, estado_chat: nuevoEstado }));
    }

    try {
      const res = await fetch(`${apiUrl}/api/4dm1n_/chat-estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: nuevoEstado })
      });
      const dataRes = await res.json();
      if (!dataRes.success) {
        throw new Error(dataRes.error || 'Error al actualizar estado del chat');
      }
    } catch (err) {
      console.error('Error al actualizar estado del chat:', err);
      fetchData();
    } finally {
      setUpdatingChatId(null);
    }
  };

  // Cargar catálogo de filtros al inicio
  useEffect(() => {
    fetch(`${apiUrl}/api/4dm1n_/filtros`)
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
            tiposClasificados: res.tiposClasificados || [],
            gruposServicioMantra: res.gruposServicioMantra || ['INSTALACION', 'AVERIAS', 'PROVINCIA', 'POSTVENTA', 'AVERIAS PRV', 'Instalacion', 'Averias']
          });
        }
      })
      .catch(err => {
        console.warn('Advertencia cargando catálogo de filtros:', err);
      });
  }, [apiUrl]);

  // Cerrar dropdown de Tipo de Servicio al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tipoServicioDropdownRef.current && !tipoServicioDropdownRef.current.contains(event.target as Node)) {
        setTipoServicioOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cargar datos al cambiar tab, paginación, ordenamiento o filtros
  const fetchData = async (targetPage = page, customFilters?: any, retryCount = 1) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setErrorMsg(null);
    try {
      const currentTab = customFilters?.activeTab ?? activeTab;
      const currentSort = customFilters?.sortField ?? sortField;
      const currentOrder = customFilters?.sortOrder ?? sortOrder;
      const currentSearch = customFilters?.search ?? search;
      const currentFInicio = customFilters?.fechaInicio ?? fechaInicio;
      const currentFFin = customFilters?.fechaFin ?? fechaFin;
      const currentTipoRaw = customFilters?.tipoServicio ?? tipoServicio;
      const currentTipo: string[] = Array.isArray(currentTipoRaw) 
        ? currentTipoRaw 
        : typeof currentTipoRaw === 'string' && currentTipoRaw 
          ? [currentTipoRaw] 
          : [];
      const currentGrupo = customFilters?.grupoServicio ?? grupoServicio;
      const currentEstado = customFilters?.estadoChatFiltro ?? estadoChatFiltro;

      const params = new URLSearchParams({
        tabla: currentTab,
        page: String(targetPage),
        limit: String(limit),
        sortBy: currentSort === 'id' && currentTab === 'reporte' ? 'fecha_visita' : currentSort,
        sortOrder: currentOrder
      });

      if (currentSearch) params.append('search', currentSearch);
      if (currentFInicio) params.append('fechaInicio', currentFInicio);
      if (currentFFin) params.append('fechaFin', currentFFin);
      if (currentTipo.length > 0 && (currentTab === 'principal' || currentTab === 'reporte')) {
        params.append('tipoServicio', currentTipo.join(','));
      }
      if (currentGrupo && currentTab === 'chats_mantra') params.append('grupoServicio', currentGrupo);
      if (currentEstado && currentTab === 'chats_mantra') params.append('estadoChat', currentEstado);

      const res = await fetch(`${apiUrl}/api/4dm1n_/data?${params.toString()}`, {
        signal: controller.signal
      });
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
      if (err.name === 'AbortError') {
        return; // Petición cancelada intencionalmente
      }
      if (retryCount > 0) {
        console.warn('Reintentando consulta admin/data por micro-corte o socket timeout...');
        await new Promise(r => setTimeout(r, 1200));
        return fetchData(targetPage, customFilters, retryCount - 1);
      }
      console.error('Error cargando datos de BD:', err);
      setErrorMsg(err.message || 'No se pudo conectar con el servidor backend');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Cargar métricas ejecutivas del Dashboard
  const fetchDashboardStats = async (customFilters?: any, retryCount = 1) => {
    setLoadingStats(true);
    setErrorMsg(null);
    try {
      const currentSearch = customFilters?.search ?? search;
      const currentFInicio = customFilters?.fechaInicio ?? fechaInicio;
      const currentFFin = customFilters?.fechaFin ?? fechaFin;
      const currentTipoRaw = customFilters?.tipoServicio ?? tipoServicio;
      const currentTipo: string[] = Array.isArray(currentTipoRaw)
        ? currentTipoRaw
        : typeof currentTipoRaw === 'string' && currentTipoRaw
          ? [currentTipoRaw]
          : [];

      const params = new URLSearchParams();
      if (currentSearch) params.append('search', currentSearch);
      if (currentFInicio) params.append('fechaInicio', currentFInicio);
      if (currentFFin) params.append('fechaFin', currentFFin);
      if (currentTipo.length > 0) params.append('tipoServicio', currentTipo.join(','));

      const res = await fetch(`${apiUrl}/api/4dm1n_/dashboard-stats?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`El servidor (${apiUrl}) respondió con error ${res.status} (${res.statusText})`);
      }
      const json = await res.json();
      if (json.success) {
        setDashboardStats(json);
      } else {
        throw new Error(json.message || 'Error desconocido al consultar estadísticas');
      }
    } catch (err: any) {
      if (retryCount > 0) {
        console.warn('Reintentando consulta dashboard-stats por micro-corte...');
        await new Promise(r => setTimeout(r, 1200));
        return fetchDashboardStats(customFilters, retryCount - 1);
      }
      console.error('Error cargando estadísticas de dashboard:', err);
      setErrorMsg(err.message || 'No se pudo conectar con el servidor backend');
      setDashboardStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
    } else {
      setPage(1);
      fetchData(1);
    }
  }, [activeTab, limit, grupoServicio, sortField, sortOrder, apiUrl]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
    } else {
      setPage(1);
      fetchData(1);
    }
  };

  const handleResetFilters = () => {
    const today = getTodayPeruString();
    const defaultSort = activeTab === 'reporte' ? 'fecha_visita' : 'id';
    setSearch('');
    setFechaInicio(today);
    setFechaFin(today);
    setTipoServicio([]);
    setGrupoServicio('');
    setEstadoChatFiltro('');
    setSortField(defaultSort);
    setSortOrder('desc');
    setPage(1);
    const resetObj = {
      search: '',
      fechaInicio: today,
      fechaFin: today,
      tipoServicio: [] as string[],
      grupoServicio: '',
      estadoChatFiltro: '',
      sortField: defaultSort,
      sortOrder: 'desc'
    };
    if (activeTab === 'dashboard') {
      fetchDashboardStats(resetObj);
    } else {
      fetchData(1, resetObj);
    }
  };

  // Función para alternar ordenamiento de columna
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Ordenamiento local instantáneo sobre las filas visibles
  const displayData = useMemo(() => {
    if (!sortField || data.length === 0) return data;
    return [...data].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      // Si es número
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && typeof valA !== 'string') {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      // Si es fecha
      const dateA = new Date(valA).getTime();
      const dateB = new Date(valB).getTime();
      if (!isNaN(dateA) && !isNaN(dateB) && (String(sortField).includes('fecha') || sortField.startsWith('F.'))) {
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // Comparación alfabética
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortField, sortOrder]);

  // Mensajes parseados para la vista amigable de chat (prioriza mensajes en vivo de Mantra si existen)
  const parsedChatMessages = useMemo(() => {
    if (liveChatMessages && Array.isArray(liveChatMessages) && liveChatMessages.length > 0) {
      return [...liveChatMessages].sort((a, b) => {
        const timeA = new Date(a.fecha_utc || 0).getTime();
        const timeB = new Date(b.fecha_utc || 0).getTime();
        if (timeA && timeB) return timeA - timeB;
        return (a.orden || 0) - (b.orden || 0);
      });
    }

    if (!selectedRow?.ultimos_mensajes_json) return [];
    try {
      const raw = typeof selectedRow.ultimos_mensajes_json === 'string'
        ? JSON.parse(selectedRow.ultimos_mensajes_json)
        : selectedRow.ultimos_mensajes_json;
      if (!Array.isArray(raw)) return [];

      // Orden cronológico natural: de más antiguo a más reciente (arriba -> abajo)
      return [...raw].sort((a, b) => {
        const timeA = new Date(a.fecha_utc || 0).getTime();
        const timeB = new Date(b.fecha_utc || 0).getTime();
        if (timeA && timeB) return timeA - timeB;
        return (b.orden || 0) - (a.orden || 0);
      });
    } catch {
      return [];
    }
  }, [selectedRow, liveChatMessages]);

  // Descargar archivo (CSV o JSON)
  const handleDownload = (format: 'csv' | 'json') => {
    const params = new URLSearchParams({
      tabla: activeTab,
      format,
      sortBy: sortField === 'id' && activeTab === 'reporte' ? 'fecha_visita' : sortField,
      sortOrder: sortOrder
    });

    if (search) params.append('search', search);
    if (fechaInicio) params.append('fechaInicio', fechaInicio);
    if (fechaFin) params.append('fechaFin', fechaFin);
    if (tipoServicio.length > 0 && (activeTab === 'principal' || activeTab === 'reporte')) {
      params.append('tipoServicio', tipoServicio.join(','));
    }
    if (grupoServicio && activeTab === 'chats_mantra') params.append('grupoServicio', grupoServicio);
    if (estadoChatFiltro && activeTab === 'chats_mantra') params.append('estadoChat', estadoChatFiltro);

    window.open(`${apiUrl}/api/4dm1n_/export?${params.toString()}`, '_blank');
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

  // Renderizar indicador de ordenamiento en cabeceras de tabla
  const renderSortIndicator = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 hover:text-slate-300 transition-colors inline ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-orange-400 font-bold inline ml-1 animate-in fade-in duration-200" />
    ) : (
      <ArrowDown className="w-3 h-3 text-orange-400 font-bold inline ml-1 animate-in fade-in duration-200" />
    );
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
            
          </div>
        </div>

        {/* Acciones de exportación */}
        <div className="flex flex-wrap items-center gap-2">
          

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
      <main className="flex-1 p-6 max-w-[1750px] w-full mx-auto flex flex-col gap-5">
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
            onClick={() => {
              setActiveTab('reporte');
              if (sortField === 'id') setSortField('fecha_visita');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'reporte'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Reporte</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              activeTab === 'dashboard'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
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
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur relative z-30">
          <form onSubmit={handleSearchSubmit} className={`grid grid-cols-1 md:grid-cols-2 ${activeTab === 'chats_mantra' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3 relative z-30`}>
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
                      : activeTab === 'reporte' || activeTab === 'dashboard'
                      ? 'OT, Ticket, Cliente, Teléfono, Cuadrilla, Distrito...'
                      : 'Token, comentario, motivo...'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Fecha Inicio */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                {activeTab === 'principal' || activeTab === 'reporte' || activeTab === 'dashboard' ? 'Fecha Visita Desde' : activeTab === 'chats_mantra' ? 'Fecha Gestión/Msg Desde' : 'Fecha Desde'}
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
                {activeTab === 'principal' || activeTab === 'reporte' || activeTab === 'dashboard' ? 'Fecha Visita Hasta' : activeTab === 'chats_mantra' ? 'Fecha Gestión/Msg Hasta' : 'Fecha Hasta'}
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

            {/* Tipo de Servicio (Visible en Principal, Reporte y Dashboard) con Selección Múltiple */}
            {(activeTab === 'principal' || activeTab === 'reporte' || activeTab === 'dashboard') && (
              <div className="relative z-40" ref={tipoServicioDropdownRef}>
                <label className="text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                  <span>Tipo de Servicio / Trabajo</span>
                  {tipoServicio.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTipoServicio([]);
                      }}
                      className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Limpiar ({tipoServicio.length})
                    </button>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setTipoServicioOpen(prev => !prev)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between focus:outline-none focus:border-orange-500 transition-colors text-left"
                >
                  <span className="truncate">
                    {tipoServicio.length === 0
                      ? 'Todos los tipos'
                      : tipoServicio.length === 1
                      ? (tipoServicio[0].includes(':') ? tipoServicio[0].split(':')[1] : tipoServicio[0])
                      : `${tipoServicio.length} tipos seleccionados`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${tipoServicioOpen ? 'rotate-180' : ''}`} />
                </button>

                {tipoServicioOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-72 min-w-[280px] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-2 backdrop-blur">
                    <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-800 text-[11px]">
                      <span className="text-slate-400 font-medium">Selección Múltiple</span>
                      {tipoServicio.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTipoServicio([])}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          Deseleccionar todo
                        </button>
                      )}
                    </div>

                    {filtrosOpciones.tiposClasificados.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider px-1 py-1">
                          Tipos Cruzados (tiposervicio)
                        </div>
                        <div className="space-y-0.5">
                          {filtrosOpciones.tiposClasificados.map(tc => {
                            const val = `tipo:${tc}`;
                            const isChecked = tipoServicio.includes(val);
                            return (
                              <label
                                key={tc}
                                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-200 transition-colors select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setTipoServicio(prev =>
                                      isChecked ? prev.filter(x => x !== val) : [...prev, val]
                                    );
                                  }}
                                  className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="truncate">{tc}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {filtrosOpciones.tiposTraba.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 py-1 border-t border-slate-800/60 pt-1.5">
                          Tipos de Trabajo (vw)
                        </div>
                        <div className="space-y-0.5">
                          {filtrosOpciones.tiposTraba.map(t => {
                            const val = `trabajo:${t}`;
                            const isChecked = tipoServicio.includes(val);
                            return (
                              <label
                                key={t}
                                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-200 transition-colors select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setTipoServicio(prev =>
                                      isChecked ? prev.filter(x => x !== val) : [...prev, val]
                                    );
                                  }}
                                  className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="truncate">{t}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {filtrosOpciones.productos.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 py-1 border-t border-slate-800/60 pt-1.5">
                          Productos (vw)
                        </div>
                        <div className="space-y-0.5">
                          {filtrosOpciones.productos.map(p => {
                            const val = `producto:${p}`;
                            const isChecked = tipoServicio.includes(val);
                            return (
                              <label
                                key={p}
                                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800 cursor-pointer text-xs text-slate-200 transition-colors select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setTipoServicio(prev =>
                                      isChecked ? prev.filter(x => x !== val) : [...prev, val]
                                    );
                                  }}
                                  className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="truncate">{p}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Filtro Grupo de Servicio (Solo visible en Historial Chats Mantra) */}
            {activeTab === 'chats_mantra' && (
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Grupo de Servicio</label>
                <select
                  value={grupoServicio}
                  onChange={e => {
                    setGrupoServicio(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="">Todos los grupos de servicio</option>
                  <optgroup label="Tipos de Servicio (Operación)">
                    <option value="INSTALACION">INSTALACION (Lima)</option>
                    <option value="AVERIAS">AVERIAS (Lima)</option>
                    <option value="PROVINCIA">PROVINCIA (Instalación)</option>
                    <option value="POSTVENTA">POSTVENTA</option>
                    <option value="AVERIAS PRV">AVERIAS PRV (Provincia)</option>
                  </optgroup>
                  <optgroup label="Canales de WhatsApp Mantra">
                    <option value="Instalacion">Canal Instalacion (Todo)</option>
                    <option value="Averias">Canal Averias (Todo)</option>
                  </optgroup>
                </select>
              </div>
            )}

            {/* Filtro Estado Chat (Solo visible en Historial Chats Mantra) */}
            {activeTab === 'chats_mantra' && (
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Estado Chat</label>
                <select
                  value={estadoChatFiltro}
                  onChange={e => {
                    setEstadoChatFiltro(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="">Todos los estados</option>
                  <option value="Abierto">Abierto (Cliente sin resp.)</option>
                  <option value="Pendiente">Pendiente (Plantilla)</option>
                  <option value="Sin Respuesta">Sin Respuesta (Asesor)</option>
                  <option value="Cerrado">Cerrado (Sin pendientes)</option>
                </select>
              </div>
            )}

            {/* Botones de acción */}
            <div className={`flex items-end gap-2 ${(activeTab !== 'principal' && activeTab !== 'chats_mantra' && activeTab !== 'reporte' && activeTab !== 'dashboard') ? 'lg:col-span-2' : ''}`}>
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
                onClick={() => activeTab === 'dashboard' ? fetchDashboardStats() : fetchData()}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all active:scale-95"
                title="Refrescar datos"
              >
                <RefreshCw className={`w-4 h-4 ${(loading || loadingStats) ? 'animate-spin text-orange-400' : ''}`} />
              </button>
            </div>
          </form>
        </div>

        {/* Resumen y paginación superior */}
        {activeTab !== 'dashboard' ? (
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 px-1 relative z-10">
            <div className="flex items-center gap-3">
              <div>
                Mostrando <span className="font-semibold text-white">{displayData.length}</span> de <span className="font-semibold text-orange-400">{total.toLocaleString()}</span> registros encontrados
              </div>
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
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-slate-200">Panel Ejecutivo de Métricas y Monitoreo Mantra</span>
            </div>
            {dashboardStats?.kpis && (
              <span className="text-xs text-slate-400">
                Total Órdenes Evaluadas: <strong className="text-white font-mono">{Number(dashboardStats.kpis.total_ots || 0).toLocaleString()}</strong>
              </span>
            )}
          </div>
        )}

        {/* 1. Vista Dashboard Ejecutivo vs 2. Tablas de Resultados */}
        {activeTab === 'dashboard' ? (
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
                const avanceDiarioList: Array<any> = dashboardStats.avanceDiario || [];

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
        ) : (
          /* Tabla de Resultados */
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur relative min-h-[400px] z-10">
            {loading && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs text-slate-300 font-medium">Cargando registros de la base de datos...</p>
              </div>
            )}

            <div className="overflow-x-auto max-h-[650px] scrollbar-thin scrollbar-thumb-slate-700">
              {/* 1. Tabla Principal */}
              {activeTab === 'principal' && (
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th onClick={() => handleSort('OrdenId')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Orden ID {renderSortIndicator('OrdenId')}
                    </th>
                    <th onClick={() => handleSort('TipoServicioCalculado')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Tipo Servicio {renderSortIndicator('TipoServicioCalculado')}
                    </th>
                    <th onClick={() => handleSort('Cliente')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Cliente {renderSortIndicator('Cliente')}
                    </th>
                    <th onClick={() => handleSort('NumeroDocumento')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Documento {renderSortIndicator('NumeroDocumento')}
                    </th>
                    <th onClick={() => handleSort('FechaVisita')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Fecha Visita {renderSortIndicator('FechaVisita')}
                    </th>
                    <th onClick={() => handleSort('TipoTraba')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Tipo Trabajo {renderSortIndicator('TipoTraba')}
                    </th>
                    <th onClick={() => handleSort('Producto')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Producto {renderSortIndicator('Producto')}
                    </th>
                    <th onClick={() => handleSort('Estado')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Estado {renderSortIndicator('Estado')}
                    </th>
                    <th onClick={() => handleSort('Localidad')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Localidad / Zona {renderSortIndicator('Localidad')}
                    </th>
                    <th onClick={() => handleSort('Cuadrilla_nombre')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Cuadrilla {renderSortIndicator('Cuadrilla_nombre')}
                    </th>
                    <th className="py-3 px-4">PIN</th>
                    <th className="py-3 px-4">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayData.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-500">
                        No se encontraron registros con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    displayData.map((row, idx) => (
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

            {/* 2. Reporte Funnel Casos 360 (Monitoreo de Chats y Tracking) */}
            {activeTab === 'reporte' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th onClick={() => handleSort('orden_id')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Orden / Ticket {renderSortIndicator('orden_id')}
                    </th>
                    <th onClick={() => handleSort('cliente')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Cliente {renderSortIndicator('cliente')}
                    </th>
                    <th onClick={() => handleSort('telefono')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Teléfono {renderSortIndicator('telefono')}
                    </th>
                    <th onClick={() => handleSort('tipo_operacion')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Operación / Trabajo {renderSortIndicator('tipo_operacion')}
                    </th>
                    <th onClick={() => handleSort('estado_ot')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Estado OT {renderSortIndicator('estado_ot')}
                    </th>
                    <th onClick={() => handleSort('fecha_visita')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Fecha Visita {renderSortIndicator('fecha_visita')}
                    </th>
                    <th onClick={() => handleSort('distrito')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Distrito / Cuadrilla {renderSortIndicator('distrito')}
                    </th>
                    <th onClick={() => handleSort('se_envio_wsp')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      WhatsApp {renderSortIndicator('se_envio_wsp')}
                    </th>
                    <th onClick={() => handleSort('ingreso_tracking')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Tracking / Mapa {renderSortIndicator('ingreso_tracking')}
                    </th>
                    <th onClick={() => handleSort('reprogramo')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Reprogramó {renderSortIndicator('reprogramo')}
                    </th>
                    <th onClick={() => handleSort('respondio_encuesta')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Encuesta {renderSortIndicator('respondio_encuesta')}
                    </th>
                    <th onClick={() => handleSort('pulso_soporte')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Soporte {renderSortIndicator('pulso_soporte')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayData.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-500">
                        No se encontraron registros en el Reporte Funnel 360 con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    displayData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedRow(row)}
                              className="p-1.5 bg-slate-800 hover:bg-orange-500/20 hover:text-orange-400 text-slate-400 rounded-lg transition-colors"
                              title="Ver ficha completa 360°"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {(row.link_tracking || row.link || row.token) && (
                              <a
                                href={row.link_tracking || row.link || `https://enruta.win.pe/seguimiento/${row.token}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-400 rounded-lg transition-colors"
                                title="Abrir link de seguimiento en vivo"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-mono font-bold text-white">{row.orden_id ?? row.OrdenId ?? row.id ?? '-'}</div>
                          {(row.ticket || row.Ticket || row.CodiSegui) && (
                            <div className="text-[10px] text-slate-400 font-mono">Tk: {row.ticket || row.Ticket || row.CodiSegui}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 max-w-[180px] truncate font-medium text-slate-100" title={row.cliente || row.Cliente}>
                          {row.cliente || row.Cliente || '-'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {row.telefono || row.Telefono || row.TeleMovilNume || row.phone || '-'}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-semibold text-slate-200 border border-slate-700">
                            {row.tipo_operacion || row.TipoServicioCalculado || row.tipo_trabajo || row.TipoTraba || row.producto || row.Producto || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            String(row.estado_ot || row.Estado || row['Estado OT']).toLowerCase().includes('fin') || String(row.estado_ot || row.Estado || row['Estado OT']).toLowerCase().includes('liquid')
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : String(row.estado_ot || row.Estado || row['Estado OT']).toLowerCase().includes('inic') || String(row.estado_ot || row.Estado || row['Estado OT']).toLowerCase().includes('ruta')
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {row.estado_ot || row.Estado || row['Estado OT'] || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-amber-300/90 font-mono text-[11px]">
                          {formatDate(row.fecha_visita || row.FechaVisita || row['F.Visita'] || row.fecha_solicitud || row['F.Soli'])}
                        </td>
                        <td className="py-2.5 px-4 text-slate-300">
                          <div>{row.distrito || row.Distrito || row.Localidad || '-'}</div>
                          {(row.cuadrilla || row.Cuadrilla_nombre) && (
                            <div className="text-[10px] text-slate-400">{row.cuadrilla || row.Cuadrilla_nombre}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {row.se_envio_wsp === 'SI' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                                <Send className="w-2.5 h-2.5" /> ENVIADO
                              </span>
                              {row.estado_wsp && <span className="text-[9px] text-slate-400 truncate max-w-[110px]">{row.estado_wsp}</span>}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700/60">
                              NO ENVIADO
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {row.ingreso_tracking === 'SI' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
                              <Navigation className="w-2.5 h-2.5" /> INGRESÓ ({row.vistas_mapa_seguimiento || 0})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-500 text-[10px]">
                              NO INGRESÓ
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {row.reprogramo === 'SI' ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                              REPROGRAMADO
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {row.respondio_encuesta === 'SI' ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                              ★ {row.satisfaccion_general || 'SÍ'}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {row.pulso_soporte === 'SI' ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                              SOPORTE ({row.veces_pulso_soporte || 1})
                            </span>
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
            {activeTab === 'chats_mantra' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th onClick={() => handleSort('id')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      ID {renderSortIndicator('id')}
                    </th>
                    <th onClick={() => handleSort('orden_id')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Orden ID {renderSortIndicator('orden_id')}
                    </th>
                    <th onClick={() => handleSort('ticket')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Ticket {renderSortIndicator('ticket')}
                    </th>
                    <th onClick={() => handleSort('phone')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Teléfono {renderSortIndicator('phone')}
                    </th>
                    <th onClick={() => handleSort('cliente_nombre')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Cliente {renderSortIndicator('cliente_nombre')}
                    </th>
                    <th onClick={() => handleSort('asesor_asignado')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Usuario {renderSortIndicator('asesor_asignado')}
                    </th>
                    <th onClick={() => handleSort('grupo_servicio')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Grupo Serv. {renderSortIndicator('grupo_servicio')}
                    </th>
                    <th onClick={() => handleSort('distrito')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Distrito / Prov. {renderSortIndicator('distrito')}
                    </th>
                    <th onClick={() => handleSort('quien_tiene_la_palabra')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Palabra {renderSortIndicator('quien_tiene_la_palabra')}
                    </th>
                    <th onClick={() => handleSort('estado_chat')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Estado Chat {renderSortIndicator('estado_chat')}
                    </th>
                    <th onClick={() => handleSort('semaforo_sla')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      SLA {renderSortIndicator('semaforo_sla')}
                    </th>
                    <th onClick={() => handleSort('ultimo_mensaje_texto')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Último Mensaje {renderSortIndicator('ultimo_mensaje_texto')}
                    </th>
                    <th onClick={() => handleSort('ultimo_mensaje_fecha')} className="py-3 px-4 cursor-pointer hover:text-white select-none whitespace-nowrap">
                      Fecha Último Msg {renderSortIndicator('ultimo_mensaje_fecha')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayData.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-slate-500">
                        No hay chats de Mantra registrados con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    displayData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <button
                            onClick={() => {
                              setSelectedRow(row);
                              setChatViewMode('bubbles');
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-orange-500/20 hover:text-orange-400 text-slate-400 rounded-lg transition-colors flex items-center gap-1"
                            title="Ver conversación de chat y detalle completo"
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
                        <td className="py-2.5 px-4 max-w-[160px] truncate text-[11px] font-mono text-slate-300" title={row.asesor_asignado || 'Sin asignar'}>
                          {row.asesor_asignado ? (
                            <span className="px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700/80 text-slate-200 truncate block">
                              {row.asesor_asignado}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic text-[10px]">Sin asignar</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block w-fit ${
                              row.tipo_trabajo === 'INSTALACION' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                              row.tipo_trabajo === 'AVERIAS' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' :
                              row.tipo_trabajo === 'PROVINCIA' ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' :
                              row.tipo_trabajo === 'POSTVENTA' ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' :
                              row.tipo_trabajo === 'AVERIAS PRV' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                              'bg-slate-700/30 text-slate-300 border-slate-600/30'
                            }`}>
                              {row.tipo_trabajo || row.grupo_servicio || '-'}
                            </span>
                            
                          </div>
                        </td>
                        <td className="py-2.5 px-4 max-w-[150px] truncate" title={`${row.distrito || ''} ${row.provincia ? `(${row.provincia})` : ''}`}>
                          {row.distrito || row.provincia || '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            row.quien_tiene_la_palabra === 'CLIENTE'
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              : row.quien_tiene_la_palabra === 'PLANTILLA' || row.quien_tiene_la_palabra === 'BOT'
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              : 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                          }`}>
                            {row.quien_tiene_la_palabra === 'CLIENTE' ? 'CLIENTE' :
                             (row.quien_tiene_la_palabra === 'PLANTILLA' || row.quien_tiene_la_palabra === 'BOT') ? 'PLANTILLA' :
                             'ASESOR'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                              row.estado_chat === 'Cerrado'
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : row.estado_chat === 'Abierto'
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : row.estado_chat === 'Pendiente'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            }`}>
                              {row.estado_chat === 'Cerrado' && <Check className="w-3 h-3 text-emerald-400" />}
                              {row.estado_chat === 'Abierto' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
                              {row.estado_chat || '-'}
                            </span>
                            {row.estado_chat === 'Cerrado' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleEstadoChat(row.id, 'Abierto');
                                }}
                                disabled={updatingChatId === row.id}
                                className="p-1 hover:bg-slate-800 text-slate-500 hover:text-amber-400 rounded transition-colors text-[10px]"
                                title="Reabrir chat"
                              >
                                <RotateCcw className={`w-3 h-3 ${updatingChatId === row.id ? 'animate-spin text-orange-400' : ''}`} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleEstadoChat(row.id, 'Cerrado');
                                }}
                                disabled={updatingChatId === row.id}
                                className="px-2 py-0.5 bg-slate-800 hover:bg-emerald-600/30 hover:text-emerald-300 text-slate-400 border border-slate-700 rounded-md transition-colors text-[10px] font-medium flex items-center gap-1"
                                title="Cerrar chat (marcar sin pendientes)"
                              >
                                <Check className="w-3 h-3" />
                                Cerrar
                              </button>
                            )}
                          </div>
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

            {/* 3. Encuestas */}
            {activeTab === 'encuestas' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th onClick={() => handleSort('id')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      ID {renderSortIndicator('id')}
                    </th>
                    <th onClick={() => handleSort('fecha_registro')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Fecha Registro {renderSortIndicator('fecha_registro')}
                    </th>
                    <th className="py-3 px-4">Concretada</th>
                    <th onClick={() => handleSort('satisfaccion_general')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Satisfacción {renderSortIndicator('satisfaccion_general')}
                    </th>
                    <th className="py-3 px-4">Trato</th>
                    <th className="py-3 px-4">Puntualidad</th>
                    <th className="py-3 px-4">Claridad</th>
                    <th className="py-3 px-4">Comentarios</th>
                    <th className="py-3 px-4">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayData.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        No hay encuestas registradas con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    displayData.map((row, idx) => (
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

            {/* 4. Reprogramaciones */}
            {activeTab === 'reprogramaciones' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Acción</th>
                    <th onClick={() => handleSort('id')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      ID {renderSortIndicator('id')}
                    </th>
                    <th onClick={() => handleSort('fecha_registro')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Fecha Solicitud {renderSortIndicator('fecha_registro')}
                    </th>
                    <th onClick={() => handleSort('fecha_solicitada')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Fecha Solicitada {renderSortIndicator('fecha_solicitada')}
                    </th>
                    <th onClick={() => handleSort('turno')} className="py-3 px-4 cursor-pointer hover:text-white select-none">
                      Turno {renderSortIndicator('turno')}
                    </th>
                    <th className="py-3 px-4">Motivo</th>
                    <th className="py-3 px-4">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayData.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No hay reprogramaciones registradas con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    displayData.map((row, idx) => (
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
        )}
      </main>

      {/* Modal para ver registro completo + Visor Amigable de Chat (Campos a la izquierda, Chat más grande a la derecha) */}
      {selectedRow && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-[98vw] max-w-[1720px] h-[94vh] shadow-2xl relative flex flex-col overflow-hidden">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-slate-800/90 px-5 py-3.5 bg-slate-900/90 backdrop-blur flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl shadow-inner flex-shrink-0">
                  {activeTab === 'chats_mantra' ? <MessageCircle className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white flex items-center gap-2 truncate">
                    {activeTab === 'chats_mantra' ? 'Ficha Técnica & Conversación Mantra' : activeTab === 'reporte' ? 'Ficha Técnica Funnel 360°' : `Detalle Completo del Registro (${activeTab})`}
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-orange-400 border border-slate-700 font-mono">
                      #{selectedRow.id || selectedRow.OrdenId || selectedRow.orden_id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {selectedRow.cliente_nombre || selectedRow.cliente || selectedRow.Cliente ? (
                      <strong className="text-slate-200">{selectedRow.cliente_nombre || selectedRow.cliente || selectedRow.Cliente}</strong>
                    ) : 'Registro'} 
                    {selectedRow.ticket ? ` · Ticket: ${selectedRow.ticket}` : ''} 
                    {selectedRow.phone || selectedRow.telefono ? ` · Teléfono: ${selectedRow.phone || selectedRow.telefono}` : ''}
                    {selectedRow.grupo_servicio ? ` · Grupo: ${selectedRow.grupo_servicio}` : ''}
                    {selectedRow.cuadrilla ? ` · Cuadrilla: ${selectedRow.cuadrilla}` : ''}
                  </p>
                </div>
              </div>
              {/* Controles de Navegación entre Filas y Atajos */}
                {activeTab === 'chats_mantra' && selectedRow?.id && (
                  selectedRow.estado_chat === 'Cerrado' ? (
                    <button
                      type="button"
                      onClick={() => handleToggleEstadoChat(selectedRow.id, 'Abierto')}
                      disabled={updatingChatId === selectedRow.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${updatingChatId === selectedRow.id ? 'animate-spin' : ''}`} />
                      Reabrir Chat
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleEstadoChat(selectedRow.id, 'Cerrado')}
                      disabled={updatingChatId === selectedRow.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-950 transition-all active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Cerrar Chat
                    </button>
                  )
                )}
              <div className="flex items-center gap-2 flex-shrink-0">
                {(() => {
                  const currentIdx = data.findIndex(r => 
                    (r.id !== undefined && selectedRow.id !== undefined && r.id === selectedRow.id) ||
                    (r.OrdenId !== undefined && selectedRow.OrdenId !== undefined && r.OrdenId === selectedRow.OrdenId) ||
                    (r.orden_id !== undefined && selectedRow.orden_id !== undefined && r.orden_id === selectedRow.orden_id)
                  );
                  const hasPrev = currentIdx > 0;
                  const hasNext = currentIdx >= 0 && currentIdx < data.length - 1;

                  return (
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400">
                      <span className="text-slate-500 font-mono text-[10px]">
                        {currentIdx >= 0 ? `${currentIdx + 1} de ${data.length}` : ''}
                      </span>
                      <div className="flex items-center gap-0.5 ml-1">
                        <button
                          type="button"
                          onClick={() => hasPrev && setSelectedRow(data[currentIdx - 1])}
                          disabled={!hasPrev}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                          title="Fila anterior (Tecla ←)"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => hasNext && setSelectedRow(data[currentIdx + 1])}
                          disabled={!hasNext}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                          title="Fila siguiente (Tecla →)"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="h-3 w-px bg-slate-800 mx-1"></div>
                      <span className="flex items-center gap-1 text-[10px]">
                        <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-mono text-[9px]">ESC</kbd>
                      </span>
                    </div>
                  );
                })()}

                <button
                  onClick={() => setSelectedRow(null)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all active:scale-95"
                  title="Cerrar ventana (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cuerpo del Modal: Campos a la Izquierda | Chat Expandido a la Derecha */}
            <div className="flex-1 p-3 sm:p-4 overflow-hidden flex flex-col md:flex-row gap-4 min-h-0 bg-slate-950/60">
              
              {/* COLUMNA IZQUIERDA: Campos y Metadatos de BD (Ancho ergonómico fijo en desktop con scroll independiente) */}
              <div className={`${activeTab === 'chats_mantra' ? 'w-full md:w-[380px] lg:w-[420px] xl:w-[460px] flex-shrink-0' : 'w-full'} flex flex-col min-h-0 bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 shadow-sm`}>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-orange-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Campos y Metadatos ({Object.keys(selectedRow).length})
                    </h4>
                  </div>
                  {selectedRow.estado_chat && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                      {selectedRow.estado_chat}
                    </span>
                  )}
                </div>

                {selectedRow.link_tracking && (
                  <div className="p-3 mb-3 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-500/30 rounded-xl flex items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Navigation className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">Enlace de Seguimiento en Vivo</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{selectedRow.link_tracking}</div>
                      </div>
                    </div>
                    <a
                      href={selectedRow.link_tracking}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-medium transition-all shadow-md active:scale-95 flex-shrink-0"
                    >
                      <span>Abrir Seguimiento</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin scrollbar-thumb-slate-700 min-h-0">
                  {Object.entries(selectedRow).map(([key, value]: [string, any]) => {
                    // Si hay chat formateado a la derecha, ocultar el JSON gigante de la lista izquierda
                    if (key === 'ultimos_mensajes_json' && parsedChatMessages.length > 0) {
                      return null;
                    }
                    return (
                      <div key={key} className="flex flex-col p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 gap-1 hover:border-slate-700 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-orange-400/90 font-mono tracking-wide">{key}</span>
                          {key === 'TipoServicioCalculado' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold">CRUZADO</span>
                          )}
                          {key === 'semaforo_sla' && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              value === 'VERDE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              value === 'AMARILLO' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {value}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-100 font-mono break-all select-all">
                          {value === null || value === undefined || value === '' ? (
                            <span className="text-slate-600 italic">null</span>
                          ) : typeof value === 'object' ? (
                            <pre className="text-[10px] bg-slate-900 p-2 rounded-lg text-emerald-400 overflow-x-auto max-h-40 border border-slate-800 font-mono">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : key.toLowerCase().includes('fecha') || key === 'F.Visita' || key === 'F.Soli' ? (
                            formatDate(value)
                          ) : (
                            String(value)
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COLUMNA DERECHA: Ventana de Chat Expandida (WhatsApp Mantra) */}
              {activeTab === 'chats_mantra' && (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 shadow-xl">
                  {parsedChatMessages.length > 0 ? (
                    <>
                      {/* Header del Chat */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3 flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl relative">
                            <MessageCircle className="w-5 h-5" />
                            {loadingChat && (
                              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              Hilo de Conversación WhatsApp Mantra
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                                {parsedChatMessages.length} {liveChatMessages ? 'mensajes en vivo' : 'mensajes en BD'}
                              </span>
                              {(liveChatTotal || selectedRow.total_mensajes) && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                                  {liveChatTotal || selectedRow.total_mensajes} total en hilo
                                </span>
                              )}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Cliente: <strong className="text-slate-200">{selectedRow.cliente_nombre || 'Cliente'}</strong> ({selectedRow.phone}) · Último emisor: <strong className="text-orange-400">{selectedRow.ultimo_mensaje_emisor || '-'}</strong>
                            </p>
                          </div>
                        </div>

                        {/* Controles de Límite y Selector de Vista */}
                        <div className="flex items-center gap-2">
                          {/* Selector de límite de mensajes (15 o 30) */}
                          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setChatLimit(15)}
                              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                                chatLimit === 15 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              15 msgs
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatLimit(30)}
                              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                                chatLimit === 30 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              30 msgs
                            </button>
                          </div>

                          {/* Selector de Vista: Burbujas vs JSON */}
                          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setChatViewMode('bubbles')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                chatViewMode === 'bubbles'
                                  ? 'bg-orange-500 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Vista Chat</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatViewMode('raw')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                chatViewMode === 'raw'
                                  ? 'bg-orange-500 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <Code className="w-3.5 h-3.5" />
                              <span>JSON Crudo</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Notificación Informativa si el hilo histórico contiene más mensajes */}
                      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 mb-3 flex-shrink-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-orange-400 font-bold">ℹ️ Contexto Ampliado:</span> 
                          Mostrando hasta {chatLimit} mensajes {liveChatMessages ? 'directamente de la API de Mantra en tiempo real' : 'guardados en BD'}.
                        </span>
                        {loadingChat && (
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Sincronizando Mantra...
                          </span>
                        )}
                      </div>

                      {/* Contenedor Grande de Mensajes (Ocupa toda la altura y ancho) */}
                      {chatViewMode === 'bubbles' ? (
                        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 scrollbar-thin scrollbar-thumb-slate-700 min-h-0">
                          {parsedChatMessages.map((msg: any, mIdx: number) => {
                            const isCliente = msg.emisor === 'CLIENTE' || msg.emisor_rol === 'CLIENTE';
                            const text = String(msg.texto || '');

                            // Detección precisa de PLANTILLA (Meta WhatsApp HSM / difusión / tracking / confirmación)
                            const isTemplate = !isCliente && Boolean(
                              msg.es_plantilla || 
                              msg.tipo === 'template' || 
                              msg.emisor === 'PLANTILLA' || 
                              msg.emisor_rol === 'PLANTILLA' ||
                              text.includes('Adelanto') || 
                              text.includes('Blindaje') || 
                              text.includes('Trak_') ||
                              text.includes('Confirmación de Visita') ||
                              text.includes('enruta.win.pe') ||
                              text.includes('go.win.pe') ||
                              text.includes('Código de seguimiento') ||
                              text.includes('La instalación de tu servicio WIN es hoy') ||
                              text.includes('Estás a un paso de vivir la mejor experiencia') ||
                              text.includes('Tu atención técnica de tu servicio WIN es hoy') ||
                              text.includes('*¡Perfecto!*') ||
                              text.includes('¡Perfecto!') ||
                              text.startsWith('mcwa') ||
                              (text.includes('| [') && text.includes(']')) ||
                              text.includes('Ad. Inc.') ||
                              text.includes('Velocidad') ||
                              text.includes('TRAKING') ||
                              text.includes('Seguimiento de VT') ||
                              text.includes('programación') ||
                              text.includes('programacion') ||
                              (!msg.agente && text.length < 40 && !text.includes('?') && (text.includes('-') || text.includes('_') || text.includes('.')))
                            );


                            return (
                              <div
                                key={mIdx}
                                className={`flex flex-col ${isCliente ? 'items-start' : 'items-end'}`}
                              >
                                <div className="flex items-center gap-1.5 mb-1 px-1">
                                  {isCliente ? (
                                    <>
                                      <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                        <User className="w-2.5 h-2.5" />
                                      </div>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                                        Cliente
                                      </span>
                                      <span className="text-[11px] font-semibold text-blue-300">
                                        {selectedRow.cliente_nombre || 'Cliente'}
                                      </span>
                                    </>
                                  ) : isTemplate ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                                        <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                                        Plantilla WhatsApp
                                      </span>
                                      <span className="text-[11px] font-semibold text-purple-300">
                                        Disparo Automático (Meta HSM)
                                      </span>
                                      <div className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                                        <Sparkles className="w-2.5 h-2.5" />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] font-bold">
                                        <Headset className="w-2.5 h-2.5 text-orange-400" />
                                        Asesor WIN
                                      </span>
                                      <span className="text-[11px] font-semibold text-orange-300">
                                        {msg.agente || 'Asesor de Atención'}
                                      </span>
                                      <div className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center">
                                        <Headset className="w-2.5 h-2.5" />
                                      </div>
                                    </>
                                  )}
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {formatDate(msg.fecha_utc)}
                                  </span>
                                </div>

                                <div
                                  className={`p-4 rounded-2xl max-w-[85%] text-xs shadow-md leading-relaxed ${
                                    isCliente
                                      ? 'bg-slate-800/95 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                                      : isTemplate
                                      ? 'bg-gradient-to-br from-purple-950/60 via-slate-900 to-slate-950 text-purple-100 border border-purple-500/40 rounded-tr-sm shadow-purple-950/20'
                                      : 'bg-gradient-to-br from-orange-950/70 to-slate-900 text-orange-50 border border-orange-500/40 rounded-tr-sm'
                                  }`}
                                >
                                  {isTemplate && (msg.tipo === 'template' || text.length < 50) ? (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between pb-1 border-b border-purple-500/20 text-[10px] font-bold text-purple-300 uppercase tracking-wide">
                                        <span>Plantilla Oficial WhatsApp</span>
                                        <span className="text-purple-400 font-mono">HSM</span>
                                      </div>
                                      <div className="text-sm font-semibold text-white tracking-wide pt-0.5">
                                        {text}
                                      </div>
                                      <p className="text-[10px] text-purple-300/80 pt-1 italic">
                                        Plantilla preaprobada por Meta enviada automáticamente al cliente.
                                      </p>
                                    </div>
                                  ) : (
                                    renderFormattedChatMessage(msg.texto)
                                  )}
                                </div>
                              </div>
                            );
                          })}                        </div>
                      ) : (
                        <pre className="flex-1 text-[11px] bg-slate-950 p-4 rounded-2xl text-emerald-400 overflow-auto border border-slate-800 font-mono min-h-0">
                          {JSON.stringify(liveChatMessages || selectedRow.ultimos_mensajes_json, null, 2)}
                        </pre>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 p-6 text-center">
                      <MessageSquare className="w-10 h-10 text-slate-700" />
                      <p className="text-xs">No hay historial de chat registrado para esta fila.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer del Modal con Barra de Atajos de Teclado */}
            <div className="border-t border-slate-800 px-5 py-2.5 bg-slate-900 flex items-center justify-between flex-shrink-0">
              <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-mono text-[10px]">ESC</kbd> Cerrar
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-mono text-[10px]">←</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-mono text-[10px]">→</kbd> Navegar registros
                </span>
                {activeTab === 'chats_mantra' && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-mono text-[10px]">V</kbd> Alternar Vista Chat / JSON
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="px-5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 ml-auto"
              >
                <span>Cerrar</span>
                <kbd className="px-1.5 py-0.5 bg-slate-900 text-slate-400 rounded border border-slate-700 font-mono text-[10px]">ESC</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
