import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Search, Loader2, Maximize2, Download, ExternalLink, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

interface ImageFetcherProps {
  state: any;
  onChange: (state: any) => void;
  lessonContext: any;
}

export const ImageFetcher: React.FC<ImageFetcherProps> = ({ state, onChange, lessonContext }) => {
  const [query, setQuery] = useState(state.query || lessonContext.title.split(' ')[0] || 'science');
  const [images, setImages] = useState<any[]>(state.images || []);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|info&inprop=url&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=10&pithumbsize=800&origin=*`;
      const response = await axios.get(url, {
        headers: {
            'User-Agent': 'EduApp/1.0 (https://github.com/hamideduapp; hamid@example.com)'
        }
      });

      const pages = response.data?.query?.pages;
      if (!pages) {
        setImages([]);
        onChange({ ...state, query: searchQuery, images: [] });
        return;
      }

      const newImages = Object.values(pages)
        .filter((page: any) => page.thumbnail && page.thumbnail.source)
        .map((page: any) => ({
          id: page.pageid.toString(),
          url: page.thumbnail.source,
          title: page.title,
          sourceUrl: page.fullurl,
          author: 'Wikimedia'
        }));

      setImages(newImages);
      onChange({ ...state, query: searchQuery, images: newImages });
    } catch (err) {
      console.error("Image Fetch Error:", err);
      setError("Failed to fetch images. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (images.length === 0 && query) {
      fetchImages(query);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchImages(query);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-accent">
          <ImageIcon className="w-4 h-4" />
          <h3 className="text-sm font-bold uppercase tracking-widest">Educational Diagrams</h3>
        </div>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for diagrams, maps, or concepts..."
          className="w-full pl-12 pr-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-accent text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-ink transition-all disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
        </button>
      </form>

      <div className="flex-grow overflow-y-auto pr-2 no-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-video bg-surface-medium animate-pulse rounded-xl" />
            ))}
          </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-error/60">
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : images.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
            <ImageIcon className="w-12 h-12 text-muted" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-ink">No images found</p>
              <p className="text-[10px] text-muted uppercase tracking-widest">Try another search term</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence>
              {images.map((img, i) => (
                <motion.div
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative aspect-video bg-paper border border-ink/5 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedImage(img)}
                >
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <div className="w-8 h-8 bg-paper rounded-full flex items-center justify-center text-ink shadow-lg">
                      <Maximize2 size={16} />
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-ink/80 to-transparent">
                    <p className="text-[9px] font-bold text-paper truncate uppercase tracking-widest">{img.title}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="p-4 bg-accent/5 border border-accent/10 rounded-xl flex items-start gap-3">
        <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-ink">Image Library</p>
          <p className="text-[10px] text-muted leading-relaxed">
            All images are sourced from educational repositories. Click an image to expand and study the details.
          </p>
        </div>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-8 bg-ink/90 backdrop-blur-md"
            onClick={() => setSelectedImage(null)}
          >
            <button className="absolute top-8 right-8 text-paper hover:text-accent transition-colors">
              <X size={32} />
            </button>
            <div className="flex flex-col items-center max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
                <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={selectedImage.url}
                className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl border border-white/10 object-contain"
                referrerPolicy="no-referrer"
                />
                <div className="mt-4 flex flex-col items-center text-white">
                    <h4 className="text-lg font-bold">{selectedImage.title}</h4>
                    <a href={selectedImage.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-accent hover:underline mt-2 text-sm gap-1">
                        View on Wikipedia <ExternalLink size={14}/>
                    </a>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
