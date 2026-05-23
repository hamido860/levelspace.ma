import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface UserProfileProps {
  currentGrade: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ currentGrade }) => {
  const navigate = useNavigate();
  const { user, profile, isPro, dbConnected, refreshDbConnection } = useAuth();
  const { t } = useLanguage();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/profile')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/profile');
        }
      }}
      aria-label="View Profile"
      className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 p-1 -ml-1"
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
          <span className="text-[9px] font-bold text-muted/60 uppercase tracking-normal whitespace-nowrap">
            {currentGrade}
          </span>
          <div className="w-0.5 h-0.5 rounded-full bg-muted/20" />
          <span className="text-[9px] font-bold text-accent uppercase tracking-normal whitespace-nowrap">
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
            aria-label="Refresh Connection"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${dbConnected === null ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
};
