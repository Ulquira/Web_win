import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  UserPlus, 
  Shield, 
  X, 
  User, 
  Lock, 
  Phone, 
  Mail, 
  CreditCard, 
  AtSign 
} from 'lucide-react';

import { useEffect } from 'react';

interface UsersManagementViewProps {
  apiUrl: string;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({
  apiUrl
}) => {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

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

  useEffect(() => {
    fetchUsers();
  }, [apiUrl]);
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
    Area: 'INSTALACION',
    Rol: 'ASESOR'
  });

  const filteredUsers = usersList.filter(u => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.Nombre && u.Nombre.toLowerCase().includes(q)) ||
      (u.Usuario && u.Usuario.toLowerCase().includes(q)) ||
      (u.Documento && String(u.Documento).toLowerCase().includes(q)) ||
      (u.Area && u.Area.toLowerCase().includes(q)) ||
      (u.Rol && u.Rol.toLowerCase().includes(q)) ||
      (u.Email && u.Email.toLowerCase().includes(q))
    );
  });

  const handleToggleUserActivo = async (id: number, currentActivo: number) => {
    try {
      const nuevoActivo = currentActivo ? 0 : 1;
      const res = await fetch(`${apiUrl}/api/4dm1n_/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Activo: nuevoActivo })
      });
      if (!res.ok) throw new Error('Error al actualizar estado');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado del usuario');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);

    if (!userFormData.Nombre.trim() || !userFormData.Usuario.trim() || !userFormData.Password.trim()) {
      setUserFormError('Nombre, Usuario y Contraseña son campos obligatorios');
      return;
    }

    setIsSavingUser(true);
    try {
      const res = await fetch(`${apiUrl}/api/4dm1n_/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userFormData)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al crear usuario en BD_Phoenix');
      }

      setUserFormSuccess('¡Usuario creado exitosamente!');
      setTimeout(() => {
        setIsUserModalOpen(false);
        setUserFormSuccess(null);
        fetchUsers();
      }, 1000);
    } catch (err: any) {
      setUserFormError(err.message || 'Error de conexión al registrar usuario');
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros / Barra de Usuarios */}
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

      {/* Tabla de Usuarios */}
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
    </div>
  );
};
