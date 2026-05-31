import React, { useState } from 'react';
import { Modal } from './Modal';
import { Camera, Shuffle, Check, Sparkles } from 'lucide-react';
import { EDUCATION_BANNERS, randomBanner } from '../utils/cardColors';

interface BannerImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  onBulkRandomize?: () => void;   // optional: "randomize all" for parent page
  currentBannerUrl?: string;
}

/** Friendly labels paired to each banner for display */
const BANNER_LABELS = [
  'Desk Studying', 'Creative Focus', 'Library & Reading', 'Checklist & Notes',
  'Aesthetics Books', 'Testing & Exam', 'Digital Learning',
  'Science Lab', 'Chemistry Flask', 'Microscope', 'Researcher',
  'Math Equations', 'Geometry', 'Algebra Board',
  'School Classroom', 'Lecture Hall', 'Open Books', 'Night Library',
  'Bookshelves', 'Library Arch', 'Stack of Books', 'Golden Hour Study',
  'Circuit Board', 'Tech Screen', 'Laptop Notes', 'Binary Code',
  'Art & Drawing', 'Paint & Color',
  'World Map', 'Globe & Earth',
  'Handwriting', 'Pen & Journal',
  'Vibrant Gradient', 'Fluid Digital', 'Abstract Waves', 'Neon Blur',
  'Students Team', 'Teamwork', 'Group Study', 'Campus Life',
];

export const BannerImagePicker: React.FC<BannerImagePickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  onBulkRandomize,
  currentBannerUrl,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://') && !customUrl.startsWith('/')) {
      setError('Please enter a valid web image URL (http://, https://, or local /)');
      return;
    }
    setError('');
    onSelect(customUrl.trim());
    onClose();
  };

  const handlePickRandom = () => {
    onSelect(randomBanner());
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
      <div className="space-y-5 select-none font-sans py-2">
        <p className="text-xs text-slate-500 dark:text-ink-muted leading-relaxed">
          Pick from 40 curated education photos, paste a custom URL, or let AI pick for you.
        </p>

        {/* Action Buttons Row */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePickRandom}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Sparkles size={13} />
            Random Pick
          </button>
          {onBulkRandomize && (
            <button
              type="button"
              onClick={() => { onBulkRandomize(); onClose(); }}
              className="flex items-center gap-1.5 bg-slate-900 dark:bg-white hover:opacity-90 text-white dark:text-slate-950 text-[11px] font-bold px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Shuffle size={13} />
              Randomize All Banners
            </button>
          )}
        </div>

        {/* Custom URL form */}
        <form onSubmit={handleCustomSubmit} className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-ink-muted block">
            Custom Image URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://images.unsplash.com/photo-... or any direct URL"
              value={customUrl}
              onChange={(e) => { setCustomUrl(e.target.value); if (error) setError(''); }}
              className="flex-grow rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-surface-low px-4 py-2.5 text-xs outline-none focus:border-accent/40 text-slate-800 dark:text-ink transition-all"
            />
            <button
              type="submit"
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold px-5 rounded-xl text-xs flex items-center justify-center shrink-0 shadow-sm transition-all hover:opacity-90"
            >
              Apply
            </button>
          </div>
          {error && <p className="text-[10px] font-semibold text-rose-500 animate-pulse">{error}</p>}
        </form>

        {/* Gallery grid */}
        <div className="border-t border-slate-100 dark:border-white/5 pt-4">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-ink-muted block mb-3">
            Education Photo Library · {EDUCATION_BANNERS.length} Images
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 overflow-y-auto max-h-80 pr-1 no-scrollbar">
            {EDUCATION_BANNERS.map((url, index) => {
              const isSelected = currentBannerUrl === url;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => { onSelect(url); onClose(); }}
                  className={`group relative h-16 rounded-xl overflow-hidden border transition-all text-left shadow-sm active:scale-[0.97] hover:scale-[1.02] ${
                    isSelected
                      ? 'border-accent ring-2 ring-accent/30'
                      : 'border-slate-100 dark:border-white/5'
                  }`}
                >
                  <img
                    src={url}
                    alt={BANNER_LABELS[index] || `Banner ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all flex items-end p-1.5">
                    <span className="text-[7px] font-black text-white uppercase tracking-wider truncate w-full select-none leading-tight">
                      {BANNER_LABELS[index] || `Photo ${index + 1}`}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center shadow-md">
                      <Check size={8} className="stroke-[3]" />
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
