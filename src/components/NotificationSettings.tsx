import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, Smartphone, X } from 'lucide-react';

interface NotificationSettingsProps {
  userName: string;
}

export default function NotificationSettings({ userName }: NotificationSettingsProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState('');
  const [activeToast, setActiveToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    // Detect OS/Browser
    const ua = navigator.userAgent;
    let browser = 'Przeglądarka internetowa';
    if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
    
    let os = 'Urządzenie';
    if (ua.indexOf('Windows') > -1) os = 'Windows PC';
    else if (ua.indexOf('Mac') > -1) os = 'macOS';
    else if (ua.indexOf('Android') > -1) os = 'Smartfon Android';
    else if (ua.indexOf('iPhone') > -1) os = 'iPhone';

    setDeviceInfo(`${os} (${browser})`);

    // Check localStorage
    const savedSub = localStorage.getItem(`gate_push_sub_${userName}`);
    if (savedSub === 'true') {
      setIsSubscribed(true);
    }
  }, [userName]);

  // Dismiss toast after 6 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // 1. Request actual browser permission (graceful fail if blocked inside iframe)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const perm = await Notification.requestPermission();
          console.log('Notification permission status:', perm);
        } catch (e) {
          console.warn('Could not request notification permission in iframe context.', e);
        }
      }

      // 2. Add to server subscriptions DB
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, deviceInfo })
      });

      if (res.ok) {
        setIsSubscribed(true);
        localStorage.setItem(`gate_push_sub_${userName}`, 'true');
        
        // Show in-app animated toast so it works even when browser denies iframe permissions
        setActiveToast({
          title: 'System Powiadomień (Automatyczny)',
          message: 'Włączono powiadomienia na tym urządzeniu! Otrzymasz informacje o zmianach dostępu.'
        });

        // Show immediate native local notification if permitted
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Pilot Ogrody Stara Huta', {
            body: 'Włączono powiadomienia na tym urządzeniu! Otrzymasz informacje o zmianach dostępu.',
          });
        }
      }
    } catch (err) {
      console.error('Failed to subscribe to push notification server', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName })
      });
      if (res.ok) {
        const data = await res.json();
        
        // Pop up the simulated layout notification
        setActiveToast({
          title: data.title || 'Pilot Ogrody Stara Huta',
          message: data.message || 'System powiadomień działa poprawnie!'
        });

        // Native native alert
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(data.title, {
            body: data.message
          });
        }
      }
    } catch (err) {
      console.error('Failed to dispatch test notification', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = () => {
    setIsSubscribed(false);
    localStorage.removeItem(`gate_push_sub_${userName}`);
  };

  return (
    <div className="bg-white/95 dark:bg-zinc-950/70 rounded-3xl p-5 border border-emerald-100/90 dark:border-zinc-900 shadow-[0_12px_40px_rgba(16,185,129,0.04)] dark:shadow-lg space-y-4 transition-all duration-300" id="notification-settings-panel">
      
      {/* Simulation Animated In-App Toast Popup */}
      {activeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-950/98 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl p-4 shadow-[0_12px_32px_rgba(16,185,129,0.15)] dark:shadow-[0_4px_24px_rgba(16,185,129,0.3)] flex items-start gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/65 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-stone-900 dark:text-zinc-100">{activeToast.title}</span>
                <span className="text-[9px] text-stone-400 dark:text-zinc-500 uppercase tracking-widest font-mono">Teraz</span>
              </div>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">{activeToast.message}</p>
            </div>
            <button 
              onClick={() => setActiveToast(null)} 
              className="text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-zinc-300 transition-colors p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-2xl transition-colors ${isSubscribed ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' : 'bg-stone-50 dark:bg-zinc-900 text-stone-400 dark:text-zinc-550 border border-emerald-100/50 dark:border-zinc-805'}`}>
          <Bell className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="font-extrabold text-sm text-stone-850 dark:text-zinc-200">System Powiadomień Push</h3>
          <p className="text-xs text-stone-500 dark:text-zinc-500 leading-relaxed font-medium">
            Otrzymuj alerty o nagłych zmianach uprawnień, blokadach bramy na czas imprez działkowych oraz statusie konserwacji.
          </p>
        </div>
      </div>

      <div className="bg-stone-50/80 dark:bg-zinc-900/60 rounded-2xl p-3.5 border border-emerald-50 dark:border-zinc-850 text-xs flex items-center justify-between gap-3 text-stone-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-stone-405 dark:text-zinc-500" />
          <span className="font-medium">Wykryte urządzenie:</span>
        </div>
        <span className="font-mono text-emerald-805 dark:text-zinc-350 bg-emerald-50/50 dark:bg-zinc-950/50 px-2 py-0.5 rounded-lg border border-emerald-100/50 dark:border-zinc-900 text-[11px] font-bold">
          {deviceInfo || 'Standardowy komputer/telefon'}
        </span>
      </div>

      {isSubscribed ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-xs text-emerald-800 dark:text-emerald-400 animate-fade-in font-bold">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>Powiadomienia push są pomyślnie aktywne na tym urządzeniu.</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleSendTestNotification}
              disabled={loading}
              className="py-2.5 px-3 bg-stone-50 hover:bg-emerald-50 dark:bg-zinc-900 dark:hover:bg-emerald-950/20 text-stone-705 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 border border-emerald-100/95 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-900/40 text-[11px] font-extrabold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              id="send-test-push-button"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Test Powiadomienia
            </button>

            <button
              onClick={handleUnsubscribe}
              className="py-2.5 px-3 bg-stone-50 hover:bg-stone-100 dark:bg-zinc-900 dark:hover:bg-zinc-850/60 text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-300 border border-stone-200 dark:border-zinc-800 text-[11px] font-extrabold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              id="unsubscribe-button"
            >
              <BellOff className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-550" />
              Wyłącz
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-650 hover:scale-[1.01] active:scale-[0.99] hover:from-emerald-555 hover:to-teal-555 text-white text-xs font-extrabold uppercase tracking-wide rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_14px_rgba(16,185,129,0.18)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          id="subscribe-button"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
          ) : (
            <>
              <Bell className="w-4 h-4 animate-pulse text-emerald-250 dark:text-emerald-300" />
              <span className="text-black">Włącz powiadomienia push na tym urządzeniu</span>
            </>
          )}
        </button>
      )}

    </div>
  );
}
