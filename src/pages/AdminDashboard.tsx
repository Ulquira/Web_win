import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardWinEnrutaView } from '@/components/admin/DashboardWinEnrutaView';
import { DashboardChatsView } from '@/components/admin/DashboardChatsView';
import { UsersManagementView } from '@/components/admin/UsersManagementView';
import { ExcelFilterHeader, ColumnFilterState } from '../components/ExcelFilterHeader';
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
  TrendingUp,
  Users,
  MapPin,
  Calendar,
} from 'lucide-react';

// Mapeo de identificadores de columna a etiquetas amigables
const COLUMN_FRIENDLY_LABELS: Record<string, string> = {
  TipoServicioCalculado: 'Tipo Servicio',
  tipo_servicio: 'Tipo Servicio',
  TipoTraba: 'Tipo Trabajo',
  tipo_trabajo: 'Tipo Trabajo',
  tipo_operacion: 'Operación / Trabajo',
  Producto: 'Producto',
  producto: 'Producto',
  Estado: 'Estado',
  estado: 'Estado',
  estado_ot: 'Estado OT',
  OrdenId: 'Orden ID',
  orden_id: 'Orden ID',
  ticket: 'Ticket',
  Cliente: 'Cliente',
  cliente: 'Cliente',
  cliente_nombre: 'Cliente',
  NumeroDocumento: 'Documento',
  'Número Documento': 'Documento',
  documento: 'Documento',
  FechaVisita: 'Fecha Visita',
  fecha_visita: 'Fecha Visita',
  Direccion: 'Dirección',
  direccion: 'Dirección',
  Localidad: 'Distrito',
  distrito: 'Distrito',
  Cuadrilla: 'Cuadrilla',
  cuadrilla: 'Cuadrilla',
  Cuadrilla_nombre: 'Técnico',
  tecnico: 'Técnico',
  Zona: 'Distrito',
  Pin_token: 'PIN',
  pin: 'PIN',
  phone: 'Teléfono',
  telefono: 'Teléfono',
  asesor_asignado: 'Usuario',
  grupo_servicio: 'Grupo Serv.',
  quien_tiene_la_palabra: 'Palabra',
  estado_chat: 'Estado Chat',
  semaforo_sla: 'SLA',
  ultimo_mensaje_texto: 'Último Mensaje',
  ultimo_mensaje_fecha: 'Fecha Último Msg',
  se_envio_wsp: 'WhatsApp',
  ingreso_tracking: 'Tracking / Mapa',
  reprogramo: 'Reprogramó',
  respondio_encuesta: 'Encuesta',
  pulso_soporte: 'Soporte',
  fecha_solicitada: 'Fecha Solicitada',
  turno: 'Turno',
  motivo: 'Motivo',
  token: 'Token'
};

const getColumnLabel = (field: string): string => {
  return COLUMN_FRIENDLY_LABELS[field] || field.replace(/_/g, ' ');
};

type TabType = 'principal' | 'reporte' | 'dashboard' | 'dashboard_chats' | 'encuestas' | 'reprogramaciones' | 'chats_mantra' | 'usuarios';

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
  const [grupoServicio, setGrupoServicio] = useState<string[]>([]);
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false);
  const grupoDropdownRef = useRef<HTMLDivElement>(null);
  const [estadoChatFiltro, setEstadoChatFiltro] = useState('');
  const [updatingChatId, setUpdatingChatId] = useState<number | null>(null);

  // Filtros interactivos tipo Excel por columna
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);

  // Cerrar popover de filtro Excel al hacer clic fuera
  useEffect(() => {
    if (!activeFilterDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.excel-filter-popover') && !target.closest('.excel-filter-trigger')) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeFilterDropdown]);

  // Cerrar dropdown de Grupo de Servicio al hacer clic fuera
  useEffect(() => {
    if (!grupoDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (grupoDropdownRef.current && !grupoDropdownRef.current.contains(e.target as Node)) {
        setGrupoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [grupoDropdownOpen]);

  // Ordenamiento de columnas (ascendente / descendente)
  const [sortField, setSortField] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  // Estados para pestaña de Control de Roles & Usuarios
  const [chatLimit, setChatLimit] = useState<number>(15);
  const [dashboardStats, setDashboardStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [chatsDashboardStats, setChatsDashboardStats] = useState<any | null>(null);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState<boolean>(true);
  const [loadingChatsStats, setLoadingChatsStats] = useState<boolean>(false);

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



  // Clasificación de confirmaciones automáticas por botón (para evitar marcar erróneamente 'CLIENTE' / SLA Rojo)
  const isConfirmationMessage = (text: string): boolean => {
    if (!text) return false;
    const clean = text.trim().toLowerCase();
    if (
      clean === 'si, confirmo' ||
      clean === 'si confirmo' ||
      clean === 'sí, confirmo' ||
      clean === 'sí confirmo' ||
      clean === 'confirmado' ||
      clean === 'confirmar' ||
      clean === 'si, conforme' ||
      clean === 'si conforme' ||
      clean === 'si todo conforme' ||
      clean === 'conforme' ||
      clean === 'si' ||
      clean === 'sí' ||
      clean === '1' ||
      clean.startsWith('si, confirmo') ||
      clean.startsWith('si confirmo') ||
      clean.startsWith('sí, confirmo')
    ) {
      return true;
    }
    return /^(si\s*,?\s*confirmo|confirmado|confirmar|si\s+confirmo|sí\s+confirmo|si\s*,?\s*conforme|si|sí)(\s+gracias|\s*[\.!]*)*$/i.test(clean);
  };

  const isPlantillaMessage = (text: string): boolean => {
    if (!text) return false;
    const clean = text.trim().toLowerCase();
    if (
      clean === 'entiendo, gracias' ||
      clean === 'entiendo gracias' ||
      clean === 'otras opciones' ||
      clean === 'ok' ||
      clean === 'ok.' ||
      clean === 'ok!' ||
      clean === 'okey' ||
      clean === 'oki' ||
      clean === 'todo ok' ||
      clean === 'de acuerdo' ||
      clean.startsWith('entiendo, gracias') ||
      clean.startsWith('entiendo gracias') ||
      clean.startsWith('otras opciones') ||
      clean.startsWith('ok gracias') ||
      clean.startsWith('ok, gracias') ||
      clean.startsWith('gracias por su respuesta') ||
      clean.startsWith('se informa, muchas gracias')
    ) {
      return true;
    }
    return /^(entiendo,?\s*gracias|otras\s+opciones|ok|okey|oki|todo\s+ok|de\s+acuerdo)(\s+gracias|\s*[\.!]*)*$/i.test(clean);
  };

  const normalizeChatsRows = (items: any[]): any[] => {
    return items.map((row: any) => {
      const msg = row.ultimo_mensaje_texto || '';
      if (isConfirmationMessage(msg)) {
        return {
          ...row,
          quien_tiene_la_palabra: 'CONFIRMADO',
          estado_chat: (row.estado_chat === 'Abierto' ? 'Cerrado' : row.estado_chat) || 'Cerrado',
          semaforo_sla: 'VERDE'
        };
      }
      if (isPlantillaMessage(msg)) {
        return {
          ...row,
          quien_tiene_la_palabra: 'PLANTILLA',
          estado_chat: (row.estado_chat === 'Abierto' ? 'Pendiente' : row.estado_chat) || 'Pendiente',
          semaforo_sla: 'VERDE'
        };
      }
      return row;
    });
  };

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
      const currentGrupoArr = Array.isArray(currentGrupo) ? currentGrupo : (currentGrupo ? [currentGrupo] : []);
      const currentEstado = customFilters?.estadoChatFiltro ?? estadoChatFiltro;

      const params = new URLSearchParams({
        tabla: currentTab,
        page: String(targetPage),
        limit: String(limit),
        sortBy: currentSort === 'id' && currentTab === 'reporte' ? 'fecha_visita' : currentSort,
        sortOrder: currentOrder
      });

      if (currentSearch) params.append('search', currentSearch);

      const currentColFilters = customFilters?.columnFilters ?? columnFilters;
      const activeCols: Record<string, any> = {};
      for (const [k, v] of Object.entries(currentColFilters)) {
        if (v && ((v as any).search || ((v as any).selected && (v as any).selected.length > 0))) {
          activeCols[k] = v;
        }
      }
      if (Object.keys(activeCols).length > 0) {
        params.append('colFilters', JSON.stringify(activeCols));
      }
      if (currentFInicio) params.append('fechaInicio', currentFInicio);
      if (currentFFin) params.append('fechaFin', currentFFin);
      if (currentTipo.length > 0 && (currentTab === 'principal' || currentTab === 'reporte')) {
        params.append('tipoServicio', currentTipo.join(','));
      }
      if (currentGrupoArr.length > 0) params.append('grupoServicio', currentGrupoArr.join(','));
      if (currentEstado && currentTab === 'chats_mantra') params.append('estadoChat', currentEstado);

      const res = await fetch(`${apiUrl}/api/4dm1n_/data?${params.toString()}`, {
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error(`El servidor (${apiUrl}) respondió con error ${res.status} (${res.statusText})`);
      }
      const json = await res.json();

      if (json.success) {
        const rawData = json.data || [];
        const processed = currentTab === 'chats_mantra' ? normalizeChatsRows(rawData) : rawData;
        setData(processed);
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

  // Cargar métricas especializadas para Dashboard de Chats Mantra
  const fetchChatsStats = async (customFilters?: any, retryCount = 1) => {
    setLoadingChatsStats(true);
    setErrorMsg(null);
    try {
      const currentSearch = customFilters?.search ?? search;
      const currentFInicio = customFilters?.fechaInicio ?? fechaInicio;
      const currentFFin = customFilters?.fechaFin ?? fechaFin;
      const currentGrupo = customFilters?.grupoServicio ?? grupoServicio;
      const currentGrupoArr = Array.isArray(currentGrupo) ? currentGrupo : (currentGrupo ? [currentGrupo] : []);

      const params = new URLSearchParams();
      if (currentSearch) params.append('search', currentSearch);

      const currentColFilters = customFilters?.columnFilters ?? columnFilters;
      const activeCols: Record<string, any> = {};
      for (const [k, v] of Object.entries(currentColFilters)) {
        if (v && ((v as any).search || ((v as any).selected && (v as any).selected.length > 0))) {
          activeCols[k] = v;
        }
      }
      if (Object.keys(activeCols).length > 0) {
        params.append('colFilters', JSON.stringify(activeCols));
      }
      if (currentFInicio) params.append('fechaInicio', currentFInicio);
      if (currentFFin) params.append('fechaFin', currentFFin);
      if (currentGrupoArr.length > 0) params.append('grupoServicio', currentGrupoArr.join(','));

      let serverSuccess = false;
      try {
        const res = await fetch(`${apiUrl}/api/4dm1n_/chats-dashboard-stats?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.kpis) {
            setChatsDashboardStats(json);
            serverSuccess = true;
          }
        }
      } catch (err) {
        console.warn('Endpoint remoto no listo, usando agregación client-side:', err);
      }

      if (serverSuccess) return;

      // Fallback robusto en cliente
      const fallbackParams = new URLSearchParams({
        tabla: 'chats_mantra',
        page: '1',
        limit: '500',
        sortBy: 'ultimo_mensaje_fecha',
        sortOrder: 'desc'
      });
      if (currentSearch) fallbackParams.append('search', currentSearch);
      if (currentFInicio) fallbackParams.append('fechaInicio', currentFInicio);
      if (currentFFin) fallbackParams.append('fechaFin', currentFFin);
      if (currentGrupoArr.length > 0) fallbackParams.append('grupoServicio', currentGrupoArr.join(','));

      const dataRes = await fetch(`${apiUrl}/api/4dm1n_/data?${fallbackParams.toString()}`);
      if (!dataRes.ok) throw new Error('No se pudo obtener datos para el dashboard de chats');
      const dataJson = await dataRes.json();
      const rawChats = normalizeChatsRows(dataJson.data || []);

      const total = dataJson.total || rawChats.length;
      let abiertas = 0, sinRespuesta = 0, cerradas = 0, pendientes = 0;
      let verdes = 0, ambar = 0, rojos = 0;
      const palabraMap: Record<string, number> = { CLIENTE: 0, ASESOR: 0, PLANTILLA: 0, CONFIRMADO: 0 };
      const gruposMap: Record<string, number> = {};
      const asesoresMap: Record<string, { total: number; abiertos: number; cerrados: number; verdes: number; rojos: number }> = {};

      rawChats.forEach((c: any) => {
        const est = c.estado_chat || 'Pendiente';
        if (est === 'Abierto') abiertas++;
        else if (est === 'Sin Respuesta') sinRespuesta++;
        else if (est === 'Cerrado') cerradas++;
        else pendientes++;

        const sla = c.semaforo_sla || 'VERDE';
        if (sla === 'VERDE') verdes++;
        else if (sla === 'AMBAR') ambar++;
        else if (sla === 'ROJO') rojos++;

        const pal = c.quien_tiene_la_palabra || 'ASESOR';
        palabraMap[pal] = (palabraMap[pal] || 0) + 1;

        const grp = (c.tipo_trabajo || c.grupo_servicio || 'OTROS').trim().toUpperCase();
        gruposMap[grp] = (gruposMap[grp] || 0) + 1;

        const ase = (c.asesor_asignado || 'Sin Asignar').trim();
        if (!asesoresMap[ase]) {
          asesoresMap[ase] = { total: 0, abiertos: 0, cerrados: 0, verdes: 0, rojos: 0 };
        }
        asesoresMap[ase].total++;
        if (est === 'Abierto') asesoresMap[ase].abiertos++;
        if (est === 'Cerrado') asesoresMap[ase].cerrados++;
        if (sla === 'VERDE') asesoresMap[ase].verdes++;
        if (sla === 'ROJO') asesoresMap[ase].rojos++;
      });

      const statsFallback = {
        success: true,
        kpis: {
          totalChats: total,
          totalConfirmados: rawChats.filter((c: any) => c.quien_tiene_la_palabra === 'CONFIRMADO').length,
          chatsAbiertos: abiertas,
          chatsCerrados: cerradas,
          chatsPendientes: pendientes,
          chatsAsesorUltimo: sinRespuesta,
          slaVerde: verdes,
          slaAmarillo: ambar,
          slaRojo: rojos,
          conAsesor: rawChats.filter((c: any) => c.asesor_asignado && c.asesor_asignado !== 'Sin asignar').length,
          sinAsesor: rawChats.filter((c: any) => !c.asesor_asignado || c.asesor_asignado === 'Sin asignar').length
        },
        palabra: Object.entries(palabraMap).map(([palabra, total]) => ({ palabra, total })),
        estados: [
          { estado_chat: 'Abierto', total: abiertas },
          { estado_chat: 'Pendiente', total: pendientes },
          { estado_chat: 'Sin Respuesta', total: sinRespuesta },
          { estado_chat: 'Cerrado', total: cerradas }
        ],
        asesores: Object.entries(asesoresMap).map(([asesor, d]) => ({
          asesor,
          total: d.total,
          atendidos: d.cerrados,
          abiertos: d.abiertos,
          cerrados: d.cerrados,
          verdes: d.verdes,
          rojos: d.rojos
        })).sort((a, b) => b.total - a.total).slice(0, 15),
        grupos: Object.entries(gruposMap).map(([grupo, total]) => ({
          grupo,
          total
        })).sort((a, b) => b.total - a.total)
      };

      setChatsDashboardStats(statsFallback);
    } catch (err: any) {
      if (retryCount > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchChatsStats(customFilters, retryCount - 1);
      }
      console.error('Error cargando estadísticas de chats:', err);
      setChatsDashboardStats(null);
    } finally {
      setLoadingChatsStats(false);
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

      const currentColFilters = customFilters?.columnFilters ?? columnFilters;
      const activeCols: Record<string, any> = {};
      for (const [k, v] of Object.entries(currentColFilters)) {
        if (v && ((v as any).search || ((v as any).selected && (v as any).selected.length > 0))) {
          activeCols[k] = v;
        }
      }
      if (Object.keys(activeCols).length > 0) {
        params.append('colFilters', JSON.stringify(activeCols));
      }
      if (currentFInicio) params.append('fechaInicio', currentFInicio);
      if (currentFFin) params.append('fechaFin', currentFFin);
      if (currentTipo.length > 0) params.append('tipoServicio', currentTipo.join(','));
      const currentGrupo = customFilters?.grupoServicio ?? grupoServicio;
      const currentGrupoArr = Array.isArray(currentGrupo) ? currentGrupo : (currentGrupo ? [currentGrupo] : []);
      if (currentGrupoArr.length > 0) params.append('grupoServicio', currentGrupoArr.join(','));

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
    } else if (activeTab === 'dashboard_chats') {
      fetchChatsStats();
    } else {
      setPage(1);
      fetchData(1);
    }
  }, [activeTab, limit, grupoServicio.join(','), sortField, sortOrder, apiUrl]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
    } else if (activeTab === 'dashboard_chats') {
      fetchChatsStats();
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
    setGrupoServicio([]);
    setEstadoChatFiltro('');
    setSortField(defaultSort);
    setSortOrder('desc');
    setPage(1);
    const resetObj = {
      search: '',
      fechaInicio: today,
      fechaFin: today,
      tipoServicio: [] as string[],
      grupoServicio: [] as string[],
      estadoChatFiltro: '',
      sortField: defaultSort,
      sortOrder: 'desc'
    };
    if (activeTab === 'dashboard') {
      fetchDashboardStats(resetObj);
    } else if (activeTab === 'dashboard_chats') {
      fetchChatsStats(resetObj);
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

  // Obtener valor de celda homogéneo para filtros y ordenamientos
  const getCellValue = (row: any, field: string): string => {
    if (!row) return '';
    switch (field) {
      case 'id':
        return String(row.id ?? row.IDuser ?? '');
      case 'orden_id':
      case 'OrdenId':
        return String(row.orden_id ?? row.OrdenId ?? row.id ?? '');
      case 'ticket':
      case 'Ticket':
        return String(row.ticket ?? row.Ticket ?? row.CodiSegui ?? '');
      case 'cliente':
      case 'cliente_nombre':
      case 'Cliente':
        return String(row.cliente_nombre ?? row.cliente ?? row.Cliente ?? '');
      case 'phone':
      case 'telefono':
      case 'Telefono':
        return String(row.phone ?? row.telefono ?? row.Telefono ?? row.TeleMovilNume ?? '');
      case 'asesor_asignado':
      case 'usuario':
      case 'Usuario':
        return String(row.asesor_asignado ?? row.Usuario ?? '');
      case 'TipoServicioCalculado':
      case 'tipo_servicio':
        return String(row.TipoServicioCalculado || row.tipo_servicio || row.tipo_trabajo || row.TipoTraba || '');
      case 'TipoTraba':
        return String(row.TipoTraba || row.tipo_trabajo || '');
      case 'tipo_trabajo':
        return String(row.tipo_trabajo || row.TipoTraba || '');
      case 'grupo_servicio':
        return String(row.grupo_servicio || row.tipo_trabajo || '');
      case 'distrito':
      case 'provincia':
      case 'Localidad':
      case 'Zona':
        return String(row.Zona || row.distrito || row.Localidad || row.provincia || '');
      case 'Cuadrilla_nombre':
      case 'tecnico':
        return String(row.Cuadrilla_nombre || row.tecnico || '');
      case 'Pin_token':
      case 'pin':
        return String(row.Pin_token || row.pin || '');
      case 'quien_tiene_la_palabra':
        return String(row.quien_tiene_la_palabra ?? '');
      case 'estado_chat':
        return String(row.estado_chat ?? '');
      case 'semaforo_sla':
        return String(row.semaforo_sla ?? '');
      case 'ultimo_mensaje_texto':
        return String(row.ultimo_mensaje_texto ?? '');
      case 'ultimo_mensaje_fecha':
        return String(row.ultimo_mensaje_fecha ?? row.cliente_ultima_fecha ?? '');
      case 'estado_ot':
      case 'Estado':
        return String(row.estado_ot ?? row.Estado ?? row['Estado OT'] ?? '');
      case 'tipo_operacion':
        return String(row.tipo_operacion ?? row.TipoServicioCalculado ?? row.tipo_trabajo ?? row.TipoTraba ?? '');
      case 'se_envio_wsp':
        return String(row.se_envio_wsp ?? '');
      case 'ingreso_tracking':
        return String(row.ingreso_tracking ?? '');
      case 'reprogramo':
        return String(row.reprogramo ?? '');
      case 'respondio_encuesta':
        return String(row.respondio_encuesta ?? '');
      case 'pulso_soporte':
        return String(row.pulso_soporte ?? '');
      case 'NumeroDocumento':
        return String(row.NumeroDocumento ?? row['Número Documento'] ?? '');
      case 'Producto':
        return String(row.Producto ?? '');
      case 'FechaVisita':
        return String(row.FechaVisita ?? row['F.Visita'] ?? '');
      case 'Direccion':
        return String(row.Direccion ?? '');
      case 'Cuadrilla':
        return String(row.Cuadrilla ?? '');
      case 'instalacion_concretada':
        return String(row.instalacion_concretada ?? '');
      case 'satisfaccion_general':
        return String(row.satisfaccion_general ?? '');
      case 'tecnico_trato':
        return String(row.tecnico_trato ?? '');
      case 'fecha_solicitada':
        return String(row.fecha_solicitada ?? '');
      case 'turno':
        return String(row.turno ?? '');
      case 'motivo':
        return String(row.motivo ?? '');
      case 'token':
        return String(row.token ?? '');
      default:
        return row[field] !== undefined && row[field] !== null ? String(row[field]) : '';
    }
  };

  const getUniqueValuesForField = (field: string): string[] => {
    const set = new Set<string>();
    if (field === 'TipoServicioCalculado' || field === 'tipo_servicio') {
      ['INSTALACION', 'AVERIAS', 'AVERIAS PRV', 'POSTVENTA', 'PROVINCIA'].forEach(t => set.add(t));
      (filtrosOpciones.tiposClasificados || []).forEach(t => t && set.add(t));
    } else if (field === 'quien_tiene_la_palabra') {
      ['CONFIRMADO', 'CLIENTE', 'PLANTILLA', 'ASESOR'].forEach(p => set.add(p));
    } else if (field === 'estado_chat') {
      ['Abierto', 'Pendiente', 'Sin Respuesta', 'Cerrado'].forEach(e => set.add(e));
    } else if (field === 'semaforo_sla') {
      ['VERDE', 'AMARILLO', 'ROJO'].forEach(s => set.add(s));
    }
    for (let i = 0; i < data.length; i++) {
      const val = getCellValue(data[i], field).trim();
      if (val) set.add(val);
    }
    return Array.from(set).sort((a, b) => {
      if (a === '(Vacío)') return 1;
      if (b === '(Vacío)') return -1;
      return a.localeCompare(b);
    });
  };

  const handleColumnFilterChange = (field: string, filter: ColumnFilterState | null) => {
    const updated = { ...columnFilters };
    if (!filter) {
      delete updated[field];
    } else {
      updated[field] = filter;
    }
    setColumnFilters(updated);
    setPage(1);
    fetchData(1, { columnFilters: updated });
  };

  // Filtrado local y ordenamiento sobre las filas visibles con soporte Excel
  const displayData = useMemo(() => {
    if (data.length === 0) return [];

    const activeFilterEntries = Object.entries(columnFilters).filter(
      ([_, filter]) => filter && (filter.search || (filter.selected && filter.selected.length > 0))
    );

    // 1. Filtrado estricto e insensible a mayúsculas por filtros de columnas Excel
    let filtered = data;
    if (activeFilterEntries.length > 0) {
      filtered = data.filter(row => {
        for (const [field, filter] of activeFilterEntries) {
          if (!filter) continue;
          const cellRaw = getCellValue(row, field).trim();
          const cellDisplay = cellRaw || '(Vacío)';

          // Búsqueda de texto dentro del popover
          if (filter.search && filter.search.trim()) {
            const s = filter.search.trim().toLowerCase();
            if (!cellRaw.toLowerCase().includes(s)) {
              return false;
            }
          }

          // Checkboxes seleccionados estilo Excel
          if (filter.selected && filter.selected.length > 0) {
            const hasMatch = filter.selected.some(sel => {
              if (sel === '(Vacío)') {
                return !cellRaw;
              }
              const sSel = sel.trim().toLowerCase();
              const sCell = cellRaw.toLowerCase();
              return sSel === sCell || sSel === cellDisplay.toLowerCase();
            });
            if (!hasMatch) return false;
          }
        }
        return true;
      });
    }

    // 2. Ordenamiento
    if (!sortField) return filtered;

    return [...filtered].sort((a, b) => {
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
  }, [data, columnFilters, sortField, sortOrder]);

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
    if (grupoServicio.length > 0) params.append('grupoServicio', grupoServicio.join(','));
    if (estadoChatFiltro && activeTab === 'chats_mantra') params.append('estadoChat', estadoChatFiltro);

    window.open(`${apiUrl}/api/4dm1n_/export?${params.toString()}`, '_blank');
  };

  const formatDateOnly = (val: any) => {
    if (!val) return '-';
    try {
      if (typeof val === 'string') {
        const clean = val.split('T')[0].split(' ')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return String(val);
    }
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
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex font-sans antialiased">
            {/* Barra Lateral Izquierda (Sidebar Dividida en 2) */}
      <aside className="w-64 bg-[#0F141F] border-r border-slate-800/80 flex flex-col shrink-0 sticky top-0 h-screen z-40 select-none">
        {/* Brand Header */}
        <div className="h-14 px-4 border-b border-slate-800/80 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#FF5A0A] flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-black text-sm">
            W
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white block leading-tight">Control WIN</span>
            <span className="text-[10px] text-slate-500 font-mono block">Administración</span>
          </div>
        </div>

        {/* Sección 1 (Superior): Menú de Navegación */}
        <nav className="p-2.5 space-y-1 overflow-y-auto max-h-[42vh] scrollbar-thin scrollbar-thumb-slate-800 shrink-0">
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Vistas
          </div>

          {/* Órdenes */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('principal');
              setColumnFilters({});
              setActiveFilterDropdown(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'principal'
                ? 'bg-[#FF5A0A] text-white shadow-lg shadow-orange-500/25 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className={`w-4 h-4 shrink-0 ${activeTab === 'principal' ? 'text-white' : 'text-slate-400'}`} />
            <span>Órdenes</span>
          </button>

          {/* Reporte */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('reporte');
              setColumnFilters({});
              setActiveFilterDropdown(null);
              if (sortField === 'id') setSortField('fecha_visita');
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'reporte'
                ? 'bg-[#FF5A0A] text-white shadow-lg shadow-orange-500/25 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className={`w-4 h-4 shrink-0 ${activeTab === 'reporte' ? 'text-white' : 'text-slate-400'}`} />
            <span>Reporte</span>
          </button>

          {/* Menú Desglosable Dashboard */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setDashboardMenuOpen(!dashboardMenuOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard' || activeTab === 'dashboard_chats'
                  ? 'bg-slate-800/80 text-orange-400 border border-orange-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' || activeTab === 'dashboard_chats' ? 'text-[#FF5A0A]' : 'text-slate-400'}`} />
                <span>Dashboard</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dashboardMenuOpen ? 'rotate-180 text-orange-400' : 'text-slate-500'}`} />
            </button>

            {dashboardMenuOpen && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                {/* WinENRUTA */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('dashboard');
                    setColumnFilters({});
                    setActiveFilterDropdown(null);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-[#FF5A0A] text-white shadow-md shadow-orange-500/20 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
                  <span>WinENRUTA</span>
                </button>

                {/* Chat */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('dashboard_chats');
                    setColumnFilters({});
                    setActiveFilterDropdown(null);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'dashboard_chats'
                      ? 'bg-[#FF5A0A] text-white shadow-md shadow-orange-500/20 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <MessageCircle className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'dashboard_chats' ? 'text-white' : 'text-slate-400'}`} />
                  <span>Chat</span>
                </button>
              </div>
            )}
          </div>

          {/* Encuestas */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('encuestas');
              setColumnFilters({});
              setActiveFilterDropdown(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'encuestas'
                ? 'bg-[#FF5A0A] text-white shadow-lg shadow-orange-500/25 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${activeTab === 'encuestas' ? 'text-white' : 'text-slate-400'}`} />
            <span>Encuestas</span>
          </button>

          {/* Reprogramaciones */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('reprogramaciones');
              setColumnFilters({});
              setActiveFilterDropdown(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'reprogramaciones'
                ? 'bg-[#FF5A0A] text-white shadow-lg shadow-orange-500/25 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CalendarClock className={`w-4 h-4 shrink-0 ${activeTab === 'reprogramaciones' ? 'text-white' : 'text-slate-400'}`} />
            <span>Reprogramaciones</span>
          </button>

          {/* Chats */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('chats_mantra');
              setColumnFilters({});
              setActiveFilterDropdown(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'chats_mantra'
                ? 'bg-[#FF5A0A] text-white shadow-lg shadow-orange-500/25 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare className={`w-4 h-4 shrink-0 ${activeTab === 'chats_mantra' ? 'text-white' : 'text-slate-400'}`} />
            <span>Chats</span>
          </button>

          {/* Usuarios */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('usuarios');
              setColumnFilters({});
              setActiveFilterDropdown(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'usuarios'
                ? 'bg-[#FF5A0A] text-white shadow-lg shadow-orange-500/25 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className={`w-4 h-4 shrink-0 ${activeTab === 'usuarios' ? 'text-white' : 'text-slate-400'}`} />
            <span>Usuarios</span>
          </button>
        </nav>

        {/* Sección 2 (Inferior): Filtros Generales */}
        <div className="flex-1 border-t border-slate-800/80 p-3 flex flex-col justify-between overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 bg-[#0C101A]">
          <form onSubmit={handleSearchSubmit} className="space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-[#FF5A0A]" /> Filtros Globales
              </span>
              {(search || grupoServicio.length > 0 || fechaInicio !== getTodayPeruString() || fechaFin !== getTodayPeruString()) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[10px] text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Búsqueda rápida */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Búsqueda rápida</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="OT, Ticket, Cliente..."
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Fecha Inicio y Fecha Fin en 2 columnas */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Fecha Inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Fecha Fin</label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Grupo de Servicio (Multiselección) */}
            <div className="relative" ref={grupoDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold text-slate-400">Grupo de Servicio</label>
                {grupoServicio.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setGrupoServicio([]); setPage(1); }}
                    className="text-[9px] text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
                  >
                    Limpiar ({grupoServicio.length})
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setGrupoDropdownOpen(!grupoDropdownOpen)}
                className="w-full bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-left text-white focus:outline-none focus:border-orange-500 transition-colors cursor-pointer flex items-center justify-between"
              >
                <span className="truncate">
                  {grupoServicio.length === 0
                    ? 'Todos los grupos'
                    : grupoServicio.length === 1
                      ? grupoServicio[0]
                      : `${grupoServicio.length} grupos seleccionados`}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${grupoDropdownOpen ? 'rotate-180 text-orange-400' : ''}`} />
              </button>

              {grupoDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 z-50 bg-slate-900 border border-slate-800 rounded-lg shadow-xl shadow-black/80 p-2 max-h-60 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium">Multiselección</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allOptions = [
                          ...(filtrosOpciones.gruposServicioMantra && filtrosOpciones.gruposServicioMantra.length > 0
                            ? filtrosOpciones.gruposServicioMantra.filter(g => !['Instalacion', 'Averias'].includes(g))
                            : ['INSTALACION', 'AVERIAS', 'PROVINCIA', 'POSTVENTA', 'AVERIAS PRV']),
                          'Instalacion',
                          'Averias'
                        ];
                        setGrupoServicio(grupoServicio.length === allOptions.length ? [] : allOptions);
                        setPage(1);
                      }}
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
                    >
                      Alternar todos
                    </button>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 pt-0.5 mb-1">
                      Tipos de Operación
                    </div>
                    <div className="space-y-0.5">
                      {(filtrosOpciones.gruposServicioMantra && filtrosOpciones.gruposServicioMantra.length > 0
                        ? filtrosOpciones.gruposServicioMantra.filter(g => !['Instalacion', 'Averias'].includes(g))
                        : ['INSTALACION', 'AVERIAS', 'PROVINCIA', 'POSTVENTA', 'AVERIAS PRV']
                      ).map(g => {
                        const isChecked = grupoServicio.includes(g);
                        return (
                          <div
                            key={g}
                            onClick={() => {
                              const next = isChecked
                                ? grupoServicio.filter(item => item !== g)
                                : [...grupoServicio, g];
                              setGrupoServicio(next);
                              setPage(1);
                            }}
                            className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                              isChecked ? 'bg-orange-500/15 text-orange-300 font-medium' : 'text-slate-300 hover:bg-slate-800/60'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isChecked ? 'bg-[#FF5A0A] border-[#FF5A0A]' : 'border-slate-700 bg-slate-950'
                            }`}>
                              {isChecked && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                            </div>
                            <span className="truncate text-[11px]">{g}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 pt-1 mb-1">
                      Canales Mantra
                    </div>
                    <div className="space-y-0.5">
                      {['Instalacion', 'Averias'].map(canal => {
                        const isChecked = grupoServicio.includes(canal);
                        return (
                          <div
                            key={canal}
                            onClick={() => {
                              const next = isChecked
                                ? grupoServicio.filter(item => item !== canal)
                                : [...grupoServicio, canal];
                              setGrupoServicio(next);
                              setPage(1);
                            }}
                            className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                              isChecked ? 'bg-orange-500/15 text-orange-300 font-medium' : 'text-slate-300 hover:bg-slate-800/60'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isChecked ? 'bg-[#FF5A0A] border-[#FF5A0A]' : 'border-slate-700 bg-slate-950'
                            }`}>
                              {isChecked && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                            </div>
                            <span className="truncate text-[11px]">Canal {canal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#FF5A0A] hover:bg-[#e04f08] active:scale-95 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-orange-500/20 cursor-pointer"
              >
                <Filter className="w-3 h-3" />
                Filtrar
              </button>
              <button
                type="button"
                onClick={() => activeTab === 'dashboard' ? fetchDashboardStats() : activeTab === 'dashboard_chats' ? fetchChatsStats() : fetchData(1)}
                title="Refrescar datos"
                className="p-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${(loading || loadingStats) ? 'animate-spin text-orange-400' : ''}`} />
              </button>
            </div>
          </form>

          {/* Footer Sidebar */}
          <div className="pt-2.5 mt-2.5 border-t border-slate-800/60 text-[10px] text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-slate-400">BD_Phoenix</span>
            </div>
            <span className="text-slate-600 font-mono">v2.1</span>
          </div>
        </div>
      </aside>

      {/* Contenedor Principal (Derecha) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar minimalista */}
        <header className="h-16 bg-[#0F141F]/80 border-b border-slate-800/80 backdrop-blur sticky top-0 z-30 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-white tracking-tight">
              {activeTab === 'principal' ? 'Órdenes de Trabajo' :
               activeTab === 'reporte' ? 'Reporte Funnel' :
               activeTab === 'dashboard' ? 'Dashboard WinENRUTA' :
               activeTab === 'dashboard_chats' ? 'Dashboard Chat' :
               activeTab === 'encuestas' ? 'Encuestas de Satisfacción' :
               activeTab === 'reprogramaciones' ? 'Reprogramaciones' :
               activeTab === 'chats_mantra' ? 'Historial de Chats' : 'Usuarios'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleDownload('json')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="flex-1 p-6 w-full flex flex-col gap-5">
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

        {/* Chips de Filtros Activos */}
        {Object.keys(columnFilters).length > 0 && activeTab !== 'dashboard' && activeTab !== 'usuarios' && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs z-20">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-orange-400" />
              {Object.keys(columnFilters).length === 1 ? 'Filtro activo:' : `Filtros activos (${Object.keys(columnFilters).length}):`}
            </span>
            {Object.entries(columnFilters).map(([fKey, fVal]) => (
              <span
                key={fKey}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[11px] font-mono"
              >
                <strong className="text-slate-300 font-sans font-semibold">{getColumnLabel(fKey)}:</strong>
                <span className="truncate max-w-[140px]">
                  {fVal.selected && fVal.selected.length > 0 ? fVal.selected.join(', ') : fVal.search}
                </span>
                <button
                  type="button"
                  onClick={() => handleColumnFilterChange(fKey, null)}
                  className="hover:text-white transition-colors cursor-pointer ml-0.5"
                  title="Quitar este filtro"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => { setColumnFilters({}); setPage(1); fetchData(1, { columnFilters: {} }); }}
              className="text-[11px] text-slate-400 hover:text-white underline ml-auto cursor-pointer"
            >
              Limpiar filtros de columna
            </button>
          </div>
        )}

        {/* Resumen y paginación superior */}
        {activeTab !== 'dashboard' && activeTab !== 'dashboard_chats' && activeTab !== 'usuarios' ? (
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
          <div className="flex flex-wrap items-center justify-end gap-2 px-1 text-xs text-slate-400">
            {dashboardStats?.kpis && (
              <span className="text-xs text-slate-400">
                Total Evaluadas: <strong className="text-white font-mono">{Number(dashboardStats.kpis.total_ots || 0).toLocaleString()}</strong>
              </span>
            )}
          </div>
        )}

        {/* 1. Vista Dashboard Ejecutivo vs 2. Control de Usuarios vs 3. Tablas de Resultados */}
        {activeTab === 'dashboard' ? (
          <DashboardWinEnrutaView
            loadingStats={loadingStats}
            dashboardStats={dashboardStats}
            fechaInicio={fechaInicio}
          />
        ) : activeTab === 'dashboard_chats' ? (
          <DashboardChatsView
            loadingChatsStats={loadingChatsStats}
            chatsDashboardStats={chatsDashboardStats}
          />
        ) : activeTab === 'usuarios' ? (
          <UsersManagementView apiUrl={apiUrl} />
        ) : (
          /* Tabla de Resultados */
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur relative min-h-[400px] z-10">
            {loading && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs text-slate-300 font-medium">Cargando registros de la base de datos...</p>
              </div>
            )}

            <div ref={tableContainerRef} className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
              {/* 1. Tabla Principal */}
              {activeTab === 'principal' && (
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/90 backdrop-blur-md sticky top-0 z-20 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">
                  <tr>
                    <th className="py-3 px-3 w-[70px] text-center">Acción</th>
                    <ExcelFilterHeader
                      title="Orden ID"
                      field="OrdenId"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('OrdenId')}
                    />
                    <ExcelFilterHeader
                      title="Tipo Servicio"
                      field="TipoServicioCalculado"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('TipoServicioCalculado')}
                    />
                    <ExcelFilterHeader
                      title="Cliente"
                      field="Cliente"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('Cliente')}
                    />
                    <ExcelFilterHeader
                      title="Documento"
                      field="NumeroDocumento"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('NumeroDocumento')}
                    />
                    <ExcelFilterHeader
                      title="Fecha Visita"
                      field="FechaVisita"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('FechaVisita')}
                    />
                    <ExcelFilterHeader
                      title="Tipo Trabajo"
                      field="TipoTraba"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('TipoTraba')}
                    />
                    <ExcelFilterHeader
                      title="Producto"
                      field="Producto"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('Producto')}
                    />
                    <ExcelFilterHeader
                      title="Estado"
                      field="Estado"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('Estado')}
                    />
                    <ExcelFilterHeader
                      title="Dirección"
                      field="Direccion"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('Direccion')}
                    />
                    <ExcelFilterHeader
                      title="Distrito"
                      field="Zona"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('Zona')}
                    />
                    <ExcelFilterHeader
                      title="Cuadrilla"
                      field="Cuadrilla"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('Cuadrilla')}
                    />
                    <ExcelFilterHeader
                      title="PIN"
                      field="Pin_token"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('Pin_token')}
                    />
                    <th className="py-3 px-3 text-center">Seguimiento</th>
                  </tr>
                </thead>
                {displayData.length === 0 && !loading ? (
                  <tbody className="divide-y divide-slate-800/60">
                    <tr>
                      <td colSpan={14} className="py-16 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Database className="w-8 h-8 text-slate-600" />
                          <p className="text-xs font-medium text-slate-400">No se encontraron registros con los filtros seleccionados</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {displayData.map((row, idx) => (
                      <tr 
                        key={row.OrdenId || row.id || idx} 
                        className="hover:bg-slate-800/40 transition-colors border-b border-slate-800/40 group"
                      >
                        {/* 1. Acción */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="p-1.5 bg-slate-800/90 hover:bg-orange-500/20 hover:text-orange-400 text-slate-400 rounded-lg transition-colors border border-slate-700/50 shadow-sm"
                            title="Ver detalle completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {/* 2. Orden ID */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-white tracking-wider text-[11px] bg-slate-950/70 border border-slate-800 px-2 py-0.5 rounded-md inline-block">
                            {row.OrdenId}
                          </span>
                        </td>

                        {/* 3. Tipo Servicio */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wide uppercase inline-flex items-center gap-1.5 border shadow-sm ${
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
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              row.TipoServicioCalculado === 'INSTALACION' 
                                ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                                : row.TipoServicioCalculado === 'AVERIAS' || row.TipoServicioCalculado === 'AVERIAS PRV'
                                ? 'bg-rose-400 shadow-[0_0_6px_#f43f5e]'
                                : row.TipoServicioCalculado === 'POSTVENTA'
                                ? 'bg-cyan-400 shadow-[0_0_6px_#06b6d4]'
                                : row.TipoServicioCalculado === 'PROVINCIA'
                                ? 'bg-purple-400 shadow-[0_0_6px_#a855f7]'
                                : 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                            }`} />
                            {row.TipoServicioCalculado || row.TipoTraba || '-'}
                          </span>
                        </td>

                        {/* 4. Cliente */}
                        <td className="py-2.5 px-3 max-w-[210px] truncate" title={row.Cliente}>
                          <span className="font-semibold text-slate-100 group-hover:text-white transition-colors">
                            {row.Cliente}
                          </span>
                        </td>

                        {/* 5. Documento */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono text-slate-400 text-[11px]">
                            {row.NumeroDocumento || row['Número Documento'] || '-'}
                          </span>
                        </td>

                        {/* 6. Fecha Visita (Solo Fecha, sin hora) */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-amber-300/90 font-mono text-[11px]">
                            <Calendar className="w-3 h-3 text-amber-400/70" />
                            <span>{formatDateOnly(row.FechaVisita || row['F.Visita'])}</span>
                          </div>
                        </td>

                        {/* 7. Tipo Trabajo */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/25 text-[10px] font-medium tracking-wide">
                            {row.TipoTraba || '-'}
                          </span>
                        </td>

                        {/* 8. Producto */}
                        <td className="py-2.5 px-3 max-w-[170px] truncate" title={row.Producto}>
                          <span className="text-slate-300 font-medium">{row.Producto || '-'}</span>
                        </td>

                        {/* 9. Estado */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1.5 border ${
                            row.Estado === 'Iniciada' || row.Estado === 'Completada'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : row.Estado === 'Agendada'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : row.Estado === 'Cancelada'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              row.Estado === 'Iniciada' || row.Estado === 'Completada'
                                ? 'bg-emerald-400'
                                : row.Estado === 'Agendada'
                                ? 'bg-sky-400'
                                : row.Estado === 'Cancelada'
                                ? 'bg-rose-400'
                                : 'bg-slate-400'
                            }`} />
                            {row.Estado || '-'}
                          </span>
                        </td>

                        {/* 10. Dirección */}
                        <td className="py-2.5 px-3 max-w-[220px] truncate" title={row.Direccion || '-'}>
                          <div className="flex items-center gap-1 text-slate-300 text-[11px]">
                            <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <span className="truncate">{row.Direccion || '-'}</span>
                          </div>
                        </td>

                        {/* 11. Distrito */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-medium">
                            {row.Zona || row.Localidad || '-'}
                          </span>
                        </td>

                        {/* 12. Cuadrilla completa sin limpiar */}
                        <td className="py-2.5 px-3 max-w-[280px] truncate" title={row.Cuadrilla || '-'}>
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium text-[11px]">
                            <Users className="w-3 h-3 text-indigo-400/80 flex-shrink-0" />
                            <span className="truncate">{row.Cuadrilla || '-'}</span>
                          </div>
                        </td>

                        {/* 13. PIN */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold text-[11px] tracking-wider">
                            {row.Pin_token || '-'}
                          </span>
                        </td>

                        {/* 14. Seguimiento */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {row.token ? (
                            <a
                              href={`/seguimiento/${row.token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 text-[10px] font-mono font-semibold transition-all hover:scale-105"
                              title="Abrir vista de seguimiento"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>{row.token.slice(0, 8)}...</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-slate-600 font-mono text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            )}

            {/* 2. Reporte Funnel Casos 360 (Monitoreo de Chats y Tracking) */}
            {activeTab === 'reporte' && (
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-20 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Acción</th>
                    <ExcelFilterHeader
                      title="Orden / Ticket"
                      field="orden_id"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('orden_id')}
                    />
                    <ExcelFilterHeader
                      title="Cliente"
                      field="cliente"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('cliente')}
                    />
                    <ExcelFilterHeader
                      title="Teléfono"
                      field="telefono"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('telefono')}
                    />
                    <ExcelFilterHeader
                      title="Operación / Trabajo"
                      field="tipo_operacion"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('tipo_operacion')}
                    />
                    <ExcelFilterHeader
                      title="Estado OT"
                      field="estado_ot"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('estado_ot')}
                    />
                    <ExcelFilterHeader
                      title="Fecha Visita"
                      field="fecha_visita"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('fecha_visita')}
                    />
                    <ExcelFilterHeader
                      title="Distrito / Cuadrilla"
                      field="distrito"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('distrito')}
                    />
                    <ExcelFilterHeader
                      title="WhatsApp"
                      field="se_envio_wsp"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('se_envio_wsp')}
                    />
                    <ExcelFilterHeader
                      title="Tracking / Mapa"
                      field="ingreso_tracking"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('ingreso_tracking')}
                    />
                    <ExcelFilterHeader
                      title="Reprogramó"
                      field="reprogramo"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('reprogramo')}
                    />
                    <ExcelFilterHeader
                      title="Encuesta"
                      field="respondio_encuesta"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('respondio_encuesta')}
                    />
                    <ExcelFilterHeader
                      title="Soporte"
                      field="pulso_soporte"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('pulso_soporte')}
                      alignRight={true}
                    />
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
                <thead className="bg-slate-950/80 sticky top-0 z-20 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Acción</th>
                    <ExcelFilterHeader
                      title="ID"
                      field="id"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('id')}
                    />
                    <ExcelFilterHeader
                      title="Orden ID"
                      field="orden_id"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('orden_id')}
                    />
                    <ExcelFilterHeader
                      title="Ticket"
                      field="ticket"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('ticket')}
                    />
                    <ExcelFilterHeader
                      title="Teléfono"
                      field="phone"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('phone')}
                    />
                    <ExcelFilterHeader
                      title="Cliente"
                      field="cliente_nombre"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('cliente_nombre')}
                    />
                    <ExcelFilterHeader
                      title="Usuario"
                      field="asesor_asignado"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('asesor_asignado')}
                    />
                    <ExcelFilterHeader
                      title="Grupo Serv."
                      field="grupo_servicio"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('grupo_servicio')}
                    />
                    <ExcelFilterHeader
                      title="Distrito / Prov."
                      field="distrito"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('distrito')}
                    />
                    <ExcelFilterHeader
                      title="Palabra"
                      field="quien_tiene_la_palabra"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('quien_tiene_la_palabra')}
                    />
                    <ExcelFilterHeader
                      title="Estado Chat"
                      field="estado_chat"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('estado_chat')}
                    />
                    <ExcelFilterHeader
                      title="SLA"
                      field="semaforo_sla"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('semaforo_sla')}
                    />
                    <ExcelFilterHeader
                      title="Último Mensaje"
                      field="ultimo_mensaje_texto"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('ultimo_mensaje_texto')}
                      alignRight={true}
                    />
                    <ExcelFilterHeader
                      title="Fecha Último Msg"
                      field="ultimo_mensaje_fecha"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('ultimo_mensaje_fecha')}
                      alignRight={true}
                    />
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
                            row.quien_tiene_la_palabra === 'CONFIRMADO'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : row.quien_tiene_la_palabra === 'CLIENTE'
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              : (row.quien_tiene_la_palabra === 'PLANTILLA' || row.quien_tiene_la_palabra === 'BOT')
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              : 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                          }`}>
                            {row.quien_tiene_la_palabra === 'CONFIRMADO' && <Check className="w-3 h-3 text-emerald-400" />}
                            {row.quien_tiene_la_palabra || 'ASESOR'}
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
      </div>


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
