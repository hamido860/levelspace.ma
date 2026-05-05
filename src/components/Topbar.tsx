import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Globe,
  Settings,
  Bell,
  Sun,
  Moon,
  RefreshCw
} from 'lucide-react';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const LANGUAGE_META = {
  en: { short: 'EN', label: 'English' },
  fr: { short: 'FR', label: 'French' },
  ar: { short: 'AR', label: 'Arabic' },
  es: { short: 'ES', label: 'Spanish' },
  de: { short: 'DE', label: 'German' },
} as const;

export const Topbar: React.FC<{ isCollapsed?: boolean; gradeOverride?: string }> = ({ isCollapsed = false, gradeOverride }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useSearch();
  const { language, setLanguage, t } = useLanguage();
  const { user, profile, isPro, dbConnected, refreshDbConnection } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const currentGrade = gradeOverride || localStorage.getItem('selected_grade') || 'Grade 12';
  const langs = ['en', 'fr', 'ar', 'es', 'de'] as const;
  const currentLanguageMeta = LANGUAGE_META[language] || LANGUAGE_META.en;
  const nextLang = langs[(langs.indexOf(language) + 1) % langs.length];
  const nextLanguageMeta = LANGUAGE_META[nextLang] || LANGUAGE_META.en;
  const languageTooltip = `Current language: ${currentLanguageMeta.label}. Click to switch to ${nextLanguageMeta.label}.`;

  return (
    <header
      className={`h-16 border-b border-ink/5 bg-surface-low/80 backdrop-blur-md fixed top-0 z-30 px-4 md:px-6 flex items-center justify-between gap-4 transition-all duration-300 ${
        isCollapsed
          ? 'left-0 w-full md:left-[64.9984px] md:w-[calc(100%-64.9984px)]'
          : 'left-0 w-full md:left-[176px] md:w-[calc(100%-176px)]'
      }`}
    >
      <div
        onClick={() => navigate('/profile')}
        className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 border border-accent/20 overflow-hidden shadow-sm">
          {profile?.avatar_url ? (
            <img
              alt="User"
              className="w-full h-full object-cover"
              src={profile.avatar_url}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-sm font-bold text-accent">
              {user?.email?.[0].toUpperCase() || 'U'}
            </span>
          )}
        </div>
        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-black text-ink truncate tracking-tight uppercase">
              {profile?.full_name || user?.email?.split('@')[0] || t('my_space')}
            </h2>
            <span className={`text-[7px] font-black uppercase tracking-tighter px-1 py-0.5 rounded ${
              isPro ? 'bg-accent text-white' : 'bg-ink/5 text-muted'
            }`}>
              {isPro ? 'PRO' : 'FREE'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] font-bold text-muted/60 uppercase tracking-widest whitespace-nowrap">
              {currentGrade}
            </span>
            <div className="w-0.5 h-0.5 rounded-full bg-muted/20" />
            <span className="text-[9px] font-bold text-accent uppercase tracking-widest whitespace-nowrap">
              {t('active_session')}
            </span>
          </div>
        </div>

        {dbConnected !== null && (
          <div className="hidden sm:flex items-center gap-1 ml-2">
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${dbConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-error/10 border-error/20 text-error'} text-[7px] font-black uppercase tracking-tighter`}
              title={dbConnected ? 'Cloud Connected' : 'Local Only'}
            >
              <div className={`w-1 h-1 rounded-full ${dbConnected ? 'bg-emerald-500' : 'bg-error'} animate-pulse`} />
              {dbConnected ? 'Cloud' : 'Local'}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                refreshDbConnection();
              }}
              className="p-1 hover:bg-ink/5 rounded-full text-muted/40 hover:text-accent transition-all"
              title="Refresh Connection"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${dbConnected === null ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-grow max-w-md hidden lg:block">
        <div className="relative group">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50 group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ backgroundColor: 'var(--accent-soft)' }}
            className="w-full h-7 ps-9 pe-3 bg-paper/50 border border-ink/5 rounded-full text-sm focus:ring-1 focus:ring-accent/20 outline-none transition-all hover:bg-paper"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex items-center gap-1 bg-surface-low p-1 rounded-full border border-ink/5">
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            className="text-muted hover:text-accent hover:bg-surface-mid transition-all p-2 rounded-full"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            onClick={() => {
              setLanguage(nextLang as any);
            }}
            title={languageTooltip}
            aria-label={languageTooltip}
            className="text-muted hover:text-accent hover:bg-surface-mid transition-all px-2.5 py-2 rounded-full flex items-center gap-1.5"
          >
            <Globe size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {currentLanguageMeta.short}
            </span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            title={t('settings')}
            className={`text-muted hover:text-accent hover:bg-surface-mid transition-all p-2 rounded-full ${location.pathname === '/settings' ? 'text-accent bg-accent/5' : ''}`}
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="h-8 w-px bg-ink/5 mx-1 hidden md:block" />

        <div className="flex items-center">
          <button className="text-muted hover:text-accent p-2 rounded-full hover:bg-ink/5 transition-all relative">
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-surface-low"></span>
          </button>
        </div>
      </div>
    </header>
  );
};
