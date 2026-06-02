import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Eye, EyeOff, LogIn, User, Home, ShieldCheck, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import ContactAuthor from './ContactAuthor';

interface LoginProps {
  onLoginSuccess: (user: { id: string; name: string; role: 'dzialkowiec' | 'gosc' | 'admin' }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Login Form States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [plotNumber, setPlotNumber] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Forgot PIN Form States
  const [isForgotPinMode, setIsForgotPinMode] = useState(false);
  const [forgotFirstName, setForgotFirstName] = useState('');
  const [forgotLastName, setForgotLastName] = useState('');
  const [forgotPlot, setForgotPlot] = useState('');
  const [forgotContact, setForgotContact] = useState('');
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);

  // Force Change PIN States
  const [mustChangePinUser, setMustChangePinUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);

  // Handle Standard / Admin Login Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!plotNumber) {
      setError('Podaj numer działki');
      return;
    }
    if (!passcode) {
      setError('Wpisz 4-cyfrowy PIN dostępu');
      return;
    }

    setLoading(true);
    setError(null);
    setBlockReason(null);

    try {
      const payload = { firstName, lastName, plotNumber, passcode };

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.error('Failed to parse response JSON:', jsonErr);
      }

      if (response.ok) {
        if (data && data.success) {
          if (data.mustChangePin) {
            setMustChangePinUser(data.user);
          } else {
            onLoginSuccess(data.user);
          }
        } else {
          setError(data?.error || 'Nieprawidłowe dane logowania.');
          if (data && data.blocked) {
            setBlockReason(data.reason);
          }
        }
      } else {
        if ((response.status === 403 || response.status === 401) && data && data.blocked) {
          setError(data.error || 'Twój dostęp został zablokowany.');
          setBlockReason(data.reason);
        } else {
          setError(data?.error || 'Nieprawidłowe dane logowania.');
        }
      }
    } catch (err) {
      setError('Brak połączenia z pilotem. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Requesting Forgotten PIN Reset
  const handleForgotPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotFirstName) {
      setError('Podaj imię');
      return;
    }
    if (!forgotPlot) {
      setError('Podaj numer działki');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: forgotFirstName,
          lastName: forgotLastName,
          plotNumber: forgotPlot,
          contactDetails: forgotContact
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setForgotSuccessMessage(data.message || 'Zgłoszenie wysłane pomyślnie.');
      } else {
        setError(data.error || 'Wystąpił błąd przy wysyłaniu zgłoszenia.');
      }
    } catch (err) {
      setError('Błąd połączenia. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forcing PIN Change
  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPin || newPin.trim().length !== 4 || !/^\d{4}$/.test(newPin.trim())) {
      setError('Nowy PIN musi składać się z dokładnie 4 cyfr.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('Podane hasła PIN nie są identyczne.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: mustChangePinUser?.id,
          newPin: newPin.trim()
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Błąd przy zmianie kodu PIN.');
      }
    } catch (err) {
      setError('Błąd połączenia. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  // Render change PIN screen
  if (mustChangePinUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] p-4 font-sans" id="login-container">
        <div className="w-full max-w-md bg-white/95 dark:bg-zinc-950/90 backdrop-blur-md rounded-3xl p-8 border border-emerald-100/80 dark:border-zinc-900 shadow-[0_16px_48px_rgba(16,185,129,0.06)] dark:shadow-2xl relative overflow-hidden transition-all" id="login-card">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-lime-500 to-emerald-500"></div>
          
          <div className="text-center mb-6 mt-2">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/40 rounded-full text-emerald-600 dark:text-emerald-400 shadow-sm animate-pulse">
                <KeyRound className="w-12 h-12" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white mb-2">
              Zmiana kodu PIN
            </h1>
            <p className="text-stone-500 dark:text-zinc-400 text-sm">
              To Twoje pierwsze logowanie lub PIN został zresetowany. Dla bezpieczeństwa nadaj własny 4-cyfrowy kod PIN.
            </p>
          </div>

          <form onSubmit={handleChangePinSubmit} className="space-y-5">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-150 dark:border-zinc-850 text-xs text-zinc-600 dark:text-zinc-400">
              Zalogowany jako: <strong className="text-zinc-800 dark:text-zinc-200">{mustChangePinUser.name}</strong>
            </div>

            {/* Nowy PIN */}
            <div className="space-y-1.5">
              <label className="block text-[10.5px] uppercase tracking-widest font-extrabold text-emerald-800 dark:text-zinc-500">
                Nowy 4-cyfrowy PIN
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70 dark:text-zinc-500">
                  <KeyRound className="w-5 h-5" />
                </span>
                <input
                  type={showNewPin ? 'text' : 'password'}
                  required
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full py-3.5 pl-11 pr-11 bg-emerald-50/20 dark:bg-zinc-900/95 border border-emerald-100/60 dark:border-zinc-805 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-450 focus:ring-4 focus:ring-emerald-500/10 text-stone-900 dark:text-white text-base tracking-widest focus:outline-none transition-all font-mono text-center shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 p-1"
                >
                  {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Powtórz PIN */}
            <div className="space-y-1.5">
              <label className="block text-[10.5px] uppercase tracking-widest font-extrabold text-emerald-800 dark:text-zinc-500">
                Powtórz nowy PIN
              </label>
              <input
                type="password"
                required
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full py-3.5 bg-emerald-50/20 dark:bg-zinc-900/95 border border-emerald-100/60 dark:border-zinc-805 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-450 focus:ring-4 focus:ring-emerald-500/10 text-stone-900 dark:text-white text-base tracking-widest focus:outline-none transition-all font-mono text-center shadow-inner"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-semibold text-red-650 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMustChangePinUser(null);
                  setError(null);
                  setNewPin('');
                  setConfirmPin('');
                }}
                className="w-1/3 py-3 px-4 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold rounded-xl transition-all cursor-pointer text-xs"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <span>Zapisz i Zaloguj</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render forgot PIN request screen
  if (isForgotPinMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] p-4 font-sans" id="login-container">
        <div className="w-full max-w-md bg-white/95 dark:bg-zinc-950/90 backdrop-blur-md rounded-3xl p-8 border border-emerald-100/80 dark:border-zinc-900 shadow-[0_16px_48px_rgba(16,185,129,0.06)] dark:shadow-2xl relative overflow-hidden transition-all" id="login-card">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-lime-550 to-emerald-500"></div>

          {forgotSuccessMessage ? (
            <div className="text-center py-6 space-y-5 animate-fade-in">
              <div className="flex justify-center">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-full text-emerald-600 dark:text-emerald-400 shadow-lg">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                  Zgłoszenie wysłane!
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs px-2 leading-relaxed">
                  {forgotSuccessMessage}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsForgotPinMode(false);
                  setForgotSuccessMessage(null);
                  setForgotFirstName('');
                  setForgotLastName('');
                  setForgotPlot('');
                  setForgotContact('');
                  setError(null);
                }}
                className="py-3 px-6 bg-emerald-650 hover:bg-emerald-600 text-white font-bold rounded-xl' transition-all inline-flex items-center gap-2 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Powrót do logowania</span>
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 mt-2">
                <button
                  onClick={() => {
                    setIsForgotPinMode(false);
                    setError(null);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-stone-550 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Powrót
                </button>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white mb-2">
                  Zgłoszenie resetu PINu
                </h1>
                <p className="text-stone-500 dark:text-zinc-400 text-xs leading-relaxed">
                  Zapomniałeś swój kod PIN? Podaj swoje dane autoryzacyjne oraz kontaktowe. Administrator zweryfikuje je i nada tymczasowy PIN, który zmienisz przy następnym wejściu.
                </p>
              </div>

              <form onSubmit={handleForgotPinSubmit} className="space-y-4">
                {/* Imię */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-zinc-500">Imię</label>
                    <input
                      type="text"
                      required
                      value={forgotFirstName}
                      onChange={(e) => setForgotFirstName(e.target.value)}
                      placeholder="np. Jan"
                      className="w-full py-2.5 px-3.5 bg-zinc-50 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white placeholder-zinc-400 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-bold text-zinc-500">Nazwisko</label>
                    <input
                      type="text"
                      value={forgotLastName}
                      onChange={(e) => setForgotLastName(e.target.value)}
                      placeholder="np. Kowalski"
                      className="w-full py-2.5 px-3.5 bg-zinc-50 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white placeholder-zinc-400 text-xs"
                    />
                  </div>
                </div>

                {/* Numer działki */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-zinc-500">Numer działki</label>
                  <input
                    type="text"
                    required
                    value={forgotPlot}
                    onChange={(e) => setForgotPlot(e.target.value)}
                    placeholder="np. 15"
                    className="w-full py-2.5 px-3.5 bg-zinc-50 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white placeholder-zinc-400 text-xs text-center font-mono"
                  />
                </div>

                {/* Kontakt */}
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-zinc-500">Dane kontaktowe (tel / email)</label>
                  <input
                    type="text"
                    value={forgotContact}
                    onChange={(e) => setForgotContact(e.target.value)}
                    placeholder="np. tel. 123-456-789"
                    className="w-full py-2.5 px-3.5 bg-zinc-50 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-900 dark:text-white placeholder-zinc-400 text-xs"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <span>Wyślij prośbę do administratora</span>
                  )}
                </button>
              </form>
            </>
          )}
          <ContactAuthor />
        </div>
      </div>
    );
  }

  // Render primary Standard / Admin login screen
  return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] p-4 font-sans" id="login-container">
      <div className="w-full max-w-md bg-white/95 dark:bg-zinc-950/90 backdrop-blur-md rounded-3xl p-8 border border-emerald-100/80 dark:border-zinc-900 shadow-[0_16px_48px_rgba(16,185,129,0.06)] dark:shadow-2xl relative overflow-hidden transition-all" id="login-card">
        {/* Remote control decorative header */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-450 via-lime-500 to-emerald-555"></div>
        
        <div className="text-center mb-6 mt-2">
          {/* Circular Icon Placeholder */}
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 rounded-full text-emerald-600 dark:text-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.08)]">
              <ShieldCheck className="w-10 h-10" />
            </div>
          </div>

          {/* Connected state LED indicator lights */}
          <div className="flex justify-center gap-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-stone-200 dark:bg-zinc-800 animate-pulse border border-stone-300 dark:border-zinc-700"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-555 shadow-[0_0_8px_#10b981] border border-emerald-405"></span>
            <span className="w-2 h-2 rounded-full bg-stone-200 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700"></span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white mb-1.5" id="login-title">
            Ogrody Stara Huta
          </h1>
          <p className="text-stone-550 dark:text-zinc-400 text-xs">
            Wirtualny pilot do bramy wjazdowej
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
          {/* Imię (Nazwisko zostało usunięte) */}
          <div className="space-y-1.5">
            <label className="block text-[10.5px] uppercase font-extrabold tracking-widest text-emerald-800 dark:text-zinc-500">
              Imię
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70 dark:text-zinc-550">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="np. Jan"
                className="w-full py-3 pl-10 pr-3 bg-emerald-50/20 dark:bg-zinc-900/95 border border-emerald-100/60 dark:border-zinc-805 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-450 focus:ring-4 focus:ring-emerald-500/10 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-zinc-550 text-xs focus:outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Numer Działki (Simplified: ONLY plotNumber and passcode required) */}
          <div className="space-y-1.5">
            <label className="block text-[10.5px] uppercase font-extrabold tracking-widest text-emerald-800 dark:text-zinc-500">
              Numer działki
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70 dark:text-zinc-550">
                <Home className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={plotNumber}
                onChange={(e) => setPlotNumber(e.target.value)}
                placeholder="Wpisz numer działki (np. 15)"
                className="w-full py-3 pl-10 pr-3 bg-emerald-50/20 dark:bg-zinc-900/95 border border-emerald-100/60 dark:border-zinc-805 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-450 focus:ring-4 focus:ring-emerald-500/10 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-zinc-500 text-xs text-center font-mono focus:outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {/* PIN Input (or Admin password) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[10.5px] uppercase font-extrabold tracking-widest text-emerald-800 dark:text-zinc-500">
                Kod PIN
              </label>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600/70 dark:text-zinc-550">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                type={showPasscode ? 'text' : 'password'}
                required
                maxLength={4}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••"
                className="w-full py-3 pl-10 pr-10 bg-emerald-50/20 dark:bg-zinc-900/95 border border-emerald-100/60 dark:border-zinc-805 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-450 focus:ring-4 focus:ring-emerald-500/10 text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-zinc-500 text-sm focus:outline-none transition-all font-mono text-center tracking-widest shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-zinc-305 transition-colors p-1"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPinMode(true);
                  setError(null);
                }}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-305 hover:underline transition-colors cursor-pointer"
              >
                Zapomniałeś PINu?
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl space-y-1.5 animate-fade-in" id="login-error-box">
              <div className="flex items-start gap-2.5 text-red-650 dark:text-red-400">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="text-xs font-semibold">
                  {error}
                </div>
              </div>
              
              {blockReason && (
                <div className="pl-6 text-[11px] text-red-700 dark:text-red-350 leading-relaxed border-t border-red-200 dark:border-red-900/30 pt-1.5 mt-1 font-medium">
                  <span className="font-bold block text-red-650 dark:text-red-400 mb-0.5">Uzasadnienie blokady:</span>
                  &ldquo;{blockReason}&rdquo;
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-600 via-emerald-650 to-teal-600 hover:from-emerald-555 hover:via-emerald-500 hover:to-teal-500 text-white font-extrabold uppercase tracking-wider text-[11px] rounded-2xl transition-all shadow-[0_4px_14px_rgba(16,185,129,0.2)] dark:shadow-md flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            id="login-submit-button"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Połącz z Pilotem</span>
              </>
            )}
          </button>
        </form>

        <ContactAuthor />
      </div>
    </div>
  );
}
