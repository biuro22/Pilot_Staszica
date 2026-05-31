import React from 'react';
import { Mail, ExternalLink } from 'lucide-react';

export default function ContactAuthor() {
  return (
    <footer className="mt-8 pt-6 border-t border-emerald-100/50 dark:border-zinc-900 text-center text-xs text-stone-500 dark:text-zinc-505 transition-colors">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-md mx-auto">
        <div className="flex items-center gap-1.5 font-sans">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-555 animate-pulse shadow-[0_0_6px_#10b981]"></span>
          <span className="text-stone-600 dark:text-zinc-400">Autor systemu: <strong className="text-stone-850 dark:text-zinc-200 font-extrabold">Marek Majcherczyk</strong></span>
        </div>
        
        <a
          href="https://www.ogrodystarahuta.pl/kontakt"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 dark:text-emerald-405 dark:hover:text-emerald-300 transition-all py-1.5 px-3 rounded-xl bg-emerald-50/50 dark:bg-zinc-900 border border-emerald-100 hover:border-emerald-250 dark:border-zinc-800 dark:hover:border-zinc-700 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-98"
          id="contact-link"
        >
          <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-bold text-xs">Kontakt</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>
      </div>
    </footer>
  );
}
