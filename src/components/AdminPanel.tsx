import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Users, Shield, Settings, Clock, Bell, UserPlus, Trash2, KeyRound, Radio, ShieldAlert, CheckCircle, RefreshCw, LogOut, ArrowRight, Save, Send, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { WebUser, ActivityLog, GateStatus, PushSubscriptionInfo } from '../types';
import ContactAuthor from './ContactAuthor';

interface AdminPanelProps {
  user: { id: string; name: string; role: 'dzialkowiec' | 'gosc' | 'admin' };
  onLogout: () => void;
  onBackToRemote: () => void;
}

export default function AdminPanel({ user, onLogout, onBackToRemote }: AdminPanelProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'users' | 'bulk' | 'logs' | 'config' | 'push'>('users');

  // Real-time server states
  const [users, setUsers] = useState<WebUser[]>([]);
  const [pinRequests, setPinRequests] = useState<any[]>([]);
  const [activePinRequest, setActivePinRequest] = useState<any | null>(null);
  const [resolvedTemporaryPin, setResolvedTemporaryPin] = useState('');
  const [pinRequestError, setPinRequestError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);
  const [subscribers, setSubscribers] = useState<PushSubscriptionInfo[]>([]);
  const [gate, setGate] = useState<GateStatus | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Form states - user editing/creation
  const [editingUser, setEditingUser] = useState<Partial<WebUser> | null>(null);
  const [formName, setFormName] = useState('');
  const [formPlotNumber, setFormPlotNumber] = useState('');
  const [formPasscode, setFormPasscode] = useState('');
  const [formRole, setFormRole] = useState<'dzialkowiec' | 'gosc' | 'admin'>('dzialkowiec');
  const [formStatus, setFormStatus] = useState<'active' | 'blocked'>('active');
  const [formReason, setFormReason] = useState('');
  const [formSuplaToken, setFormSuplaToken] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form states - Bulk Actions
  const [bulkReason, setBulkReason] = useState('Tymczasowe zablokowanie dostępu z powodu zaplanowanej imprezy w domu działkowca.');
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  // Form states - SUPLA Config
  const [configServer, setConfigServer] = useState('');
  const [configChannel, setConfigChannel] = useState('');
  const [configSensorChannel, setConfigSensorChannel] = useState('');
  const [configInvertSensor, setConfigInvertSensor] = useState(false);
  const [configToken, setConfigToken] = useState('');
  const [configPassword, setConfigPassword] = useState('');
  const [configGoogleScriptUrl, setConfigGoogleScriptUrl] = useState('');
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // Google Sheets integration state
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  // Form states - Periodic Lockout Schedule
  const [lockScheduleEnabled, setLockScheduleEnabled] = useState(false);
  const [lockScheduleStart, setLockScheduleStart] = useState('2026-05-30T06:00');
  const [lockScheduleEnd, setLockScheduleEnd] = useState('2026-05-31T22:00');
  const [lockScheduleReason, setLockScheduleReason] = useState('Weekendowa blokada wjazdu (sobota 6:00 - niedziela 22:00).');
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Form states - Push Broadcaster
  const [pushTitle, setPushTitle] = useState('Ważny komunikat zarządu');
  const [pushMsg, setPushMsg] = useState('Dostęp do bramy został czasowo zmodyfikowany z powodu organizacji imprezy w domu działkowca.');
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);

  // Fetch all administrative datasets
  const fetchAllData = async () => {
    try {
      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData);
      }

      const pinRequestsRes = await fetch('/api/admin/pin-requests');
      if (pinRequestsRes.ok) {
        const pRequests = await pinRequestsRes.json();
        setPinRequests(pRequests);
      }

      const logsRes = await fetch('/api/logs');
      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogs(lData);
      }

      const configRes = await fetch('/api/admin/config');
      if (configRes.ok) {
        const cData = await configRes.json();
        setConfigServer(cData.suplaServerUrl);
        setConfigChannel(cData.gateChannelId);
        setConfigSensorChannel(cData.sensorChannelId || '2014');
        setConfigInvertSensor(!!cData.invertSensor);
        setConfigPassword(cData.adminPassword);
        setConfigGoogleScriptUrl(cData.googleScriptUrl || '');

        if (cData.lockSchedule) {
          setLockScheduleEnabled(cData.lockSchedule.enabled);
          setLockScheduleStart(cData.lockSchedule.startDateTime);
          setLockScheduleEnd(cData.lockSchedule.endDateTime);
          setLockScheduleReason(cData.lockSchedule.reason);
        }
      }

      const subRes = await fetch('/api/push/subscribers');
      if (subRes.ok) {
        const subs = await subRes.json();
        setSubscribers(subs);
        setSubscribersCount(subs.length);
      }

      const statusRes = await fetch('/api/gate/status');
      if (statusRes.ok) {
        const gState = await statusRes.json();
        setGate(gState);
      }
    } catch (err) {
      console.error('Failed to load admin datasets', err);
    }
  };

  // Poll gate status & logs periodically to keep the admin panel fully live
  useEffect(() => {
    fetchAllData();

    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch('/api/gate/status');
        if (statusRes.ok) {
          const gState = await statusRes.json();
          setGate(gState);
        }
        
        // Also fetch newer log entries so real-time activity is shown to admins
        const logsRes = await fetch('/api/logs');
        if (logsRes.ok) {
          const lData = await logsRes.json();
          setLogs(lData);
        }

        const pinRequestsRes = await fetch('/api/admin/pin-requests');
        if (pinRequestsRes.ok) {
          const pRequests = await pinRequestsRes.json();
          setPinRequests(pRequests);
        }
      } catch (err) {
        console.error('Failed to poll background updates in admin panel', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Handle gate trigger commands directly in administrative session
  const triggerGate = async (action: 'OPEN' | 'CLOSE') => {
    setGateLoading(true);
    setGateError(null);
    try {
      const response = await fetch('/api/gate/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          userName: user.name,
          userRole: 'admin'
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setGate(data.gateState);
        // Refresh logs immediately so the admin sees their action in the history
        const logsRes = await fetch('/api/logs');
        if (logsRes.ok) {
          const lData = await logsRes.json();
          setLogs(lData);
        }
      } else {
        setGateError(data.error || 'Wystąpił problem przy wysyłaniu komendy.');
      }
    } catch (err) {
      setGateError('Błąd komunikacji z bramą.');
    } finally {
      setGateLoading(false);
    }
  };

  // Set user for editing
  const selectUserForEdit = (user: WebUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormPlotNumber(user.plotNumber || '');
    setFormPasscode(user.passcode);
    setFormRole(user.role as any);
    setFormStatus(user.status);
    setFormReason(user.blockReason || '');
    setFormSuplaToken(user.suplaAccessToken || '');
    setFormError(null);
    setFormSuccess(null);
  };

  // Open creation user form
  const selectUserForCreate = () => {
    setEditingUser({});
    setFormName('');
    setFormPlotNumber('');
    setFormPasscode('');
    setFormRole('dzialkowiec');
    setFormStatus('active');
    setFormReason('');
    setFormSuplaToken('');
    setFormError(null);
    setFormSuccess(null);
  };

  // Submit User form (Create / Update)
  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formName || !formPlotNumber || !formPasscode) {
      setFormError('Proszę wypełnić wszystkie wymagane pola (Imię i nazwisko, Numer działki, PIN).');
      return;
    }

    const payload = {
      id: editingUser?.id || undefined,
      name: formName,
      plotNumber: formPlotNumber,
      passcode: formPasscode,
      role: formRole,
      status: formStatus,
      blockReason: formStatus === 'blocked' ? (formReason || 'Dostęp zablokowany przez administratora.') : '',
      suplaAccessToken: formSuplaToken
    };

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setFormSuccess(editingUser?.id ? 'Konto pomyślnie zaktualizowane.' : 'Pomyślnie dodano użytkownika.');
        setEditingUser(null);
        fetchAllData();
      } else {
        setFormError(data.error || 'Wystąpił nieznany błąd.');
      }
    } catch (err) {
      setFormError('Błąd połączenia z serwerem.');
    }
  };

  // Delete User
  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Czy na pewno chcesz całkowicie usunąć użytkownika ${name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchAllData();
      }
    } catch (err) {
      console.error('Delete action failed', err);
    }
  };

  // Trigger Role-based Bulk overrides
  const handleBulkAction = async (targetRole: 'dzialkowiec' | 'gosc', action: 'BLOCK' | 'UNBLOCK') => {
    setBulkSuccess(null);
    try {
      const response = await fetch('/api/admin/users/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole,
          action,
          reason: action === 'BLOCK' ? bulkReason : ''
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setBulkSuccess(`Pomyślnie zmodyfikowano stany wejściowe dla ${data.modifiedCount} osób.`);
        fetchAllData();
      }
    } catch (err) {
      console.error('Bulk override failed', err);
    }
  };

  // Update System/SUPLA Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccess(null);
    try {
      const r = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suplaServerUrl: configServer,
          gateChannelId: configChannel,
          sensorChannelId: configSensorChannel,
          invertSensor: configInvertSensor,
          suplaAccessToken: configToken,
          adminPassword: configPassword,
          googleScriptUrl: configGoogleScriptUrl,
          lockSchedule: {
            enabled: lockScheduleEnabled,
            startDateTime: lockScheduleStart,
            endDateTime: lockScheduleEnd,
            reason: lockScheduleReason
          }
        })
      });
      if (r.ok) {
        setConfigSuccess('Parametry systemu i harmonogramu zostały pomyślnie zaktualizowane.');
        setConfigToken(''); // Clear token field for safety
        fetchAllData();
      }
    } catch (err) {
      console.error('Config update failed', err);
    }
  };

  // Google Sheets Party Mode Settings Directly
  const handleToggleSheetsPartyMode = async (active: boolean) => {
    setSheetsLoading(true);
    setSheetsError(null);
    try {
      const response = await fetch('/api/admin/save-sheets-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyMode: active })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (gate) {
          setGate({ ...gate, partyModeActive: active });
        }
      } else {
        setSheetsError(data.error || 'Błąd przy zmianie statusu w Arkuszu Google.');
      }
    } catch (err) {
      setSheetsError('Brak połączenia z zewnętrznym serwerem integracji.');
    } finally {
      setSheetsLoading(false);
    }
  };

  // Zapisz sam harmonogram blokad dla zakładki Dom Działkowca
  const handleSaveScheduleOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleSuccess(null);
    setScheduleError(null);
    try {
      const r = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lockSchedule: {
            enabled: lockScheduleEnabled,
            startDateTime: lockScheduleStart,
            endDateTime: lockScheduleEnd,
            reason: lockScheduleReason
          }
        })
      });
      if (r.ok) {
        setScheduleSuccess('Harmonogram i godziny blokady zostały pomyślnie zaktualizowane.');
        fetchAllData();
      } else {
        setScheduleError('Wystąpił błąd podczas zapisywania harmonogramu.');
      }
    } catch (err) {
      console.error('Schedule update failed', err);
      setScheduleError('Błąd połączenia z serwerem.');
    }
  };

  // Reusable Pilot Creation/Edit Form
  const renderUserForm = () => {
    if (editingUser === null) return null;
    return (
      <form onSubmit={handleUserFormSubmit} className="p-5 bg-zinc-950 border border-emerald-900/40 rounded-2xl space-y-4 animate-fade-in" id="user-editor-form">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-900 mb-2">
          <span className="font-bold text-xs uppercase text-emerald-400">
            {editingUser.id ? 'Edycja uprawnień pilota' : 'Tworzenie nowego pilota (kodu)'}
          </span>
          <button
            type="button"
            onClick={() => setEditingUser(null)}
            className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
          >
            Anuluj
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Imię i Nazwisko</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="np. Jan Kowalski"
              className="w-full p-2.5 bg-zinc-900 border border-zinc-850 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Numer Działki / Pokoju</label>
            <input
              type="text"
              required
              value={formPlotNumber}
              onChange={(e) => setFormPlotNumber(e.target.value)}
              placeholder="np. 15"
              className="w-full p-2.5 bg-zinc-900 border border-zinc-850 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">4-cyfrowy PIN dostępu</label>
            <input
              type="text"
              required
              maxLength={4}
              value={formPasscode}
              onChange={(e) => setFormPasscode(e.target.value)}
              placeholder="np. 1234"
              className="w-full p-2.5 bg-zinc-900 border border-zinc-855 rounded-xl focus:border-emerald-500 text-white focus:outline-none font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Rola / Kategoria użytkownika</label>
            <select
              value={formRole}
              onChange={(e: any) => setFormRole(e.target.value)}
              className="w-full p-2.5 bg-zinc-900 border border-zinc-850 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-sm"
            >
              <option value="dzialkowiec">Działkowiec (Stara Huta)</option>
              <option value="gosc">Gość / Dostawca (Tymczasowy)</option>
              <option value="admin">Administrator (Zarząd / Współadministrator)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Status Dostępu</label>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => setFormStatus('active')}
                className={`py-1.5 px-4 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${formStatus === 'active' ? 'bg-emerald-950 border border-emerald-500 text-emerald-400' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'}`}
              >
                Aktywny / Odblokowany
              </button>
              
              <button
                type="button"
                onClick={() => setFormStatus('blocked')}
                className={`py-1.5 px-4 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${formStatus === 'blocked' ? 'bg-red-950 border border-red-500 text-red-400' : 'bg-zinc-900 border border-zinc-805 text-zinc-500'}`}
              >
                Dostęp Zablokowany
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Osobisty Klucz (Token dostępu Bearer) SUPLA (Wpisuje i zarządza administrator)</label>
            <input
              type="text"
              value={formSuplaToken}
              onChange={(e) => setFormSuplaToken(e.target.value)}
              placeholder="Wklej osobisty token dostępu do Chmury SUPLA dla tego użytkownika"
              className="w-full p-2.5 bg-zinc-900 border border-zinc-855 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-xs font-mono"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Dzięki temu ten pilot będzie sterował fizyczną barierą za pomocą dedykowanych uprawnień danej osoby w Chmurze SUPLA. Użytkownicy końcowi nie mają bezpośredniego dostępu do edycji lub podglądu tego tokenu.
            </p>
          </div>
        </div>

        {formStatus === 'blocked' && (
          <div className="animate-fade-in space-y-1">
            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Uzasadnienie blokady (użytkownik zobaczy to przy logowaniu)</label>
            <input
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="Np. Zaległości ze składkami / czasowe zawieszenie"
              className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-red-500 text-white focus:outline-none text-sm"
            />
          </div>
        )}

        {formError && <div className="text-xs text-red-400 font-semibold">{formError}</div>}
        {formSuccess && <div className="text-xs text-emerald-400 font-semibold">{formSuccess}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setEditingUser(null)}
            className="py-2 px-4 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-zinc-400 hover:text-white transition-colors text-xs font-semibold border border-zinc-800 cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 py-2 px-5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white transition-colors text-xs font-bold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Zapisz
          </button>
        </div>
      </form>
    );
  };

  // Broadcast Simulated/Real push notify
  const handlePushBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setPushSuccess(null);
    try {
      const r = await fetch('/api/admin/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushTitle,
          message: pushMsg
        })
      });
      if (r.ok) {
        const data = await r.json();
        setPushSuccess(`Wysłano powiadomienie do ${data.subsCount} urządzeń u wszystkich zalogowanych użytkowników!`);
        fetchAllData();
      }
    } catch (err) {
      console.error('Push broadcast failed', err);
    }
  };

  // Helpers for labels
  const formatTimeFull = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pl-PL');
  };

  const submitResolvePinRequest = async () => {
    if (!resolvedTemporaryPin || resolvedTemporaryPin.length !== 4) {
      setPinRequestError('PIN musi składać się z dokładnie 4 cyfr.');
      return;
    }

    try {
      const response = await fetch('/api/admin/pin-requests/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: activePinRequest.id,
          newPin: resolvedTemporaryPin
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setActivePinRequest(null);
        setResolvedTemporaryPin('');
        setPinRequestError(null);
        fetchAllData();
      } else {
        setPinRequestError(data.error || 'Błąd zapisu PIN.');
      }
    } catch (err) {
      setPinRequestError('Błąd połączenia z serwerem.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 text-stone-850 dark:text-zinc-100 font-sans transition-colors" id="admin-panel-container">
      {/* Banner / Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-emerald-100/80 dark:border-zinc-900" id="admin-header">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-emerald-150 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-zinc-950/80 p-0.5 shadow-sm flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-1" id="admin-shield-icon">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400 rounded-md">
                ZARZĄD OGRODÓW
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">Centralny Panel Sterowania</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400 mt-1">
              <span>Zalogowany jako:</span>
              <span className="px-2 py-0.5 bg-[#009966] border border-[#009966] rounded text-white font-bold">{user.name}</span>
              <span className="text-zinc-650">|</span>
              <span className="text-zinc-500">Rola: Administrator</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToRemote}
            className="inline-flex items-center gap-1.5 py-2 px-3 bg-[#009966] hover:bg-[#008055] font-bold text-white rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-emerald-950/25"
          >
            <ArrowUpCircle className="w-3.5 h-3.5 -rotate-90" />
            <span>Wróć do pilota</span>
          </button>

          <button
            onClick={fetchAllData}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Odśwież dane"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 py-2.5 px-4 bg-zinc-900 hover:bg-red-950/20 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-zinc-700/50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Wyloguj panel
          </button>
        </div>
      </div>

      {/* Tabs list navigation */}
      <div className="bg-stone-50 dark:bg-zinc-900/40 p-1.5 rounded-2xl border border-emerald-100/90 dark:border-zinc-850/60 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-8 shadow-sm transition-all" id="admin-tabs">
        <button
          onClick={() => setActiveTab('users')}
          className={`py-2.5 px-2 font-black text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${activeTab === 'users' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200 hover:bg-stone-100/60 dark:hover:bg-zinc-900/60'}`}
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Uprawnienia (Konta)</span>
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`py-2.5 px-2 font-black text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${activeTab === 'bulk' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200 hover:bg-stone-100/60 dark:hover:bg-zinc-900/60'}`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Dom Działkowca</span>
        </button>
        <button
          onClick={() => setActiveTab('push')}
          className={`py-2.5 px-2 font-black text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${activeTab === 'push' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200 hover:bg-stone-100/60 dark:hover:bg-zinc-900/60'}`}
          id="tab-push"
        >
          <Bell className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Powiadomienia Push</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`py-2.5 px-2 font-black text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${activeTab === 'logs' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200 hover:bg-stone-100/60 dark:hover:bg-zinc-900/60'}`}
        >
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Historia i Logi</span>
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`py-2.5 px-2 font-black text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${activeTab === 'config' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20' : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-200 hover:bg-stone-100/60 dark:hover:bg-zinc-900/60'}`}
        >
          <Radio className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">SUPLA i System</span>
        </button>
      </div>

      {/* Dynamic Content Views */}

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="space-y-6" id="view-users-tab">
          {/* Forgotten PIN Requests Banner */}
          {pinRequests.length > 0 && (
            <div className="bg-amber-955/20 border border-amber-900/40 rounded-2xl p-4 space-y-3 animate-fade-in text-zinc-100 mb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
                <span>Aktywne wnioski o reset kodu PIN ({pinRequests.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-1">
                {pinRequests.map((req) => (
                  <div key={req.id} className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-900 flex flex-col justify-between gap-2.5">
                    <div>
                      <div className="flex items-center justify-between font-bold text-xs mb-1">
                        <span className="text-white">{req.name}</span>
                        <span className="text-emerald-400">Działka {req.plotNumber}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 font-medium">
                        Kontakt: <span className="text-zinc-350 font-normal">{req.contactDetails || 'brak'}</span>
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-900/60 mt-0.5">
                      <span className="text-[9px] text-zinc-500 font-mono">Zgłoszono: {formatTimeFull(req.requestedAt)}</span>
                      <button
                        onClick={() => {
                          setActivePinRequest(req);
                          setResolvedTemporaryPin('');
                          setPinRequestError(null);
                        }}
                        className="py-1 px-2.5 bg-amber-650 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Nadaj nowy PIN</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <span>Lista autoryzowanych pilotów</span>
              <span className="text-xs px-2 py-0.5 bg-[#009966] border border-[#009966] rounded text-black font-semibold">{users.length} zarejestrowanych</span>
            </h2>
            <button
              onClick={selectUserForCreate}
              className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-[#009966] hover:bg-[#008055] text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-md shadow-emerald-950/20"
            >
              <UserPlus className="w-4 h-4" />
              Dodaj Pilota
            </button>
          </div>

          {/* User Form inside view (Edit / Create) */}
          {editingUser !== null && !editingUser.id && renderUserForm()}

          {/* User grid database representation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="users-grid-container">
            {users.map((u) => {
              const isEditingThisUser = editingUser !== null && editingUser.id === u.id;
              const isBlocked = u.status === 'blocked';
              return (
                <React.Fragment key={u.id}>
                  <div
                    id={`user-item-${u.id}`}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      isBlocked 
                        ? 'border-red-955/40 bg-red-955/5' 
                        : 'border-[#009966] bg-[#009966]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-sm ${isBlocked ? 'text-white' : 'text-black'}`}>{u.name}</span>
                          {u.plotNumber && (
                            <span className={`px-1.5 py-0.5 border rounded text-[10px] font-mono font-bold ${
                              isBlocked 
                                ? 'bg-emerald-955/40 border-emerald-900/40 text-emerald-400' 
                                : 'bg-black/20 border-black/10 text-white'
                            }`}>
                              Działka {u.plotNumber}
                            </span>
                          )}
                          {u.role === 'admin' ? (
                            <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase tracking-wider ${
                              isBlocked 
                                ? 'bg-amber-955/40 border-amber-500/30 text-amber-400'
                                : 'bg-black/30 border-black/10 text-white'
                            }`}>
                              Administrator
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 border rounded text-[9px] font-semibold uppercase ${
                              isBlocked 
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                : 'bg-black/20 border-black/15 text-white'
                            }`}>
                              {u.role === 'gosc' ? 'Gość' : 'Działkowiec'}
                            </span>
                          )}
                        </div>

                        <div className={`flex items-center gap-2 text-xs font-mono ${isBlocked ? 'text-zinc-500' : 'text-black'}`}>
                          <KeyRound className={`w-3.5 h-3.5 ${isBlocked ? 'text-zinc-655' : 'text-black'}`} />
                          <span>Kod: <strong className={`font-bold tracking-wider ${isBlocked ? 'text-zinc-300' : 'text-white'}`}>{u.passcode}</strong></span>
                        </div>

                        {u.suplaAccessToken && (
                          <div className={`flex items-center gap-1.5 text-[10px] font-medium pt-1 ${isBlocked ? 'text-emerald-500' : 'text-white'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-emerald-500' : 'bg-white'}`}></span>
                            <span>Osobisty Token SUPLA: <span className={`font-bold ${isBlocked ? 'text-emerald-400' : 'text-white'}`}>AKTYWNY</span></span>
                          </div>
                        )}
                      </div>

                      {/* Quick toggle status */}
                      <div className="flex items-center gap-1.5">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-955/40 border border-red-900/40 px-2 py-0.5 rounded-lg">
                            <ShieldAlert className="w-3 h-3" />
                            Zablokowany
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#008055] border border-black/10 px-2 py-0.5 rounded-lg">
                            <CheckCircle className="w-3 h-3 text-white" />
                            Aktywny
                          </span>
                        )}
                      </div>
                    </div>

                    {isBlocked && u.blockReason && (
                      <div className="mt-3 p-2 bg-red-955/20 border border-red-900/10 rounded-xl text-xs text-red-500 leading-relaxed">
                        <span className="font-semibold block text-[10px] uppercase text-red-500 mb-0.5">Uzasadnienie blokady:</span>
                        &ldquo;{u.blockReason}&rdquo;
                      </div>
                    )}

                    <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                      isBlocked 
                        ? 'border-zinc-900/60 text-zinc-655' 
                        : 'border-black/15 text-black'
                    }`}>
                      <span>Dodano: {new Date(u.createdAt).toLocaleDateString()}</span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => selectUserForEdit(u)}
                          className={`py-1 px-2.5 rounded-lg font-medium transition-colors cursor-pointer ${
                            isBlocked
                              ? (isEditingThisUser 
                                ? 'bg-emerald-600 text-white font-bold' 
                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-450')
                              : (isEditingThisUser
                                ? 'bg-[#008055] text-white font-bold border border-black/10'
                                : 'bg-black/25 hover:bg-black/40 text-white')
                          }`}
                        >
                          {isEditingThisUser ? 'Tryb edycji...' : 'Edytuj pilota'}
                        </button>
                        
                        <button
                          onClick={() => deleteUser(u.id, u.name)}
                          className={`py-1 px-1.5 rounded-lg transition-colors cursor-pointer border border-transparent ${
                            isBlocked
                              ? 'bg-zinc-900 hover:bg-red-955/30 text-zinc-500 hover:text-red-400 hover:border-red-900/20'
                              : 'bg-black/25 hover:bg-red-750 text-white'
                          }`}
                          title="Usuń pilota"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {isEditingThisUser && (
                    <div className="col-span-1 md:col-span-2">
                      {renderUserForm()}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Bulk Actions (Dom Działkowca realtime scenarios) */}
      {activeTab === 'bulk' && (
        <div className="space-y-6" id="view-bulk-tab">
          {/* Tryb Imprezy Google Sheets Card */}
          {configGoogleScriptUrl && (
            <div className="bg-zinc-950 p-6 rounded-3xl border border-emerald-900/40 shadow-[0_4px_24px_rgba(16,185,129,0.02)] space-y-4 animate-fade-in" id="google-sheets-sync-panel">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                    Integracja Google Sheets (Tryb Imprezy)
                  </h3>
                  <p className="text-xs text-zinc-400 leading-normal mt-1 max-w-xl">
                    Twój arkusz Google i skrypt są aktywne. Tryb Imprezy pozwala fizycznie zablokować wjazd wszystkim działkowcom jednym kliknięciem z poziomu Twojego Arkusza (komórka B1) lub poniższym suwakiem.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={sheetsLoading}
                    onClick={() => handleToggleSheetsPartyMode(!gate?.partyModeActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none disabled:opacity-40 ${
                      gate?.partyModeActive ? 'bg-amber-500' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        gate?.partyModeActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {sheetsError && (
                <div className="p-2.5 bg-red-955/35 border border-red-900/30 rounded-xl text-[11px] text-red-400 font-semibold leading-snug">
                  {sheetsError}
                </div>
              )}

              <div className="flex items-center gap-2.5 p-3.5 bg-zinc-900/55 rounded-2xl border border-zinc-850">
                <div className="p-1 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex-shrink-0">
                  {gate?.partyModeActive ? 'AKTYWNY' : 'DEZAKTYWNY'}
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  {gate?.partyModeActive 
                    ? 'Status: Blokada wjazdu włączona. Tylko administratorzy mogą otwierać bramę (Wpis B1 w Arkuszu = TRUE).' 
                    : 'Status: Wzorcowy. Wjazd dostępny dla wszystkich zarejestrowanych działkowców (Wpis B1 w Arkuszu = FALSE).'}
                </p>
              </div>
            </div>
          )}

          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 space-y-4">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <span>Grupowa Regulacja Dostępów w Czasie Rzeczywistym</span>
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Zapewnij natychmiastowe uprawnienia dla określonych grup. Pomocne przy imprezach w domu działkowca lub zebraniach zarządu ogrodu. 
              Możesz jednocześnie zablokować wszystkich standardowych Działkowców (aby parking był tylko dla zaproszonych gości) i nadać piloty dla gości z zewnątrz, a po zakończeniu imprezy jednym przyciskiem przywrócić regularny stan.
            </p>
            
            <div className="space-y-1 pt-2">
              <label className="block text-[10px] uppercase font-bold text-zinc-400">Powód blokady grupowej: (będzie wyświetlona u zablokowanych)</label>
              <textarea
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                className="w-full p-2.5 bg-zinc-900 border border-zinc-850 rounded-xl focus:border-amber-500 text-zinc-200 text-xs focus:outline-none min-h-[60px]"
              />
            </div>

            {bulkSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-xs text-emerald-400 font-medium">
                {bulkSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Box Gardeners */}
              <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-850 space-y-3">
                <span className="font-bold text-xs uppercase text-zinc-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Uprawnienia: Działkowcy
                </span>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => handleBulkAction('dzialkowiec', 'UNBLOCK')}
                    className="py-2.5 px-3 bg-zinc-950 hover:bg-zinc-850 text-emerald-400 hover:text-emerald-300 font-semibold rounded-xl border border-zinc-800 transition-all cursor-pointer"
                  >
                    Odblokuj wszystkich
                  </button>
                  <button
                    onClick={() => handleBulkAction('dzialkowiec', 'BLOCK')}
                    className="py-2.5 px-3 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 transition-all rounded-xl font-semibold cursor-pointer"
                  >
                    Zablokuj wszystkich
                  </button>
                </div>
              </div>

              {/* Box Guests */}
              <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-850 space-y-3">
                <span className="font-bold text-xs uppercase text-zinc-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Uprawnienia: Goście / Dostawcy
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => handleBulkAction('gosc', 'UNBLOCK')}
                    className="py-2.5 px-3 bg-zinc-950 hover:bg-zinc-850 text-emerald-400 hover:text-emerald-300 font-semibold rounded-xl border border-zinc-800 transition-all cursor-pointer"
                  >
                    Odblokuj wszystkich
                  </button>
                  <button
                    onClick={() => handleBulkAction('gosc', 'BLOCK')}
                    className="py-2.5 px-3 bg-red-955/20 hover:bg-red-955/40 text-red-400 border border-red-900/30 transition-all rounded-xl font-semibold cursor-pointer"
                  >
                    Zablokuj wszystkich
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sekcja: Harmonogram i Godziny Blokad z Kalendarzem */}
          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span>Kalendarz i Godziny Okresowych Blokad</span>
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl mt-1">
                  Zaplanuj automatyczne blokowanie możliwości otwierania bramy przez Działkowców i Gości w określonym przedziale czasowym (np. weekendy, noce, konserwacje). 
                  Administratorzy zachowują pełną zdolność otwierania bramy przez cały czas trwania blokady.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setLockScheduleEnabled(!lockScheduleEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                    lockScheduleEnabled ? 'bg-amber-500' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      lockScheduleEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveScheduleOnly} className="space-y-4">
              {lockScheduleEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 font-sans">Rozpoczęcie blokady</label>
                    <input
                      type="datetime-local"
                      required
                      value={lockScheduleStart}
                      onChange={(e) => setLockScheduleStart(e.target.value)}
                      className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-amber-500 text-white focus:outline-none font-mono"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 font-sans">Zakończenie blokady</label>
                    <input
                      type="datetime-local"
                      required
                      value={lockScheduleEnd}
                      onChange={(e) => setLockScheduleEnd(e.target.value)}
                      className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-amber-500 text-white focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 font-sans">Komunikat wyświetlany użytkownikom</label>
                    <input
                      type="text"
                      required
                      value={lockScheduleReason}
                      onChange={(e) => setLockScheduleReason(e.target.value)}
                      placeholder="np. Weekendowa konserwacja systemu..."
                      className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-amber-500 text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {scheduleSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-emerald-400 text-xs font-semibold animate-fade-in">
                  {scheduleSuccess}
                </div>
              )}

              {scheduleError && (
                <div className="p-3 bg-red-955/40 border border-red-900/50 rounded-xl text-red-400 text-xs font-semibold animate-fade-in">
                  {scheduleError}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                >
                  <Save className="w-4 h-4" />
                  Zapisz harmonogram i godziny blokady
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Push Notifications */}
      {activeTab === 'push' && (
        <div className="space-y-6" id="view-push-tab">
          {/* Broadcast alert to all active pilots */}
          <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900 space-y-4 animate-fade-in">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-500" />
              <span>Wyślij Powiadomienie Push do Użytkowników</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Prześlij natychmiastowe ogłoszenie o statusie bramy lub zarządzenia na telefony i komputery użytkowników posiadających aktywną subskrypcję ({subscribersCount} urządzeń).
            </p>

            <form onSubmit={handlePushBroadcast} className="space-y-3 pt-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1 space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-zinc-500">Nagłówek powiadomienia</label>
                  <input
                    type="text"
                    required
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-emerald-500 text-white focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-zinc-500">Treść powiadomienia push</label>
                  <input
                    type="text"
                    required
                    value={pushMsg}
                    onChange={(e) => setPushMsg(e.target.value)}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-emerald-500 text-white focus:outline-none"
                  />
                </div>
              </div>

              {pushSuccess && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-400 text-xs font-semibold">
                  {pushSuccess}
                </div>
              )}

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                Nadaj sygnał powiadomienia push
              </button>
            </form>

            <div className="pt-4 border-t border-zinc-900">
              <span className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-3">
                Zarejestrowane urządzenia subskrybujące ({subscribers.length})
              </span>
              {subscribers.length === 0 ? (
                <div className="text-xs text-zinc-500 italic p-3 bg-zinc-900/40 rounded-xl border border-zinc-850 text-center">
                  Brak aktywnych subskrybentów na tym serwerze.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {subscribers.map((sub) => {
                    const formattedDate = new Date(sub.subscribedAt).toLocaleString('pl-PL', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div key={sub.id} className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-850/80 hover:border-zinc-800 transition-colors flex flex-col justify-between gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-zinc-200">{sub.userName}</span>
                          <span className="text-[9px] text-zinc-500 font-mono px-1.5 py-0.5 bg-zinc-950/40 rounded border border-zinc-900">
                            {formattedDate}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 truncate leading-relaxed">
                          {sub.deviceInfo}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dziennik doręczeń powiadomień push - Tylko dla Administratora */}
            <div className="pt-4 border-t border-zinc-900 space-y-3">
              <span className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Dziennik doręczeń powiadomień push (Tylko dla Administratora)
              </span>
              {(() => {
                const pushRelatedLogs = logs.filter(l => 
                  l.action === 'PUSH_SENT' || 
                  (l.action === 'SYSTEM' && l.details.toLowerCase().includes('zasubskrybowano'))
                ).slice(0, 5);

                if (pushRelatedLogs.length === 0) {
                  return (
                    <p className="text-[11px] text-zinc-500 italic text-center p-3 bg-zinc-900/30 rounded-xl border border-zinc-850/50">
                      Brak ostatnich wpisów doręczeń powiadomień push w rejestrze systemowym.
                    </p>
                  );
                }

                return (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
                    {pushRelatedLogs.map((log) => {
                      const date = new Date(log.timestamp);
                      const formattedTime = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      return (
                        <div key={log.id} className="p-2.5 bg-zinc-905 border border-zinc-850/60 rounded-xl text-[11px] flex items-start gap-2 hover:bg-zinc-900/40 transition-all">
                          <span className="font-mono text-[9px] text-zinc-500 mt-0.5">{formattedTime}</span>
                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-350 text-[10px]">{log.userName}</span>
                              <span className={`text-[7px] font-extrabold px-1 rounded uppercase font-mono ${
                                log.action === 'PUSH_SENT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/35' : 'bg-zinc-900 text-zinc-400 border border-zinc-850'
                              }`}>
                                {log.action}
                              </span>
                            </div>
                            <p className="text-zinc-400 leading-normal font-medium">{log.details}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Logs (Event history) */}
      {activeTab === 'logs' && (
        <div className="space-y-6" id="view-logs-tab">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Historia wszystkich zdarzeń i wjazdów</h2>
            <span className="text-xs font-mono text-zinc-500">Zapisano {logs.length} zdarzeń</span>
          </div>

          <div className="bg-zinc-950 rounded-2xl border border-zinc-900 overflow-hidden" id="logs-container">
            <div className="p-3 bg-zinc-900/50 border-b border-zinc-900 text-xs font-bold text-zinc-400 grid grid-cols-12 gap-3 truncate">
              <span className="col-span-3">Sygnatura czasowa</span>
              <span className="col-span-3">Zgłaszający użytkownik</span>
              <span className="col-span-2 text-center">Akcja</span>
              <span className="col-span-4">Szczegóły zdarzenia</span>
            </div>

            <div className="max-h-[450px] overflow-y-auto divide-y divide-zinc-900">
              {logs.map((l) => (
                <div key={l.id} className="p-3 grid grid-cols-12 gap-3 text-xs items-center hover:bg-zinc-900/20 transition-colors">
                  <span className="col-span-3 font-mono text-zinc-500 text-[11px]">{formatTimeFull(l.timestamp)}</span>
                  <div className="col-span-3 flex items-center gap-1">
                    <span className="font-semibold text-zinc-300">{l.userName}</span>
                    <span className="text-[7.5px] px-1 bg-zinc-900 border border-zinc-850 rounded text-zinc-500 uppercase font-mono font-bold scale-[0.9]">
                      {l.userRole === 'admin' ? 'AD' : l.userRole === 'gosc' ? 'GŚ' : l.userRole === 'system' ? 'SY' : 'DZ'}
                    </span>
                  </div>
                  
                  <div className="col-span-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider ${
                      l.action === 'OPEN' ? 'bg-emerald-950/60 border border-emerald-900/40 text-emerald-400' :
                      l.action === 'CLOSE' ? 'bg-rose-950/60 border border-rose-900/40 text-rose-400' :
                      l.action === 'BLOCK' ? 'bg-red-950 text-red-400 border border-red-900/30' :
                      l.action === 'UNBLOCK' ? 'bg-emerald-950 text-emerald-400' :
                      l.action === 'BULK_ACTION' ? 'bg-amber-950 border border-amber-900/30 text-amber-500' :
                      'bg-zinc-900 border border-zinc-800 text-zinc-400'
                    }`}>
                      {l.action}
                    </span>
                  </div>

                  <span className="col-span-4 text-zinc-400 line-clamp-2 text-left">{l.details}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Config */}
      {activeTab === 'config' && (
        <div className="space-y-6" id="view-config-tab">
          <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-900 space-y-6">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Zarządzanie parametrami integracji SUPLA</h2>
            
            <form onSubmit={handleSaveConfig} className="space-y-4" id="config-settings-form">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs uppercase font-bold text-zinc-400">Adres Serwera SUPLA Cloud</label>
                  <input
                    type="text"
                    required
                    value={configServer}
                    onChange={(e) => setConfigServer(e.target.value)}
                    placeholder="https://svr150.supla.org"
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-xs font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 leading-none">Domena serwera, na którym znajduje się Twoje konto.</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs uppercase font-bold text-zinc-400">Przekaźnik bramy (ID)</label>
                  <input
                    type="text"
                    required
                    value={configChannel}
                    onChange={(e) => setConfigChannel(e.target.value)}
                    placeholder="2012"
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-xs font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 leading-none">Kanał otwierania/zamykania bramy (ID 2012).</span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs uppercase font-bold text-zinc-400">Czujnik otwarcia (ID)</label>
                  <input
                    type="text"
                    required
                    value={configSensorChannel}
                    onChange={(e) => setConfigSensorChannel(e.target.value)}
                    placeholder="2014"
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-xs font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 leading-none">Kanał binarnego czujnika stanu bramy (ID 2014).</span>
                </div>
              </div>

              {/* Sensor Inversion Toggle */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/60 rounded-2xl border border-zinc-850/80">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
                    Odwrócenie logiki czujnika binarnego
                  </h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Włącz tę opcję, jeśli aplikacja pokazuje „Brama Otwarta”, gdy brama jest fizycznie zamknięta, oraz odwrotnie (odwraca interpretację sygnału High/Low).
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setConfigInvertSensor(!configInvertSensor)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                      configInvertSensor ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        configInvertSensor ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className="block text-xs uppercase font-bold text-amber-500">Supla Personal Access Token (Klucz Bearer)*</label>
                <div className="p-0.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-teal-500/10 shadow-sm">
                  <input
                    type="password"
                    placeholder="Zostaw puste, aby nie zmieniać (Wklej nowy token Supla, aby zaktualizować podgląd bramy)"
                    value={configToken}
                    onChange={(e) => setConfigToken(e.target.value)}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl text-white focus:outline-none text-xs font-mono"
                  />
                </div>
                <span className="text-[10.5px] text-zinc-650 dark:text-zinc-300 mt-1 block bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/40 p-3 rounded-xl leading-relaxed">
                  🔑 <strong>Jak wygenerować Osobisty Token Dostępu w SUPLA?</strong><br />
                  1. Przejdź bezpośrednio do strony: <a href="https://cloud.supla.org/security/personal-access-tokens" target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold">cloud.supla.org/security/personal-access-tokens</a><br />
                  2. Zlokalizuj ścieżkę: <strong>Konto - Bezpieczeństwo - osobiste tokeny dostępowe</strong>.<br />
                  3. Kliknij <strong>Utwórz nowy token</strong> (upewnij się, że ma zaznaczone uprawnienia do sterowania właściwymi kanałami).<br />
                  4. Skopiuj wygenerowany token i <strong>wklej go dokładnie w pole powyżej</strong>, a potem kliknij przycisk na dole: „Zatwierdź i zsynchronizuj parametry”.
                </span>
              </div>

              {/* Google Sheets Web App URL */}
              <div className="space-y-1 pt-2">
                <label className="block text-xs uppercase font-bold text-emerald-400 font-sans">Adres Skryptu Weryfikacyjnego Google Sheets (Web App URL)</label>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/..."
                  value={configGoogleScriptUrl}
                  onChange={(e) => setConfigGoogleScriptUrl(e.target.value)}
                  className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-xs font-mono"
                />
                <span className="text-[10px] text-zinc-550 block">Pojawi się tutaj automatyczny link do Twojego opublikowanego skryptu Google Sheets (Web App), synchronizujący użytkowników, logowanie i blokady w czasie rzeczywistym.</span>
              </div>

              {/* Master Administrator Password updating */}
              <div className="space-y-1 pt-2">
                <label className="block text-xs uppercase font-bold text-zinc-400">Główne Hasło Administratora Panelu</label>
                <input
                  type="text"
                  required
                  value={configPassword}
                  onChange={(e) => setConfigPassword(e.target.value)}
                  className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:border-emerald-500 text-white focus:outline-none text-xs font-mono"
                />
                <span className="text-[10px] text-zinc-500">Uniwersalne hasło służące do wejścia do tego Centralnego Panelu Sterowania.</span>
              </div>

              {configSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-emerald-400 text-xs font-semibold animate-fade-in">
                  {configSuccess}
                </div>
              )}

              <button
                type="submit"
                className="w-full justify-center inline-flex items-center gap-1.5 py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-all cursor-pointer shadow-md"
              >
                <Save className="w-4 h-4" />
                Zatwierdź i zsynchronizuj parametry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin metrics card */}
      <div className={`grid grid-cols-1 ${activeTab === 'push' ? 'md:grid-cols-2' : 'max-w-md mx-auto w-full'} gap-4 mt-8 pt-4 border-t border-zinc-900`}>
        {activeTab === 'push' && (
          <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-900/50 text-center flex flex-col items-center justify-center min-h-[145px]">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Subskrybenci powiadomień</span>
            <span className="text-xl font-mono font-bold text-white block">
              {subscribersCount} urządzeń
            </span>
          </div>
        )}

        <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-900/50 flex flex-col items-center justify-between min-h-[145px] text-center">
          <div className="w-full">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Status fizycznej Bramy</span>
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className={`w-2 h-2 rounded-full ${gate?.state === 'OPEN' ? 'bg-emerald-450 shadow-[0_0_8px_#10b981]' : gate?.state === 'CLOSED' ? 'bg-rose-455 shadow-[0_0_8px_#f43f5e]' : 'bg-amber-400 animate-pulse'}`}></span>
              <span className={`text-xs font-extrabold ${gate?.state === 'OPEN' ? 'text-emerald-400' : gate?.state === 'CLOSED' ? 'text-rose-400' : 'text-amber-400 animate-pulse'}`}>
                {gate?.state === 'OPEN' ? 'Otwarta (Rozsunięta)' : gate?.state === 'CLOSED' ? 'Zamknięta (Zabezpieczona)' : 'W ruchu / Przejściowy'}
              </span>
            </div>
          </div>
          
          <div className="w-full flex items-center gap-2 mt-1">
            <button
              onClick={() => triggerGate('OPEN')}
              disabled={gateLoading || gate?.state === 'OPEN'}
              className="flex-1 py-2 px-1 bg-zinc-900 hover:bg-emerald-950/20 border border-zinc-800 hover:border-emerald-500/30 text-zinc-300 hover:text-emerald-400 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-1"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              Otwórz
            </button>
            
            <button
              onClick={() => triggerGate('CLOSE')}
              disabled={gateLoading || gate?.state === 'CLOSED'}
              className="flex-1 py-2 px-1 bg-zinc-900 hover:bg-rose-950/20 border border-zinc-800 hover:border-rose-500/30 text-zinc-300 hover:text-rose-400 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-1"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              Zamknij
            </button>
          </div>
          {gateError && (
            <span className="text-[9px] text-rose-500 mt-1.5 block leading-tight">{gateError}</span>
          )}
        </div>
      </div>

      {/* Required Contact + Author credits on footer margin */}
      <ContactAuthor />

      {/* Admin resolving forgotten PIN request modal overlay */}
      {activePinRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-805 rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in text-zinc-100">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-amber-950/40 border border-amber-900/35 text-amber-500 rounded-full animate-bounce">
                  <KeyRound className="w-8 h-8" />
                </div>
              </div>
              <h3 className="font-bold text-white text-base">Zresetuj PIN</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Nadaj nowy tymczasowy 4-cyfrowy kod PIN dla: <strong className="text-white block mt-0.5">{activePinRequest.name} (Działka {activePinRequest.plotNumber})</strong>
              </p>
            </div>

            <div className="space-y-1.5 focus-within:text-emerald-500">
              <label className="block text-[10px] uppercase font-bold text-zinc-500">
                Nowy PIN tymczasowy (4 cyfry)
              </label>
              <input
                type="text"
                maxLength={4}
                value={resolvedTemporaryPin}
                onChange={(e) => setResolvedTemporaryPin(e.target.value.replace(/\D/g, ''))}
                placeholder="np. 4321"
                className="w-full py-2.5 px-3 bg-zinc-900 border border-zinc-850 rounded-lg focus:border-emerald-500 text-white text-sm font-mono text-center tracking-widest focus:outline-none"
              />
            </div>

            {pinRequestError && (
              <div className="p-3 bg-red-950/20 border border-red-900/30 text-[11px] font-semibold text-red-400 rounded-lg">
                {pinRequestError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setActivePinRequest(null);
                  setResolvedTemporaryPin('');
                  setPinRequestError(null);
                }}
                className="w-1/2 py-2.5 border border-zinc-850 bg-zinc-900 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={submitResolvePinRequest}
                className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
              >
                Zatwierdź PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
