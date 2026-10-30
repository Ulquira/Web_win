import React, { useState, useEffect, useMemo } from 'react';
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
  PieChart,
  Activity,
  CheckCheck,
  TrendingUp,
  MapPin,
  Users,
  UserPlus,
  Shield,
  Mail,
  Phone,
  Lock,
  CreditCard,
  AtSign
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
  const [grupoServicio, setGrupoServicio] = useState('');
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

  // Estados para pestaña de Control de Roles & Usuarios
  interface UserItem {
    IDuser: number;
    Nombre: string;
    Documento: string;
    Telefono?: string | null;
    Email: string;
    Usuario: string;
    Area: 'INSTALACION' | 'PROVINCIA' | 'AVERIAS' | 'ADMIN';
    Rol: 'ADMIN' | 'SUPERVISOR' | 'COORDINADOR' | 'ASESOR';
    Activo: number;
    created_at?: string;
  }
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSuccess, setUserFormSuccess] = useState<string | null>(null);
  const [userFormData, setUserFormData] = useState({
    Nombre: '',
    Documento: '',
    Telefono: '',
    Email: '',
    Usuario: '',
    Password: '',
    Area: 'INSTALACION' as 'INSTALACION' | 'PROVINCIA' | 'AVERIAS' | 'ADMIN',
    Rol: 'ASESOR' as 'ADMIN' | 'SUPERVISOR' | 'COORDINADOR' | 'ASESOR'
  });

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`${apiUrl}/api/4dm1n_/users`);
      const dataRes = await res.json();
      if (dataRes.success && Array.isArray(dataRes.users)) {
        setUsersList(dataRes.users);
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);
    setIsSavingUser(true);

    try {
      const res = await fetch(`${apiUrl}/api/4dm1n_/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData)
      });
      const dataRes = await res.json();
      if (!res.ok || !dataRes.success) {
        throw new Error(dataRes.message || 'Error al registrar usuario');
      }
      setUserFormSuccess('¡Usuario creado exitosamente!');
      setTimeout(() => {
        setIsUserModalOpen(false);
        setUserFormSuccess(null);
        fetchUsers();
      }, 1000);
    } catch (err: any) {
      setUserFormError(err.message || 'Error al guardar el usuario');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleToggleUserActivo = async (id: number, currentActivo: number) => {
    try {
      const newActivo = currentActivo ? 0 : 1;
      const res = await fetch(`${apiUrl}/api/4dm1n_/users/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: newActivo })
      });
      if (res.ok) {
        setUsersList(prev => prev.map(u => u.IDuser === id ? { ...u, Activo: newActivo } : u));
      }
    } catch (err) {
      console.error('Error alternando estado:', err);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!userSearch) return usersList;
    const term = userSearch.toLowerCase().trim();
    return usersList.filter(u => 
      u.Nombre.toLowerCase().includes(term) ||
      u.Documento.toLowerCase().includes(term) ||
      u.Usuario.toLowerCase().includes(term) ||
      u.Email.toLowerCase().includes(term) ||
      u.Area.toLowerCase().includes(term) ||
      u.Rol.toLowerCase().includes(term)
    );
  }, [usersList, userSearch]);

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
      clean === 'si' ||
      clean === 'sí' ||
      clean === 'ok' ||
      clean === 'de acuerdo' ||
      clean.startsWith('si, confirmo') ||
      clean.startsWith('si confirmo') ||
      clean.startsWith('sí, confirmo')
    ) {
      return true;
    }
    return /^(si\s*,?\s*confirmo|confirmado|confirmar|si\s+confirmo|sí\s+confirmo|si|sí|ok|de\s+acuerdo)(\s+gracias|\s*[\.!]*)*$/i.test(clean);
  };

  const normalizeChatsRows = (items: any[]): any[] => {
    return items.map((row: any) => {
      const msg = row.ultimo_mensaje_texto || '';
      if (isConfirmationMessage(msg)) {
        return {
          ...row,
          quien_tiene_la_palabra: 'CONFIRMADO',
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
      if (currentGrupo) params.append('grupoServicio', currentGrupo);
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
      if (currentGrupo) params.append('grupoServicio', currentGrupo);

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
      if (currentGrupo) fallbackParams.append('grupoServicio', currentGrupo);

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
  }, [activeTab, limit, grupoServicio, sortField, sortOrder, apiUrl]);

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
        return String(row.distrito ?? row.provincia ?? row.Localidad ?? '');
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
              {(search || grupoServicio || fechaInicio !== getTodayPeruString() || fechaFin !== getTodayPeruString()) && (
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

            {/* Grupo de Servicio */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Grupo de Servicio</label>
              <select
                value={grupoServicio}
                onChange={e => {
                  setGrupoServicio(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
              >
                <option value="">Todos los grupos</option>
                <optgroup label="Tipos de Operación">
                  {(filtrosOpciones.gruposServicioMantra && filtrosOpciones.gruposServicioMantra.length > 0
                    ? filtrosOpciones.gruposServicioMantra.filter(g => !['Instalacion', 'Averias'].includes(g))
                    : ['INSTALACION', 'AVERIAS', 'PROVINCIA', 'POSTVENTA', 'AVERIAS PRV']
                  ).map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </optgroup>
                <optgroup label="Canales Mantra">
                  <option value="Instalacion">Canal Instalacion</option>
                  <option value="Averias">Canal Averias</option>
                </optgroup>
              </select>
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

        {/* Barra de Filtros / Barra de Usuarios */}
        {activeTab === 'usuarios' && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur flex flex-col md:flex-row items-center justify-between gap-4 z-30">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Usuarios
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-orange-400 border border-slate-700 font-mono">
                    {usersList.length}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar usuario, área, rol..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => fetchUsers()}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all active:scale-95 cursor-pointer"
                title="Refrescar usuarios"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin text-orange-400' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserFormData({
                    Nombre: '',
                    Documento: '',
                    Telefono: '',
                    Email: '',
                    Usuario: '',
                    Password: '',
                    Area: 'INSTALACION',
                    Rol: 'ASESOR'
                  });
                  setUserFormError(null);
                  setUserFormSuccess(null);
                  setIsUserModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/25 shrink-0 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Registrar Usuario</span>
              </button>
            </div>
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
        ) : activeTab === 'dashboard_chats' ? (
          /* Vista: Dashboard Chat */
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
        ) : activeTab === 'usuarios' ? (
          /* Vista de Usuarios y Roles */
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur relative min-h-[400px]">
            <div className="overflow-x-auto max-h-[650px] scrollbar-thin scrollbar-thumb-slate-700">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Nombre Completo</th>
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Email Corporativo</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Área Operativa</th>
                    <th className="py-3 px-4">Rol Asignado</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Fecha Creación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-400">
                        <RefreshCw className="w-7 h-7 animate-spin mx-auto text-orange-500 mb-2" />
                        <span>Cargando directorio de usuarios de BD_Phoenix...</span>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-400">
                        No se encontraron usuarios registrados en la tabla user. Haz clic en "+ Registrar Usuario" para añadir uno.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const areaColor = 
                        u.Area === 'ADMIN' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                        u.Area === 'AVERIAS' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                        u.Area === 'PROVINCIA' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                        'bg-sky-500/10 text-sky-400 border-sky-500/30';

                      const rolColor = 
                        u.Rol === 'ADMIN' ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' :
                        u.Rol === 'SUPERVISOR' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' :
                        u.Rol === 'COORDINADOR' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' :
                        'bg-slate-700/50 text-slate-300 border-slate-600';

                      return (
                        <tr key={u.IDuser} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400">#{u.IDuser}</td>
                          <td className="py-3 px-4 font-semibold text-white">{u.Nombre}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{u.Documento}</td>
                          <td className="py-3 px-4 font-mono text-orange-300">{u.Usuario}</td>
                          <td className="py-3 px-4 text-slate-400">{u.Email}</td>
                          <td className="py-3 px-4 text-slate-400">{u.Telefono || '-'}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${areaColor}`}>
                              {u.Area}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${rolColor}`}>
                              {u.Rol === 'ADMIN' && <Shield className="w-3 h-3 text-amber-400" />}
                              {u.Rol}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleUserActivo(u.IDuser, u.Activo)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                u.Activo 
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' 
                                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                              }`}
                            >
                              {u.Activo ? '● Activo' : '○ Inactivo'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString('es-PE') : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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
                <thead className="bg-slate-950/80 sticky top-0 z-20 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Acción</th>
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
                      field="Localidad"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      columnFilters={columnFilters}
                      onFilterChange={handleColumnFilterChange}
                      activeDropdown={activeFilterDropdown}
                      setActiveDropdown={setActiveFilterDropdown}
                      allValues={getUniqueValuesForField('Localidad')}
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
                      alignRight={true}
                    />
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


      {/* Modal Moderno para Crear Usuario */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0F141F] border border-slate-800/90 rounded-3xl w-full max-w-lg shadow-[0_25px_70px_rgba(0,0,0,0.7)] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800/70 px-6 py-4 bg-[#141A29]/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">Nuevo Usuario</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {userFormError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{userFormError}</span>
                </div>
              )}

              {userFormSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                  <span>✅</span>
                  <span>{userFormSuccess}</span>
                </div>
              )}

              {/* Fila 1: Nombre & Documento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Nombre Completo</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Juan Pérez"
                      value={userFormData.Nombre}
                      onChange={(e) => setUserFormData({ ...userFormData, Nombre: e.target.value })}
                      className="w-full bg-[#0A0D14] border border-slate-800/90 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Documento (DNI/CE)</label>
                  <div className="relative">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="72345678"
                      value={userFormData.Documento}
                      onChange={(e) => setUserFormData({ ...userFormData, Documento: e.target.value })}
                      className="w-full bg-[#0A0D14] border border-slate-800/90 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 font-mono transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Fila 2: Usuario & Contraseña */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Usuario (Login)</label>
                  <div className="relative">
                    <AtSign className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="jperez"
                      value={userFormData.Usuario}
                      onChange={(e) => setUserFormData({ ...userFormData, Usuario: e.target.value })}
                      className="w-full bg-[#0A0D14] border border-slate-800/90 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 font-mono transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Contraseña</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={userFormData.Password}
                      onChange={(e) => setUserFormData({ ...userFormData, Password: e.target.value })}
                      className="w-full bg-[#0A0D14] border border-slate-800/90 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Fila 3: Email & Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Email Corporativo</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="jperez@win.pe"
                      value={userFormData.Email}
                      onChange={(e) => setUserFormData({ ...userFormData, Email: e.target.value })}
                      className="w-full bg-[#0A0D14] border border-slate-800/90 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Teléfono</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="987654321"
                      value={userFormData.Telefono}
                      onChange={(e) => setUserFormData({ ...userFormData, Telefono: e.target.value })}
                      className="w-full bg-[#0A0D14] border border-slate-800/90 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Selector Moderno de Área */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Área Operativa</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['INSTALACION', 'PROVINCIA', 'AVERIAS', 'ADMIN'] as const).map(area => {
                    const isSel = userFormData.Area === area;
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => setUserFormData({ ...userFormData, Area: area })}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all text-center cursor-pointer ${
                          isSel
                            ? 'bg-[#FF5A0A]/20 border-[#FF5A0A] text-[#FF5A0A] shadow-sm shadow-orange-500/20'
                            : 'bg-[#0A0D14] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector Moderno de Rol */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Rol Asignado</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['ADMIN', 'SUPERVISOR', 'COORDINADOR', 'ASESOR'] as const).map(rol => {
                    const isSel = userFormData.Rol === rol;
                    return (
                      <button
                        key={rol}
                        type="button"
                        onClick={() => setUserFormData({ ...userFormData, Rol: rol })}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
                          isSel
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/20'
                            : 'bg-[#0A0D14] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {rol === 'ADMIN' && <Shield className="w-3 h-3 text-amber-400 shrink-0" />}
                        <span>{rol}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="flex items-center gap-2 px-5 py-2 bg-[#FF5A0A] hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/25 cursor-pointer"
                >
                  {isSavingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
