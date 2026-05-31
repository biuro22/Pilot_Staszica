import React, { useState, useEffect } from 'react';
import { 
  Power, 
  LogOut, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Clock, 
  Shield, 
  Bell, 
  User, 
  RefreshCw, 
  Layers, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  HelpCircle 
} from 'lucide-react';
import { GateStatus } from '../types';
import ContactAuthor from './ContactAuthor';
import NotificationSettings from './NotificationSettings';

interface GateControlProps {
  user: { id: string; name: string; role: 'dzialkowiec' | 'gosc' | 'admin'; suplaAccessToken?: string };
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
}

export default function GateControl({ user, onLogout, onOpenAdminPanel }: GateControlProps) {
  const [gate, setGate] = useState<GateStatus>({
    state: 'CLOSED',
    lastUpdated: new Date().toISOString(),
    suplaConnected: false,
    suplaServerUrl: 'https://svr150.supla.org',
    channelId: '2012',
    lastActionBy: 'System'
  });
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);

  // Individual token states removed as user should not see/edit it themselves

  // Fetch gate status functions (passing userId query param)
  const fetchGateStatus = async () => {
    try {
      const res = await fetch(`/api/gate/status?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setGate(data);
      }
    } catch (err) {
      console.error('Failed to fetch gate status', err);
    }
  };

  // Poll status
  useEffect(() => {
    fetchGateStatus();

    if (!pollingActive) return;

    const interval = setInterval(() => {
      fetchGateStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingActive]);

  // Handle gate trigger commands with personal credentials
  const triggerGate = async (action: 'OPEN' | 'CLOSE') => {
    setLoading(true);
    setActionError(null);
    try {
      const response = await fetch('/api/gate/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          userId: user.id,
          userName: user.name,
          userRole: user.role
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setGate(data.gateState);
      } else {
        setActionError(data.error || 'Wystąpił problem przy wysyłaniu komendy.');
      }
    } catch (err) {
      setActionError('Błąd komunikacji z bramą.');
    } finally {
      setLoading(false);
    }
  };

  // Polish helper for state labels and styles
  const getStateConfig = () => {
    switch (gate.state) {
      case 'OPEN':
        return {
          text: 'Brama Otwarta',
          description: 'Wjazd wolny',
          colorClass: 'emerald-600',
          bgClass: 'bg-emerald-50/95 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400 shadow-[inset_0_1px_2px_rgba(16,185,129,0.05)]',
          dotClass: 'bg-emerald-550 shadow-[0_0_12px_#10b981]'
        };
      case 'CLOSED':
        return {
          text: 'Brama Zamknięta',
          description: 'Wjazd zabezpieczony',
          colorClass: 'rose-600',
          bgClass: 'bg-rose-50/95 dark:bg-rose-950/20 border-rose-100 dark:border-rose-500/20 text-rose-800 dark:text-rose-400 shadow-[inset_0_1px_2px_rgba(244,63,94,0.05)]',
          dotClass: 'bg-rose-555 shadow-[0_0_12px_#f43f5e]'
        };
      case 'OPENING':
        return {
          text: 'Brama się otwiera...',
          description: 'Trwa rozsuwanie skrzydeł',
          colorClass: 'amber-605',
          bgClass: 'bg-amber-50/95 dark:bg-amber-400/10 border-amber-100 dark:border-amber-400/20 text-amber-805 dark:text-amber-300 animate-pulse',
          dotClass: 'bg-amber-400 shadow-[0_0_12px_#fbbf24] animate-ping'
        };
      case 'CLOSING':
        return {
          text: 'Brama się zamyka...',
          description: 'Uwaga, brama w ruchu',
          colorClass: 'amber-605',
          bgClass: 'bg-amber-50/95 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-850 dark:text-amber-400 animate-pulse',
          dotClass: 'bg-amber-500 shadow-[0_0_12px_#f59e0b] animate-ping'
        };
      default:
        return {
          text: 'Stan Nieznany',
          description: 'Sprawdzanie stanu barier',
          colorClass: 'zinc-555',
          bgClass: 'bg-stone-50 dark:bg-zinc-800/50 border-stone-200 dark:border-zinc-700/50 text-stone-600 dark:text-zinc-400',
          dotClass: 'bg-zinc-500'
        };
    }
  };

  const stateConfig = getStateConfig();

  // Date format utility
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 text-stone-850 dark:text-zinc-100 font-sans transition-colors" id="gate-control-container">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-emerald-100/80 dark:border-zinc-900" id="gate-header">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center border border-emerald-100 dark:border-zinc-800 bg-emerald-50/50 dark:bg-zinc-950 flex-shrink-0 text-emerald-600 dark:text-emerald-400 shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-stone-900 dark:text-white">Ogrody Stara Huta</h2>
            <div className="flex items-center gap-1.5 text-[10px] text-stone-500 dark:text-zinc-500 font-bold">
              <User className="w-3 h-3 text-emerald-500" />
              <span className="font-bold text-stone-700 dark:text-zinc-400 truncate max-w-[120px]">{user.name}</span>
              <span className="bg-emerald-50 dark:bg-zinc-900 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-zinc-800 text-[9px] uppercase font-bold text-emerald-800 dark:text-zinc-400">
                {user.role === 'admin' ? 'Admin' : user.role === 'gosc' ? 'Gość' : 'Działkowiec'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {user.role === 'admin' && onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="flex items-center gap-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] text-white rounded-xl text-xs font-extrabold transition-all shadow-[0_4px_10px_rgba(16,185,129,0.2)] cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-white" />
              <span className="text-white">Panel Admina</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-stone-50 hover:bg-stone-105 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-800 text-stone-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
            id="logout-button"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Wyjdź</span>
          </button>
        </div>
      </div>

      {/* Main Remote Key Fob */}
      <div className="bg-white/95 dark:bg-gradient-to-b dark:from-zinc-950 dark:to-zinc-900 rounded-3xl p-6 border border-emerald-100/90 dark:border-zinc-850 shadow-[0_16px_48px_rgba(16,185,129,0.06)] dark:shadow-2xl space-y-6 relative overflow-hidden mb-6 transition-all" id="key-fob">
        {/* Antena ring decorative */}
        <div className="absolute top-2 right-4 w-4 h-12 bg-emerald-500/5 dark:bg-zinc-800/10 rounded-full border border-emerald-500/10 dark:border-zinc-700/10 flex items-center justify-center">
          <div className="w-1.5 h-6 bg-emerald-555/20 dark:bg-zinc-855/30 rounded-full animate-pulse"></div>
        </div>

        {/* Gate State Indicator Monitor */}
        <div className={`p-4 rounded-2xl border ${stateConfig.bgClass} flex items-center justify-between transition-all duration-500 bg-opacity-95`} id="state-monitor-box">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-stone-500 dark:text-zinc-500 block">Stan Ogrodzenia</span>
            <span className="text-lg font-black block tracking-tight" id="gate-state-display-text">
              {stateConfig.text}
            </span>
            <span className="text-xs font-bold opacity-90 block">
              {stateConfig.description}
            </span>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <div className="flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-full ${stateConfig.dotClass} transition-all duration-500`}></span>
            </div>
          </div>
        </div>

        {/* Google Sheets Party Mode warning banner */}
        {gate.partyModeActive && user.role !== 'admin' && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-start gap-3 animate-fade-in text-[11px] text-amber-800 dark:text-amber-300 leading-normal font-medium">
            <span className="p-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 block text-[10px] font-bold uppercase shrink-0 font-mono text-amber-800 dark:text-amber-400">INFO</span>
            <div>
              <strong className="block text-[11.5px] font-extrabold uppercase mb-0.5 tracking-wider">Blokada: Tryb Imprezy</strong>
              Wjazd został czasowo zablokowany przez zarząd (aktywny Tryb Imprezy w Arkuszu Google).
            </div>
          </div>
        )}

        {/* Remote Buttons */}
        <div className="grid grid-cols-1 gap-4" id="fob-buttons-grid">
          {/* Button: OTWÓRZ */}
          <button
            onClick={() => triggerGate('OPEN')}
            disabled={loading || gate.state === 'OPENING' || gate.state === 'OPEN'}
            className="group relative w-full py-5.5 bg-stone-50 dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 hover:border-emerald-350 dark:hover:border-emerald-500/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 overflow-hidden shadow-sm hover:shadow dark:shadow-inner cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]"
            id="fob-open-button"
          >
            <ArrowUpCircle className={`w-10 h-10 transition-colors text-stone-300 dark:text-zinc-650 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 ${gate.state === 'OPEN' ? 'text-emerald-600 dark:text-emerald-500' : ''}`} />
            <div className="text-center">
              <span className="block text-sm font-extrabold uppercase tracking-widest text-stone-800 dark:text-zinc-300 group-hover:text-emerald-900 dark:group-hover:text-emerald-105">Otwórz Bramę</span>
              <span className="text-[10px] font-bold text-stone-405 dark:text-zinc-500 group-hover:text-emerald-700/80 dark:group-hover:text-emerald-505/80">Sygnał otwarcia skrzydła</span>
            </div>
          </button>

          {/* Button: ZAMKNIJ */}
          <button
            onClick={() => triggerGate('CLOSE')}
            disabled={loading || gate.state === 'CLOSING' || gate.state === 'CLOSED'}
            className="group relative w-full py-5.5 bg-stone-50 dark:bg-zinc-900 border border-rose-100 dark:border-zinc-855 hover:border-rose-250 dark:hover:border-rose-500/30 hover:bg-rose-50/50 dark:hover:bg-rose-950/10 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 overflow-hidden shadow-sm hover:shadow dark:shadow-inner cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]"
            id="fob-close-button"
          >
            <ArrowDownCircle className={`w-10 h-10 transition-colors text-stone-300 dark:text-zinc-650 group-hover:text-rose-600 dark:group-hover:text-rose-400 ${gate.state === 'CLOSED' ? 'text-rose-600 dark:text-rose-500' : ''}`} />
            <div className="text-center">
              <span className="block text-sm font-extrabold uppercase tracking-widest text-stone-800 dark:text-zinc-300 group-hover:text-rose-900 dark:group-hover:text-rose-100">Zamknij Bramę</span>
              <span className="text-[10px] font-bold text-stone-405 dark:text-zinc-505 group-hover:text-rose-700/80 dark:group-hover:text-rose-500/80">Zabezpieczenie ogrodów</span>
            </div>
          </button>
        </div>

        {/* Action Error Box */}
        {actionError && (
          <div className="p-3.5 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs text-rose-400 flex items-center gap-2 animate-fade-in" id="fob-error-box">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping flex-shrink-0"></span>
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* Push notifications box */}
      <div className="mb-6">
        <NotificationSettings userName={user.name} />
      </div>

      {/* Required Contact + Author credits */}
      <ContactAuthor />
    </div>
  );
}
