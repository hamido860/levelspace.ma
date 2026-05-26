import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Globe,
  Settings,
  Bell,
  Sun,
  Moon,
  WifiOff,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

const LANGUAGE_META = {
  en: { short: 'EN', label: 'English' },
  fr: { short: 'FR', label: 'French' },
  ar: { short: 'AR', label: 'Arabic' },
  es: { short: 'ES', label: 'Spanish' },
  de: { short: 'DE', label: 'German' },
} as const;

export const ActionIcons: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const langs = ['en', 'fr', 'ar', 'es', 'de'] as const;
  const currentLanguageMeta = LANGUAGE_META[language] || LANGUAGE_META.en;
  const nextLang = langs[(langs.indexOf(language) + 1) % langs.length];
  const nextLanguageMeta = LANGUAGE_META[nextLang] || LANGUAGE_META.en;
  const languageTooltip = `Current language: ${currentLanguageMeta.label}. Click to switch to ${nextLanguageMeta.label}.`;

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {isOffline && (
        <span 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-error/15 text-error border border-error/15 animate-pulse" 
          title="Working in local offline mode."
        >
          <WifiOff size={11} />
          <span>Offline Mode</span>
        </span>
      )}
      <div className="flex items-center gap-1 bg-surface-low p-1 rounded-full border border-ink/5">

        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          className="text-muted hover:text-accent hover:bg-surface-mid transition-all p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button
          onClick={() => {
            setLanguage(nextLang as any);
          }}
          title={languageTooltip}
          aria-label={languageTooltip}
          className="text-muted hover:text-accent hover:bg-surface-mid transition-all px-2.5 py-2 rounded-full flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          <Globe size={18} />
          <span className="text-[10px] font-black uppercase tracking-normal">
            {currentLanguageMeta.short}
          </span>
        </button>
        <button
          onClick={() => navigate('/settings')}
          title={t('settings')}
          aria-label={t('settings')}
          className={`text-muted hover:text-accent hover:bg-surface-mid transition-all p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${location.pathname === '/settings' ? 'text-accent bg-accent/5' : ''}`}
        >
          <Settings size={18} />
        </button>
      </div>

      <div className="h-8 w-px bg-ink/5 mx-1 hidden md:block" />

      <div className="flex items-center">
        <button
          aria-label="Notifications"
          className="text-muted hover:text-accent p-2 rounded-full hover:bg-ink/5 transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-surface-low"></span>
        </button>
      </div>
    </div>
  );
};
