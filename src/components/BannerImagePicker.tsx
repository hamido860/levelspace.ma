import React, { useState } from 'react';
import { Modal } from './Modal';
import { Camera, Sparkles, Image, Check } from 'lucide-react';

interface BannerImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  currentBannerUrl?: string;
}

const STOCK_BANNERS = [
  { name: 'Mathematics & Geom', url: '/illustrations/math_geometry.png' },
  { name: 'Physics & Chemistry', url: '/illustrations/physics_chemistry.png' },
  { name: 'Earth & Biology', url: '/illustrations/earth_sciences.png' },
  { name: 'Humanities & Langs', url: '/illustrations/humanities_languages.png' },
  { name: 'General Education', url: '/illustrations/default_edu.png' },
  { name: 'Desk Studying', url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=60' },
  { name: 'Digital Learning', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60' },
  { name: 'Creative Focus', url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&auto=format&fit=crop&q=60' },
  { name: 'Library & Reading', url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=60' },
  { name: 'Checklist & Notes', url: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=60' },
  { name: 'Aesthetics Books', url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800&auto=format&fit=crop&q=60' },
  { name: 'Testing & Exam', url: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=60' },
  { name: 'Vibrant Gradients', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&auto=format&fit=crop&q=60' },
  { name: 'Fluid Digital', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60' },
];

export const BannerImagePicker: React.FC<BannerImagePickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentBannerUrl,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    
    if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://') && !customUrl.startsWith('/')) {
      setError('Please enter a valid web image URL (starting with http://, https://, or a local path)');
      return;
    }

    setError('');
    onSelect(customUrl.trim());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-accent shrink-0 animate-pulse" />
          <span>Customize Banner Image</span>
        </div>
      }
      maxWidth="2xl"
    >
      <div className="space-y-6 select-none font-sans py-2">
        <p className="text-xs text-slate-500 dark:text-ink-muted leading-relaxed">
          Personalize this study space by choosing a hand-picked educational illustration, a modern workspace photo, or pasting a custom web URL.
        </p>

        {/* Custom URL form */}
        <form onSubmit={handleCustomSubmit} className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-ink-muted block">
            Custom Image URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://images.unsplash.com/photo-... or custom direct URL"
              value={customUrl}
              onChange={(e) => {
                setCustomUrl(e.target.value);
                if (error) setError('');
              }}
              className="flex-grow rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-low px-4 py-2.5 text-xs outline-none focus:border-accent/40 text-slate-800 dark:text-ink transition-all"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-850 dark:bg-white dark:hover:bg-slate-50 text-white dark:text-slate-950 font-bold px-5 rounded-xl text-xs flex items-center justify-center shrink-0 shadow-sm transition-all"
            >
              Apply
            </button>
          </div>
          {error && (
            <p className="text-[10px] font-semibold text-rose-500 animate-pulse">{error}</p>
          )}
        </form>

        <div className="border-t border-slate-100 dark:border-white/5 pt-4">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-ink-muted block mb-3">
            Curated Stock Library
          </label>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-72 pr-1 no-scrollbar">
            {STOCK_BANNERS.map((banner, index) => {
              const isSelected = currentBannerUrl === banner.url;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    onSelect(banner.url);
                    onClose();
                  }}
                  className={`group relative h-20 rounded-2xl overflow-hidden border transition-all text-left shadow-sm active:scale-[0.97] hover:scale-[1.01] ${
                    isSelected 
                      ? 'border-accent ring-2 ring-accent/30' 
                      : 'border-slate-100 dark:border-white/5'
                  }`}
                >
                  <img 
                    src={banner.url} 
                    alt={banner.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/45 group-hover:bg-black/25 transition-all flex items-end p-2.5">
                    <span className="text-[9px] font-black text-white uppercase tracking-wider truncate w-full select-none">
                      {banner.name}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shadow-md">
                      <Check size={10} className="stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
