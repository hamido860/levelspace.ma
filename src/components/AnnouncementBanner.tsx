import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, ArrowRight } from 'lucide-react';

interface AnnouncementBannerProps {
  bannerKey?: string;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ bannerKey = 'levelup_pro_cta' }) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem(`banner_dismissed_${bannerKey}`);
    if (isDismissed !== 'true') {
      setIsVisible(true);
    }
  }, [bannerKey]);

  const handleDismiss = () => {
    localStorage.setItem(`banner_dismissed_${bannerKey}`, 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="overflow-hidden w-full shrink-0"
        >
          <div className="relative p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-accent/10 dark:from-emerald-500/5 dark:via-teal-500/5 dark:to-accent/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-[2rem] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Ambient blur sphere */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
            
            {/* Banner content */}
            <div className="flex items-start gap-4 min-w-0 z-10">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-emerald-400/20 to-teal-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1 leading-normal">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Featured
                  </span>
                  <h4 className="text-xs md:text-sm font-bold text-slate-900 dark:text-ink">
                    LevelUp Pro: Accelerate Your Academic Mastery! 🚀
                  </h4>
                </div>
                <p className="text-[11px] text-muted max-w-3xl leading-relaxed">
                  Unlock unlimited custom generated lessons, smart National Exam prep roadmaps, and collaborate with our elite multi-agent AI pedagogical crew. Supercharge your learning index today!
                </p>
              </div>
            </div>

            {/* CTA action button */}
            <div className="flex items-center gap-3 shrink-0 z-10 w-full md:w-auto justify-end">
              <button
                onClick={() => navigate('/pricing')}
                className="px-4.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              >
                Upgrade to Pro <ArrowRight size={13} />
              </button>

              <button
                onClick={handleDismiss}
                aria-label="Dismiss banner"
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-ink hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              >
                <X size={14} />
              </button>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
