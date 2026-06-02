import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  Settings, 
  Clock, 
  RefreshCw, 
  LogOut, 
  ArrowLeft, 
  ExternalLink,
  ShieldAlert,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Info,
  Plus,
  Trash2,
  Edit,
  AlertTriangle
} from 'lucide-react';
import { WebUser, ActivityLog } from '../types';
import ContactAuthor from './ContactAuthor';
import UserEditModal from './UserEditModal';

interface AdminPanelProps {
  user: { id: string; name: string; role: 'dzialkowiec' | 'gosc' | 'admin' };
  onLogout: () => void;
  onBackToRemote: () => void;
}

export default function AdminPanel({ user, onLogout, onBackToRemote }: AdminPanelProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'config'>('users');

  // Datasets from secure APIs
  const [users, setUsers] = useState<WebUser[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [config, setConfig] = useState<any>(null);

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User Administration States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<WebUser | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Fetch all Administrative data from server
  const fetchAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // 1. Fetch Users
      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const uList = await usersRes.json();
        setUsers(uList);
      }

      // 2. Fetch Logs
      const logsRes = await fetch('/api/logs');
      if (logsRes.ok) {
        const lList = await logsRes.json();
        setLogs(lList);
      }

      // 3. Fetch System parameters
      const configRes = await fetch('/api/admin/config');
      if (configRes.ok) {
        const cData = await configRes.json();
        setConfig(cData);
      }
    } catch (err: any) {
      console.error('Failed to load datasets from secure server API:', err);
      setError('Problem z połączeniem z serwerem. Spróbuj odświeżyć dane.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Poll system logs and settings periodically
  useEffect(() => {
    fetchAllData();

    const interval = setInterval(() => {
      fetchAllData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Handle toggling "Tryb Imprezy" (Party Mode) setting securely in Google Sheets
  const handleTogglePartyMode = async (active: boolean) => {
    setActionLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const response = await fetch('/api/admin/save-sheets-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ partyMode: active }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        if (config) {
          setConfig({ ...config, partyModeActive: active });
        }
        setSuccess(`Tryb Imprezy został pomyślnie ${active ? 'WŁĄCZONY' : 'WYŁĄCZONY'}.`);
      } else {
        setError(data.error || 'Nie udało się zapisać zmiany Trybu Imprezy.');
      }
    } catch (err) {
      setError('Brak stabilnego połączenia z serwerem.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper trigger to open the user modal in Add Mode
  const handleOpenAddUser = () => {
    setUserToEdit(null);
    setIsModalOpen(true);
  };

  // Helper trigger to open the user modal in Edit Mode
  const handleOpenEditUser = (u: WebUser) => {
    setUserToEdit(u);
    setIsModalOpen(true);
  };

  // Controller to save user (Create/Update) proxying request to backend API
  const handleSaveUser = async (payload: any): Promise<boolean> => {
    setIsSavingUser(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/users/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        const actionMsg = payload.oldPlotNumber ? 'zaktualizowany' : 'dodany';
        setSuccess(`Działkowiec został pomyślnie ${actionMsg} w Arkuszu Google.`);
        fetchAllData(true);
        return true;
      } else {
        setError(data.error || 'Wystąpił błąd w Google Sheets podczas operacji zapisu.');
        return false;
      }
    } catch (err: any) {
      setError(`Błąd połączenia podczas zapisywania działkowca: ${err.message || err}`);
      return false;
    } finally {
      setIsSavingUser(false);
    }
  };

  // Controller to delete user from Google Sheets
  const handleDeleteUser = async (u: WebUser) => {
    const confirmName = u.name || `dla działki ${u.plotNumber}`;
    if (!confirm(`Czy na pewno chcesz usunąć działkowca: ${confirmName} (Działka nr ${u.plotNumber})?\n\nTa operacja usunie trwale wiersz w Arkuszu Google!`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plotNumber: u.plotNumber })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setSuccess(`Działkowiec ${confirmName} został usunięty z Arkuszu.`);
        fetchAllData(true);
      } else {
        setError(data.error || 'Wystąpił błąd podczas usuwania wiersza z Arkusza Google.');
      }
    } catch (err: any) {
      setError(`Błąd połączenia podczas usuwania działkowca: ${err.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30';
      case 'gosc':
      case 'gość':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30';
      default:
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30';
    }
  };

  const getRoleNamePL = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'Administrator';
      case 'gosc':
      case 'gość':
        return 'Gość';
      default:
        return 'Działkowiec';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 text-stone-850 dark:text-zinc-100 font-sans" id="admin-panel-root">
      
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-200 dark:border-zinc-900" id="admin-header">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToRemote}
            className="p-2 bg-stone-50 hover:bg-stone-100 dark:bg-zinc-905 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 rounded-xl text-stone-600 dark:text-zinc-400 cursor-pointer transition-all active:scale-95"
            title="Powrót do pilota"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-extrabold text-lg text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Panel Zarządcy</span>
            </h1>
            <p className="text-xs text-stone-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
              Zarządzanie systemem • Ogrody Stara Huta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchAllData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-stone-50 hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-stone-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Odśwież dane</span>
          </button>

          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-650 dark:text-rose-400 rounded-xl text-xs font-bold transition-all border border-rose-500/10 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Wyloguj się</span>
          </button>
        </div>
      </div>

      {/* Tabs Layout control */}
      <div className="flex items-center gap-1 bg-stone-150/50 dark:bg-zinc-900 p-1 rounded-2xl mb-6 border border-stone-200/50 dark:border-zinc-850" id="admin-tabs">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'users' 
              ? 'bg-white dark:bg-zinc-800 text-emerald-650 dark:text-white shadow-sm' 
              : 'text-stone-500 hover:text-stone-750 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 shadow-sm" />
          <span>Działkowcy ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'logs' 
              ? 'bg-white dark:bg-zinc-800 text-emerald-650 dark:text-white shadow-sm' 
              : 'text-stone-500 hover:text-stone-750 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 shadow-sm" />
          <span>Logi Zdarzeń ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'config' 
              ? 'bg-white dark:bg-zinc-800 text-emerald-650 dark:text-white shadow-sm' 
              : 'text-stone-500 hover:text-stone-750 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 shadow-sm" />
          <span>Konfiguracja</span>
        </button>
      </div>

      {/* Main Status feedbacks */}
      {error && (
        <div className="p-3.5 mb-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-rose-820 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2.5 leading-snug animate-fade-in">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 mb-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-400 text-xs rounded-xl flex items-start gap-2.5 leading-snug animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* VIEW PANEL TABS */}
      <div className="space-y-6" id="tab-viewport">
        
        {/* 1. USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-5 animate-fade-in">
            {/* Critical Banner: Google Sheets is master DB */}
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-955/10 border border-emerald-105/90 dark:border-emerald-900/30 rounded-2xl flex gap-3 text-xs text-emerald-850 dark:text-emerald-300 leading-normal font-medium shadow-[inset_0_1px_2px_rgba(16,185,129,0.02)]">
              <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-stone-900 dark:text-white font-extrabold text-[12.5px] uppercase mb-0.5 tracking-wide">Bezpieczna Baza Arkusza Google</strong>
                Modyfikacja użytkowników, blokowanie oraz przypisywanie kodów PIN jest teraz w pełni zintegrowane bezpośrednio z Arkuszem Google za pomocą bezpiecznych interfejsów API w czasie rzeczywistym.
                <div className="mt-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-405">
                  💡 Możesz edytować i blokować dane bezpośrednio przy każdym z wierszy poniżej lub dodawać nowych działkowców.
                </div>
              </div>
            </div>

            {/* Interactive Users table */}
            <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-stone-200/55 dark:border-zinc-850 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-stone-200/50 dark:border-zinc-850 bg-stone-50/50 dark:bg-zinc-950/30 gap-4 flex-wrap">
                <span className="font-bold text-xs uppercase text-stone-500 dark:text-zinc-400">Działkowcy z uprawnieniami wjazdu</span>
                
                <button
                  type="button"
                  onClick={handleOpenAddUser}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Dodaj Działkowca</span>
                </button>
              </div>

              {users.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400 dark:text-zinc-500">
                  {loading ? 'Pobieranie wierszy z tabeli...' : 'Brak użytkowników zdefiniowanych w zakładce "Użytkownicy" w Twoim Arkuszu Google.'}
                </div>
              ) : (
                <>
                  {/* Desktop view: standard table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200/40 dark:border-zinc-850/40 text-[10px] uppercase font-semibold text-stone-400 dark:text-zinc-500 bg-stone-50/10">
                          <th className="py-3 px-4">Imię i Nazwisko</th>
                          <th className="py-3 px-4">Nr Działki</th>
                          <th className="py-3 px-4">Rola</th>
                          <th className="py-3 px-4">PIN / Supla</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Akcje</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200/40 dark:divide-zinc-850/40 text-xs font-semibold">
                        {users.map((u, i) => {
                          const isBlocked = u.status === 'blocked';
                          return (
                            <tr key={i} className="hover:bg-stone-50/40 dark:hover:bg-zinc-800/20 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-bold text-stone-850 dark:text-white block">
                                  {u.name}
                                </span>
                                {isBlocked && u.blockReason && (
                                  <span className="text-[10px] text-red-650 dark:text-rose-400 block font-semibold mt-0.5" title="Powód blokady">
                                    Powód: {u.blockReason}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-stone-600 dark:text-zinc-300 font-mono">
                                {u.plotNumber || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase font-bold ${getRoleBadgeClass(u.role)}`}>
                                  {getRoleNamePL(u.role)}
                                </span>
                              </td>
                              <td className="py-3 px-4 space-y-0.5">
                                {u.pin ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-stone-100 dark:bg-zinc-850 px-1.5 py-0.5 rounded text-stone-600 dark:text-zinc-400 font-mono">
                                    PIN: {u.pin}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-stone-300 dark:text-zinc-650 italic block">Brak PIN</span>
                                )}
                                {u.suplaName && (
                                  <span className="text-[9.5px] text-stone-400 dark:text-zinc-500 block truncate max-w-[120px]" title={u.suplaName}>
                                    SUPLA: {u.suplaName}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {isBlocked ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-650 dark:text-rose-400 bg-red-55 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Zablokowany
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Aktywny
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditUser(u)}
                                    className="p-1.5 text-stone-550 hover:text-emerald-600 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                                    title="Edytuj dane"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 text-stone-400 hover:text-red-655 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                                    title="Usuń użytkownika"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile view: stack of custom responsive cards */}
                  <div className="block md:hidden divide-y divide-stone-100 dark:divide-zinc-850">
                    {users.map((u, i) => {
                      const isBlocked = u.status === 'blocked';
                      return (
                        <div key={i} className="p-4 space-y-3.5 hover:bg-stone-50/20 dark:hover:bg-zinc-800/10 transition-colors">
                          {/* Row 1: Name, Plot tag & Status pill */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <span className="font-bold text-stone-850 dark:text-white text-sm block">
                                {u.name}
                              </span>
                              <span className="inline-flex items-center text-[10.5px] bg-stone-100 dark:bg-zinc-850 text-stone-600 dark:text-zinc-400 font-mono px-2 py-0.5 rounded font-bold">
                                Działka: {u.plotNumber || '—'}
                              </span>
                            </div>

                            <div>
                              {isBlocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-750 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/30 px-2.5 py-0.5 rounded-full shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  Zablokowany
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/30 px-2.5 py-0.5 rounded-full shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Aktywny
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Block reason display if any */}
                          {isBlocked && u.blockReason && (
                            <div className="p-2.5 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/20 rounded-xl text-[11px] text-rose-800 dark:text-rose-303 font-medium">
                              <span className="font-bold uppercase tracking-wider text-[10px] text-rose-500 block mb-0.5">Powód blokady:</span>
                              {u.blockReason}
                            </div>
                          )}

                          {/* Row 2: Metadata (Role, Credentials PIN, SUPLA name) */}
                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-stone-50 dark:border-zinc-850/50 pt-2.5">
                            <div>
                              <span className="text-[10px] text-stone-400 dark:text-zinc-500 block font-semibold uppercase tracking-wider mb-0.5">System rola</span>
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] uppercase font-bold ${getRoleBadgeClass(u.role)}`}>
                                {getRoleNamePL(u.role)}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-stone-400 dark:text-zinc-500 block font-semibold uppercase tracking-wider mb-0.5">Dane PIN / SUPLA</span>
                              <div className="space-y-1">
                                {u.pin ? (
                                  <span className="inline-block text-[10px] bg-stone-100 dark:bg-zinc-850 px-1.5 py-0.5 rounded text-stone-600 dark:text-zinc-400 font-mono font-bold">
                                    PIN: {u.pin}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-stone-300 dark:text-zinc-650 italic block">Brak PIN</span>
                                )}
                                {u.suplaName && (
                                  <span className="text-[9.5px] text-stone-400 dark:text-zinc-550 block truncate max-w-[130px]" title={u.suplaName}>
                                    SUPLA: {u.suplaName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Row 3: Edit and Delete responsive actions bar */}
                          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-stone-100/60 dark:border-zinc-850/50">
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-stone-50 hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edytuj</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-red-50 hover:bg-red-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-red-100 dark:border-rose-950/30 text-red-700 dark:text-rose-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Usuń</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 2. ACTIVITY LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-stone-200/55 dark:border-zinc-850 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-stone-200/50 dark:border-zinc-850 bg-stone-50/50 dark:bg-zinc-950/30">
                <span className="font-bold text-xs uppercase text-stone-500 dark:text-zinc-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span>Historia Otwierania i Zdarzeń (Synchronizacja z Google Sheets)</span>
                </span>
                <span className="text-[10px] font-mono text-stone-400 dark:text-zinc-500">Ostatnie 100 wpisów</span>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400 dark:text-zinc-500">
                  {loading ? 'Pobieranie rzędów logów ze skryptu...' : 'Brak zapisanych logów w zakładce "Logi" w Arkuszu Google.'}
                </div>
              ) : (
                <div className="divide-y divide-stone-200/40 dark:divide-zinc-850/40 shrink-0 md:max-h-[600px] md:overflow-y-auto">
                  {logs.map((log) => {
                    const isSystem = log.userName === 'System' || log.userName === 'SYSTEM' || !log.userName;
                    const isActionOpen = log.action === 'OPEN' || log.details.includes('Otwarcie');
                    const isActionClose = log.action === 'CLOSE' || log.details.includes('Zamknięcie');
                    const isRejected = log.action === 'REJECTED' || log.details.includes('Odmowa');

                    return (
                      <div key={log.id} className="p-3.5 flex items-start gap-3 hover:bg-stone-50/30 dark:hover:bg-zinc-800/10 transition-all text-xs font-semibold">
                        <div className="shrink-0 mt-0.5">
                          {isRejected ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
                          ) : isActionOpen ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                          ) : isActionClose ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block shadow-[0_0_8px_rgba(244,63,94,0.4)]"></span>
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block"></span>
                          )}
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-bold transition-colors ${isSystem ? 'text-stone-400 dark:text-zinc-550' : 'text-stone-900 dark:text-white'}`}>
                              {isSystem ? 'Autopilot (System)' : log.userName}
                            </span>
                            <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-550 shrink-0">
                              {new Date(log.timestamp).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-stone-600 dark:text-zinc-400 text-[11.5px] leading-relaxed font-bold">
                            {log.details}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. HARDWARE CONFIG TAB (SUPLA + SHEETS CONFIG) */}
        {activeTab === 'config' && (
          <div className="space-y-6 animate-fade-in">
            {/* Tryb Imprezy Activation Card */}
            <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-stone-200/55 dark:border-zinc-850 p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-extrabold text-stone-900 dark:text-white text-sm uppercase tracking-wide">
                    Tryb Imprezy (Tryb awaryjny)
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 leading-normal font-medium">
                    Po włączeniu Trybu Imprezy wjazd dla standardowych Działkowców i Gości jest czasowo blokowany. Otwieranie barier będzie dozwolone wyłącznie dla użytkowników z rangą <strong>Admin</strong>.
                  </p>
                </div>

                <button
                  onClick={() => handleTogglePartyMode(!config?.partyModeActive)}
                  disabled={actionLoading || !config}
                  className="shrink-0 transition-transform active:scale-95 cursor-pointer disabled:opacity-40"
                  id="party-mode-toggle-icon"
                >
                  {config?.partyModeActive ? (
                    <ToggleRight className="w-14 h-8 text-emerald-605 fill-emerald-100 dark:fill-emerald-950/20" />
                  ) : (
                    <ToggleLeft className="w-14 h-8 text-stone-300 dark:text-zinc-800" />
                  )}
                </button>
              </div>

              <div className="text-[11.5px] bg-stone-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-stone-200/30 dark:border-zinc-850 text-stone-500 dark:text-zinc-400 font-bold flex items-center justify-between">
                <span>Aktualny Stan w Arkuszu Google (Ustawienia):</span>
                <span className={`uppercase font-mono text-[11px] px-2.5 py-0.5 rounded-lg border ${
                  config?.partyModeActive 
                    ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' 
                    : 'text-stone-400 dark:text-zinc-500 border-stone-200 dark:border-zinc-800'
                }`}>
                  {config?.partyModeActive ? 'Aktywny (Wjazd Zablokowany)' : 'Nieaktywny (Wjazd wolny)'}
                </span>
              </div>
            </div>

            {/* Config metadata fields and server parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SUPLA settings */}
              <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-stone-200/55 dark:border-zinc-850 p-5 shadow-sm space-y-4">
                <h3 className="font-extrabold text-stone-900 dark:text-white text-xs uppercase tracking-wide pb-2 border-b border-stone-200/40 dark:border-zinc-850">
                  Ustawienia Integratora SUPLA (.env)
                </h3>

                <div className="space-y-3 text-xs font-semibold">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-500 mb-0.5">Adres Serwera SUPLA</span>
                    <code className="text-stone-700 dark:text-zinc-300 font-mono font-bold">{config?.suplaServerUrl || 'Wczytywanie...'}</code>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-500 mb-0.5">Kanal Otwarcia</span>
                      <code className="text-stone-700 dark:text-zinc-300 font-mono font-bold">{config?.gateChannelId || '—'}</code>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-500 mb-0.5">Kanal Czujnika</span>
                      <code className="text-stone-700 dark:text-zinc-300 font-mono font-bold">{config?.sensorChannelId || '—'}</code>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-500 mb-0.5">Negacja czujnika (Invert)</span>
                    <code className="text-stone-700 dark:text-zinc-300 font-mono font-bold">{config?.invertSensor ? 'TAK (Odwrotna logika)' : 'NIE (Normalna logika)'}</code>
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-500 mb-0.5">Osobisty Token Integracji (Master)</span>
                    <code className="text-stone-400 dark:text-zinc-550 font-mono text-[10.5px]">
                      {config?.hasToken ? '•••••••••••••••• (Wykryto i Załadowano)' : 'Brak (Użytkownicy muszą używać własnych tokenów)'}
                    </code>
                  </div>
                </div>
              </div>

              {/* Google Sheets scripts */}
              <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-stone-200/55 dark:border-zinc-850 p-5 shadow-sm space-y-4">
                <h3 className="font-extrabold text-stone-900 dark:text-white text-xs uppercase tracking-wide pb-2 border-b border-stone-200/40 dark:border-zinc-850">
                  Integracja z Arkuszem Google
                </h3>

                <div className="space-y-3.5 text-xs font-semibold">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-500 mb-0.5">Adres Skryptu Apps Script</span>
                    <a 
                      href={config?.googleScriptUrl || '#'} 
                      target="_blank" 
                      referrerPolicy="no-referrer"
                      className="text-emerald-600 dark:text-emerald-400 font-mono font-bold hover:underline break-all inline-flex items-center gap-1 leading-snug"
                    >
                      <span>{config?.googleScriptUrl ? 'Skrypt Google Apps Script (Wdrożony)' : 'Nieobsługiwany'}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <div className="pt-2">
                    <span className="block text-[10px] uppercase font-bold text-stone-400 dark:text-zinc-500 mb-1">Połączenie z bazą</span>
                    <span className="p-2.5 rounded-xl border border-stone-100 dark:border-zinc-850 bg-stone-50/50 dark:bg-zinc-950/20 text-[11px] block text-stone-500 dark:text-zinc-400 font-bold leading-normal">
                      Pomyślnie zintegrowano. Wszystkie zapytania są zatwierdzane bezpiecznym kluczem sesyjnym i szyfrowane protokołem TLS/HTTPS.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Required Contact + Author credits */}
      <div className="mt-8">
        <ContactAuthor />
      </div>

      <UserEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userToEdit={userToEdit}
        onSave={handleSaveUser}
        isSubmitting={isSavingUser}
      />

    </div>
  );
}
