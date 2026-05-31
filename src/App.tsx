import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import Login from './components/Login';
import GateControl from './components/GateControl';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: 'dzialkowiec' | 'gosc' | 'admin'; suplaAccessToken?: string } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Tryb jasny / ciemny (Light/Dark mode)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ogrody_gate_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ogrody_gate_theme', theme);
  }, [theme]);

  useEffect(() => {
    // Check if user session has been saved previously
    const savedUser = localStorage.getItem('ogrody_gate_session');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to restore gate session', e);
        localStorage.removeItem('ogrody_gate_session');
      }
    }
    setSessionLoading(false);
  }, []);

  const handleLogin = (user: { id: string; name: string; role: 'dzialkowiec' | 'gosc' | 'admin'; suplaAccessToken?: string }) => {
    setCurrentUser(user);
    localStorage.setItem('ogrody_gate_session', JSON.stringify(user));
    // Reset admin panel toggle on new login
    setShowAdminPanel(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowAdminPanel(false);
    localStorage.removeItem('ogrody_gate_session');
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-emerald-50/20 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-stone-500 dark:text-zinc-400 font-sans transition-colors">
        <span className="w-8 h-8 border-4 border-emerald-100 dark:border-emerald-950 border-t-emerald-550 rounded-full animate-spin mb-3"></span>
        <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-800 dark:text-emerald-400">Inicjalizacja pilota...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/35 via-stone-50 to-emerald-50/20 dark:bg-zinc-950 dark:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-emerald-950/15 dark:via-zinc-950 dark:to-black text-stone-900 dark:text-zinc-100 transition-colors select-none relative overflow-x-hidden">
      
      {/* Przycisk zmiany kompozycji (Light/Dark Mode toggle) */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2.5 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-emerald-100/80 dark:border-zinc-800 text-stone-605 hover:text-emerald-805 dark:text-zinc-400 dark:hover:text-white shadow-[0_4px_16px_rgba(16,185,129,0.08)] dark:shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95 flex items-center justify-center hover:border-emerald-250 dark:hover:border-zinc-700"
          title={theme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
          id="theme-toggle-button"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-500" />
          ) : (
            <Moon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          )}
        </button>
      </div>

      <div className="py-6 min-h-screen">
        {currentUser === null ? (
          <Login onLoginSuccess={handleLogin} />
        ) : currentUser.role === 'admin' && showAdminPanel ? (
          <AdminPanel user={currentUser} onLogout={handleLogout} onBackToRemote={() => setShowAdminPanel(false)} />
        ) : (
          <GateControl 
            user={currentUser} 
            onLogout={handleLogout} 
            onOpenAdminPanel={currentUser.role === 'admin' ? () => setShowAdminPanel(true) : undefined} 
          />
        )}
      </div>
    </div>
  );
}
