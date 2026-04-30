import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, 
  Globe, 
  Settings,
  Bell,
  Sun,
  Moon,
  Database,
  RefreshCw
} from 'lucide-react';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const Topbar: React.FC<{ isCollapsed?: boolean }> = ({ isCollapsed = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchQuery, setSearchQuery } = useSearch();
  const { language, setLanguage, t } = useLanguage();
  const { user, profile, isPro, dbConnected, refreshDbConnection } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const currentGrade = localStorage.getItem('selected_grade') || 'Grade 12';

  return (
    <header 
      className={`h-16 border-b border-ink/5 bg-surface-low/80 backdrop-blur-md fixed top-0 z-30 px-4 md:px-6 flex items-center justify-between gap-4 transition-all duration-300 ${
        isCollapsed 
          ? 'left-0 w-full md:left-[64.9984px] md:w-[calc(100%-64.9984px)]' 
          : 'left-0 w-full md:left-[176px] md:w-[calc(100%-176px)]'
      }`}
    >
      {/* Session Title / Profile Section */}
      <div 
        role="button"
        tabIndex={0}
        aria-label="View Profile"
        onClick={() => navigate('/profile')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate('/profile');
          }
        }}
        className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded-lg p-1 -ml-1"
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
              className="p-1 hover:bg-ink/5 rounded-full text-muted/40 hover:text-accent transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              title="Refresh Connection"
              aria-label="Refresh Database Connection"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${dbConnected === null ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Search Section */}
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
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="text-muted hover:text-accent hover:bg-surface-mid transition-all p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button 
            onClick={() => {
              const langs = ['en', 'fr', 'ar', 'es', 'de'];
              const nextLang = langs[(langs.indexOf(language) + 1) % langs.length];
              setLanguage(nextLang as any);
            }}
            title={t('language')}
            aria-label="Change Language"
            className="text-muted hover:text-accent hover:bg-surface-mid transition-all p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          >
            <Globe size={18} />
          </button>
          <button 
            onClick={() => navigate('/settings')}
            title={t('settings')}
            aria-label="Settings"
            className={`text-muted hover:text-accent hover:bg-surface-mid transition-all p-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${location.pathname === '/settings' ? 'text-accent bg-accent/5' : ''}`}
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="h-8 w-px bg-ink/5 mx-1 hidden md:block" />

        <div className="flex items-center">
          <button
            className="text-muted hover:text-accent p-2 rounded-full hover:bg-ink/5 transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-surface-low"></span>
          </button>
        </div>
      </div>
    </header>
  );
};
