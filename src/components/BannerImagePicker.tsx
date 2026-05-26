import React, { useState, useCallback } from 'react';
import { Modal } from './Modal';
import { Camera, Sparkles, Image, Search, Loader2, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface BannerImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  currentBannerUrl?: string;
}

const STOCK_BANNERS = [
  // Local illustrations (5)
  { name: 'Mathematics & Geom', url: '/illustrations/math_geometry.png' },
  { name: 'Physics & Chemistry', url: '/illustrations/physics_chemistry.png' },
  { name: 'Earth & Biology', url: '/illustrations/earth_sciences.png' },
  { name: 'Humanities & Langs', url: '/illustrations/humanities_languages.png' },
  { name: 'General Education', url: '/illustrations/default_edu.png' },

  // Studying & workspaces (6)
  { name: 'Desk Studying', url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=60' },
  { name: 'Creative Focus', url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&auto=format&fit=crop&q=60' },
  { name: 'Library & Reading', url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=60' },
  { name: 'Checklist & Notes', url: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=60' },
  { name: 'Morning Study', url: 'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=800&auto=format&fit=crop&q=60' },
  { name: 'Writing Notes', url: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&auto=format&fit=crop&q=60' },

  // Books & literature (5)
  { name: 'Aesthetics Books', url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800&auto=format&fit=crop&q=60' },
  { name: 'Book Stack', url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&auto=format&fit=crop&q=60' },
  { name: 'Vintage Library', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&auto=format&fit=crop&q=60' },
  { name: 'Open Book', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=60' },
  { name: 'Knowledge Stack', url: 'https://images.unsplash.com/photo-1474932430478-367dbb6832c1?w=800&auto=format&fit=crop&q=60' },

  // Science & math (5)
  { name: 'Testing & Exam', url: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&auto=format&fit=crop&q=60' },
  { name: 'Microscope Lab', url: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&auto=format&fit=crop&q=60' },
  { name: 'Chemistry Flask', url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop&q=60' },
  { name: 'Math Chalkboard', url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=60' },
  { name: 'Physics Light', url: 'https://images.unsplash.com/photo-1564325724739-bae0bd08762c?w=800&auto=format&fit=crop&q=60' },

  // Nature & biology (5)
  { name: 'Forest Canopy', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop&q=60' },
  { name: 'Macro Leaf', url: 'https://images.unsplash.com/photo-1504198266287-1659872e6590?w=800&auto=format&fit=crop&q=60' },
  { name: 'Mountain View', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=60' },
  { name: 'Ocean Waves', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&auto=format&fit=crop&q=60' },
  { name: 'DNA Helix Art', url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&auto=format&fit=crop&q=60' },

  // Digital & abstract (6)
  { name: 'Digital Learning', url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60' },
  { name: 'Vibrant Gradients', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&auto=format&fit=crop&q=60' },
  { name: 'Fluid Digital', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60' },
  { name: 'Data Network', url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=60' },
  { name: 'Laptop Code', url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&auto=format&fit=crop&q=60' },
  { name: 'Focus Light', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=60' },

  // Middle-East / Morocco inspired (3)
  { name: 'Mosaic Tile', url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=800&auto=format&fit=crop&q=60' },
  { name: 'Desert Sunset', url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&auto=format&fit=crop&q=60' },
  { name: 'Lantern Glow', url: 'https://images.unsplash.com/photo-1563891350624-e25b9b9a6580?w=800&auto=format&fit=crop&q=60' },
];

interface UnsplashImage {
  id: string;
  url: string;
  thumb: string;
  small: string;
  regular: string;
  title: string;
  author: string;
  authorUrl: string;
  sourceUrl: string;
  color: string;
}

interface UnsplashResponse {
  images: UnsplashImage[];
  total: number;
  total_pages: number;
  page: number;
}

const fetchUnsplash = async (query: string, page: number): Promise<UnsplashResponse | null> => {
  try {
    const params = new URLSearchParams({
      query,
      page: String(page),
      per_page: '30',
    });
    const response = await fetch(`/api/unsplash-search?${params}`);
    if (!response.ok) {
      const text = await response.text();
      console.warn('[Unsplash] API error:', text);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('[Unsplash] Fetch failed:', error);
    return null;
  }
};

export const BannerImagePicker: React.FC<BannerImagePickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentBannerUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'curated' | 'unsplash'>('curated');
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');

  // Unsplash search state
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [unsplashResults, setUnsplashResults] = useState<UnsplashImage[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashPage, setUnsplashPage] = useState(1);
  const [unsplashTotalPages, setUnsplashTotalPages] = useState(0);
  const [unsplashSearched, setUnsplashSearched] = useState(false);

  const handleUnsplashSearch = useCallback(async (page: number = 1) => {
    const query = unsplashQuery.trim();
    if (!query) return;
    setUnsplashLoading(true);
    setUnsplashSearched(true);
    const result = await fetchUnsplash(query, page);
    if (result) {
      if (page === 1) {
        setUnsplashResults(result.images);
      } else {
        setUnsplashResults(prev => [...prev, ...result.images]);
      }
      setUnsplashPage(result.page);
      setUnsplashTotalPages(result.total_pages);
    }
    setUnsplashLoading(false);
  }, [unsplashQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUnsplashSearch(1);
  };

  const handleLoadMore = () => {
    if (unsplashPage < unsplashTotalPages && !unsplashLoading) {
      handleUnsplashSearch(unsplashPage + 1);
    }
  };

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
      maxWidth="3xl"
    >
      <div className="space-y-5 select-none font-sans py-2">
        <p className="text-xs text-slate-500 dark:text-ink-muted leading-relaxed">
          Personalize this study space by choosing a hand-picked illustration, searching Unsplash, or pasting a custom web URL.
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

        {/* Tab Switcher */}
        <div className="flex gap-1 border-b border-slate-100 dark:border-white/5 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('curated')}
            className={`px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'curated'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                : 'text-slate-400 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink-secondary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={12} />
              Curated Library
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unsplash')}
            className={`px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'unsplash'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                : 'text-slate-400 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink-secondary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Search size={12} />
              Unsplash Search
            </span>
          </button>
        </div>

        {/* Curated Tab */}
        {activeTab === 'curated' && (
          <div>
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
                        <Camera size={10} className="stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Unsplash Search Tab */}
        {activeTab === 'unsplash' && (
          <div className="space-y-4">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={unsplashQuery}
                onChange={(e) => setUnsplashQuery(e.target.value)}
                placeholder="Search millions of free images..."
                className="w-full pl-12 pr-4 py-3 bg-paper border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
              <button
                type="submit"
                disabled={unsplashLoading || !unsplashQuery.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-lg text-[10px] font-bold uppercase tracking-normal hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                {unsplashLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
              </button>
            </form>

            <div className="min-h-[200px]">
              {!unsplashSearched && !unsplashLoading && (
                <div className="flex flex-col items-center justify-center h-48 text-center space-y-3 opacity-50">
                  <Image size={32} className="text-muted" />
                  <p className="text-xs font-bold text-ink">Search Unsplash for any topic</p>
                  <p className="text-[10px] text-muted">Try "math", "physics", "library", "morocco"...</p>
                </div>
              )}

              {unsplashLoading && unsplashResults.length === 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 bg-slate-100 dark:bg-surface-low animate-pulse rounded-2xl" />
                  ))}
                </div>
              )}

              {unsplashSearched && !unsplashLoading && unsplashResults.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-center space-y-3">
                  <Search size={28} className="text-muted opacity-40" />
                  <p className="text-xs font-bold text-ink">No results found</p>
                  <p className="text-[10px] text-muted">Try a different search term</p>
                </div>
              )}

              {unsplashResults.length > 0 && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-72 pr-1 no-scrollbar">
                    {unsplashResults.map((img) => {
                      const isSelected = currentBannerUrl === img.url || currentBannerUrl === img.regular;
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => {
                            onSelect(img.url);
                            onClose();
                          }}
                          className={`group relative h-20 rounded-2xl overflow-hidden border transition-all text-left shadow-sm active:scale-[0.97] hover:scale-[1.01] ${
                            isSelected 
                              ? 'border-accent ring-2 ring-accent/30' 
                              : 'border-slate-100 dark:border-white/5'
                          }`}
                          style={{ backgroundColor: img.color || '#f1f5f9' }}
                        >
                          <img 
                            src={img.thumb}
                            alt={img.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/45 group-hover:bg-black/25 transition-all flex items-end p-2">
                            <span className="text-[8px] font-bold text-white truncate w-full select-none leading-tight">
                              {img.title}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shadow-md">
                              <Camera size={10} className="stroke-[3]" />
                            </div>
                          )}
                          {/* Photo by attribution on hover */}
                          <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[7px] text-white/80 font-medium">
                              © {img.author}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Pagination / Load More */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5 mt-3">
                    <span className="text-[10px] text-slate-400 dark:text-ink-muted font-medium">
                      Page {unsplashPage} of {unsplashTotalPages}
                    </span>
                    {unsplashPage < unsplashTotalPages && (
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={unsplashLoading}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-paper text-xs font-bold text-slate-700 dark:text-ink-secondary hover:bg-slate-50 dark:hover:bg-surface-low transition-all shadow-sm disabled:opacity-50"
                      >
                        {unsplashLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ChevronRight size={12} />
                        )}
                        <span>Load More</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-surface-low dark:to-surface-mid border border-slate-200 dark:border-white/5 rounded-xl flex items-center gap-3">
              <Camera size={16} className="text-slate-400 shrink-0" />
              <p className="text-[10px] text-slate-500 dark:text-ink-muted leading-relaxed">
                Powered by <strong>Unsplash</strong>. All images are free to use under the Unsplash License.
              </p>
              <a
                href="https://unsplash.com"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink-secondary flex items-center gap-1"
              >
                unsplash.com <ExternalLink size={10} />
              </a>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};