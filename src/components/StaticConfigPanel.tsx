// StaticConfigPanel.tsx - Component to configure local setup values on serverless/GitHub Pages deploys
import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, Check, HelpCircle, ArrowRight } from 'lucide-react';
import { 
  getSavedGoogleScriptUrl, 
  getSavedSuplaServerUrl, 
  getSavedSuplaToken, 
  getSavedGateChannelId, 
  getSavedSensorChannelId, 
  getSavedInvertSensor 
} from '../lib/githubShim';

export default function StaticConfigPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');
  const [suplaUrl, setSuplaUrl] = useState('');
  const [suplaToken, setSuplaToken] = useState('');
  const [gateId, setGateId] = useState('');
  const [sensorId, setSensorId] = useState('');
  const [invert, setInvert] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Read initial saved values
    setGoogleUrl(getSavedGoogleScriptUrl());
    setSuplaUrl(getSavedSuplaServerUrl());
    setSuplaToken(getSavedSuplaToken());
    setGateId(getSavedGateChannelId());
    setSensorId(getSavedSensorChannelId());
    setInvert(getSavedInvertSensor());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('GOOGLE_SCRIPT_URL', googleUrl.trim());
    localStorage.setItem('SUPLA_SERVER_URL', suplaUrl.trim());
    localStorage.setItem('SUPLA_ACCESS_TOKEN', suplaToken.trim());
    localStorage.setItem('GATE_CHANNEL_ID', gateId.trim());
    localStorage.setItem('SENSOR_CHANNEL_ID', sensorId.trim());
    localStorage.setItem('INVERT_SENSOR', invert ? 'true' : 'false');
    
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      // Reload page to re-dispatch fetch interceptors
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 mt-2">
      <div className="bg-white/90 dark:bg-zinc-900/90 border border-stone-200/60 dark:border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Header toggle widget */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 flex items-center justify-between text-stone-750 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 font-bold text-xs uppercase tracking-wide transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-600 animate-spin-slow" />
            <span>Konfiguracja Lokalna (GitHub / Bezserwerowa)</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-extrabold uppercase">
            {isOpen ? 'Zwiń' : 'Rozwiń'}
          </span>
        </button>

        {isOpen && (
          <form onSubmit={handleSave} className="p-4 border-t border-stone-100 dark:border-zinc-850 space-y-3.5 animate-fade-in text-xs">
            <div className="p-3 bg-blue-50/50 dark:bg-zinc-950/40 border border-blue-100/50 dark:border-zinc-850 rounded-xl space-y-1">
              <span className="font-extrabold text-[10.5px] text-blue-800 dark:text-blue-400 uppercase tracking-wide block">Wskazówka wdrażania na GitHub Pages:</span>
              <p className="text-[11px] leading-relaxed text-stone-600 dark:text-zinc-400">
                Wersja statyczna komunikuje się bezpośrednio z Twoim Web Appem Google i serwerem SUPLA z poziomu przeglądarki. Podaj poniższe dane, aby połączyć aplikację.
              </p>
            </div>

            {/* Google Sheets Script URL */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-500 uppercase">URL Skryptu Google (Web App):</label>
              <input
                type="url"
                required
                value={googleUrl}
                onChange={(e) => setGoogleUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-stone-850 dark:text-white font-mono focus:outline-none focus:border-emerald-500 transition-all font-semibold"
              />
            </div>

            {/* SUPLA Server URL */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-500 uppercase">URL Serwera SUPLA:</label>
              <input
                type="url"
                required
                value={suplaUrl}
                onChange={(e) => setSuplaUrl(e.target.value)}
                placeholder="https://svr150.supla.org"
                className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-stone-850 dark:text-white font-mono focus:outline-none focus:border-emerald-500 transition-all font-semibold"
              />
            </div>

            {/* Personal access token */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-500 uppercase">Token Osobisty SUPLA:</label>
              <input
                type="text"
                required
                value={suplaToken}
                onChange={(e) => setSuplaToken(e.target.value)}
                placeholder="Klucz personalny (Personal Access Token)"
                className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-stone-850 dark:text-white font-mono focus:outline-none focus:border-emerald-500 transition-all font-semibold"
              />
            </div>

            {/* Channel and sensor configuration numbers in grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-stone-500 uppercase">ID Kanału Bramy:</label>
                <input
                  type="text"
                  required
                  value={gateId}
                  onChange={(e) => setGateId(e.target.value)}
                  placeholder="np. 2012"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-stone-850 dark:text-white font-mono focus:outline-none focus:border-emerald-500 transition-all font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-stone-500 uppercase">ID Czujnika Stanu:</label>
                <input
                  type="text"
                  required
                  value={sensorId}
                  onChange={(e) => setSensorId(e.target.value)}
                  placeholder="np. 2014"
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-stone-850 dark:text-white font-mono focus:outline-none focus:border-emerald-500 transition-all font-semibold"
                />
              </div>
            </div>

            {/* Invert check */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="static-invert"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
              <label htmlFor="static-invert" className="text-[11px] font-bold text-stone-605 cursor-pointer dark:text-zinc-400">
                Odwróć wskazania stanu bramy ze styków (Invert Sensor)
              </label>
            </div>

            {/* Save trigger button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-555 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer mt-1"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 animate-bounce" />
                  <span>Zapisano konfigurację lokalną!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Zapisz i Odśwież Pilota</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
