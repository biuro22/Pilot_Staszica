import React, { useState, useEffect } from 'react';
import { X, Save, Ban, Check, User, Home, Shield, Key } from 'lucide-react';
import { WebUser } from '../types';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit: WebUser | null; // null means adding a new user
  onSave: (payload: any) => Promise<boolean>;
  isSubmitting: boolean;
}

export default function UserEditModal({ isOpen, onClose, userToEdit, onSave, isSubmitting }: UserEditModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [plotNumber, setPlotNumber] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'dzialkowiec' | 'gosc' | 'admin'>('dzialkowiec');
  const [suplaName, setSuplaName] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'active' | 'blocked'>('active');
  const [blockReason, setBlockReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setFirstName(userToEdit.firstName || userToEdit.name?.split(' ')[0] || '');
        setLastName(userToEdit.lastName || userToEdit.name?.split(' ').slice(1).join(' ') || '');
        setPlotNumber(userToEdit.plotNumber || '');
        setPin(userToEdit.pin || '');
        setRole(userToEdit.role || 'dzialkowiec');
        setSuplaName(userToEdit.suplaName || '');
        setToken(userToEdit.token || '');
        setStatus(userToEdit.status || 'active');
        setBlockReason(userToEdit.blockReason || '');
      } else {
        setFirstName('');
        setLastName('');
        setPlotNumber('');
        setPin('');
        setRole('dzialkowiec');
        setSuplaName('');
        setToken('');
        setStatus('active');
        setBlockReason('');
      }
      setLocalError(null);
      
      // Lock page body and html scrolling to prevent dual scroll bars on mobile device
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, userToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!firstName.trim()) {
      setLocalError('Imię jest wymagane.');
      return;
    }
    if (!plotNumber.trim()) {
      setLocalError('Numer działki jest wymagany.');
      return;
    }
    if (pin && !/^\d{4}$/.test(pin.trim())) {
      setLocalError('Kod PIN musi składać się z dokładnie 4 cyfr.');
      return;
    }

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      plotNumber: plotNumber.trim(),
      oldPlotNumber: userToEdit ? userToEdit.plotNumber : undefined,
      pin: pin.trim(),
      role,
      suplaName: suplaName.trim(),
      token: token.trim(),
      status,
      blockReason: status === 'blocked' ? blockReason.trim() : '',
    };

    const success = await onSave(payload);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-zinc-950/80 backdrop-blur-sm animate-fade-in" id="user-edit-modal-wrapper">
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden transition-all max-h-[90vh] flex flex-col"
        id="user-edit-modal-card"
      >
        {/* Decorative Top Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-150 dark:border-zinc-850 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{userToEdit ? 'Edycja Działkowca' : 'Dodaj Nowego Działkowca'}</span>
            </h2>
            <p className="text-xs text-stone-400 dark:text-zinc-500 font-semibold uppercase mt-0.5 tracking-wider">
              {userToEdit ? `Edycja danych dla działki ${userToEdit.plotNumber}` : 'Tworzenie nowego konta w Arkuszu'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-stone-50 hover:bg-stone-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 border border-stone-200 dark:border-zinc-700 rounded-xl text-stone-500 dark:text-zinc-405 transition-all"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {localError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/40 rounded-xl text-xs text-rose-750 dark:text-rose-450 font-bold">
              {localError}
            </div>
          )}

          {/* Imię i Nazwisko */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10.5px] uppercase font-bold tracking-widest text-[#064e3b] dark:text-zinc-500">Imię *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70 dark:text-zinc-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="np. Marek"
                  className="w-full py-2.5 pl-10 pr-3.5 bg-stone-50/50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800 rounded-xl text-xs text-stone-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10.5px] uppercase font-bold tracking-widest text-[#064e3b] dark:text-zinc-500">Nazwisko</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="np. Kowalski"
                className="w-full py-2.5 px-3.5 bg-stone-50/50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800 rounded-xl text-xs text-stone-900 dark:text-white"
              />
            </div>
          </div>

          {/* Działka i PIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10.5px] uppercase font-bold tracking-widest text-[#064e3b] dark:text-zinc-500">Numer działki *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70 dark:text-zinc-500">
                  <Home className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={plotNumber}
                  onChange={(e) => setPlotNumber(e.target.value)}
                  placeholder="ID działki, np. 77"
                  className="w-full py-2.5 pl-10 pr-3.5 bg-stone-50/50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-stone-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10.5px] uppercase font-bold tracking-widest text-[#064e3b] dark:text-zinc-500">Kod PIN (4 cyfry)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70 dark:text-zinc-500">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="np. 4390"
                  className="w-full py-2.5 pl-10 pr-3.5 bg-stone-50/50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800 rounded-xl text-xs font-mono tracking-widest text-stone-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* rola */}
          <div className="space-y-1.5">
            <label className="block text-[10.5px] uppercase font-bold tracking-widest text-[#064e3b] dark:text-zinc-500">Rola w systemie</label>
            <select
              value={role}
              onChange={(e: any) => setRole(e.target.value)}
              className="w-full py-2.5 px-3 bg-stone-50/50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800 rounded-xl text-xs text-stone-900 dark:text-white font-bold"
            >
              <option value="dzialkowiec">Działkowiec (Pełne uprawnienia)</option>
              <option value="gosc">Gość (Tymczasowy / Ograniczony)</option>
              <option value="admin">Administrator (Panel zarządcy)</option>
            </select>
          </div>

          {/* SUPLA token and SUPLA name */}
          <div className="p-4 bg-stone-50 dark:bg-zinc-950/40 border border-stone-150 dark:border-zinc-850 rounded-2xl space-y-4">
            <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-stone-500 dark:text-zinc-400">
              Ustawienia Własnej Integracji SUPLA (Opcjonalnie)
            </h3>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] text-stone-500 dark:text-zinc-400 font-bold">Osobisty Access Token SUPLA (Indywidualny)</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Wklej jeśli dany działkowiec korzysta z własnych zasobów SUPLA"
                  className="w-full py-2 px-3 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-lg text-[11px] font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-stone-500 dark:text-zinc-400 font-bold">Nazwa z SUPLA</label>
                <input
                  type="text"
                  value={suplaName}
                  onChange={(e) => setSuplaName(e.target.value)}
                  placeholder="np. Brama Główna Stara Huta"
                  className="w-full py-2 px-3 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-lg text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Status i blokowanie */}
          <div className="p-4 bg-red-50/30 dark:bg-rose-950/10 border border-red-100 dark:border-rose-950/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-[11.5px] uppercase tracking-wider text-rose-900 dark:text-rose-450">
                  Status Konta & Blokada
                </h4>
                <p className="text-[10px] text-stone-400 dark:text-zinc-500 font-medium">
                  Zablokuj wjazd temu działkowcowi natychmiast z poziomu aplikacji.
                </p>
              </div>

              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold border ${
                  status === 'blocked' 
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500' 
                    : 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 border-stone-200 dark:border-zinc-800'
                }`}
              >
                <option value="active">🟢 Aktywne / Odblokowane</option>
                <option value="blocked">🔴 ZABLOKOWANE (Brak Wjazdu)</option>
              </select>
            </div>

            {status === 'blocked' && (
              <div className="space-y-1.5 animate-fade-in pt-1.5 border-t border-rose-100 dark:border-rose-950/20">
                <label className="block text-[10px] uppercase font-extrabold text-rose-900 dark:text-rose-450">
                  Uzasadnienie / Przyczyna blokady *
                </label>
                <textarea
                  required={status === 'blocked'}
                  rows={2}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Wpisz powód blokady. Użytkownik zobaczy ten tekst przy próbie logowania."
                  className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-900 dark:text-white font-medium focus:ring-1 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </form>

        {/* Footer actions */}
        <div className="p-6 border-t border-stone-150 dark:border-zinc-850 bg-stone-50/50 dark:bg-zinc-950/20 flex gap-3 justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="py-2.5 px-4 bg-stone-150 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-stone-700 dark:text-zinc-305 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Anuluj
          </button>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-555 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Zapisz w Arkuszu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
