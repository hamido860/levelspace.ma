import React, { useState, useEffect } from 'react';
import { Book, Search, Loader2, Volume2, Bookmark, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

interface DictionaryToolProps {
  state: any;
  onChange: (state: any) => void;
}

export const DictionaryTool: React.FC<DictionaryToolProps> = ({ state, onChange }) => {
  const [word, setWord] = useState(state.word || '');
  const [definition, setDefinition] = useState<any>(state.definition || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDefinition = async (searchWord: string) => {
    if (!searchWord.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${searchWord.toLowerCase()}`);
      const data = response.data[0];
      setDefinition(data);
      onChange({ ...state, word: searchWord, definition: data });
    } catch (err) {
      console.error("Dictionary Error:", err);
      setError("Word not found. Please try another word.");
      setDefinition(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDefinition(word);
  };

  const playAudio = (audioUrl: string) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-accent">
          <Book className="w-4 h-4" />
          <h3 className="text-sm font-bold uppercase tracking-widest">Academic Dictionary</h3>
        </div>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a word to define..."
          className="w-full pl-12 pr-4 py-3 bg-paper border border-ink/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
        <button
          type="submit"
          disabled={isLoading || !word.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-accent text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-ink transition-all disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Define'}
        </button>
      </form>

      <div className="flex-grow overflow-y-auto pr-2 no-scrollbar relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest">Searching dictionary...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-error/60">
            <Bookmark className="w-12 h-12 opacity-20" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : definition ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold text-ink capitalize">{definition.word}</h2>
                <p className="text-sm font-mono text-accent">{definition.phonetic}</p>
              </div>
              {definition.phonetics?.find((p: any) => p.audio) && (
                <button
                  onClick={() => playAudio(definition.phonetics.find((p: any) => p.audio).audio)}
                  className="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center hover:bg-accent hover:text-white transition-all shadow-lg shadow-accent/20"
                  aria-label="Play pronunciation audio"
                >
                  <Volume2 size={20} />
                </button>
              )}
            </div>

            <div className="space-y-6">
              {definition.meanings.map((meaning: any, i: number) => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-surface-mid text-muted text-[10px] font-bold uppercase tracking-widest rounded">
                      {meaning.partOfSpeech}
                    </span>
                    <div className="h-px flex-grow bg-ink/5" />
                  </div>
                  <ul className="space-y-4">
                    {meaning.definitions.slice(0, 3).map((def: any, j: number) => (
                      <li key={j} className="space-y-2">
                        <p className="text-sm text-ink leading-relaxed">
                          <span className="text-accent font-bold mr-2">{j + 1}.</span>
                          {def.definition}
                        </p>
                        {def.example && (
                          <p className="text-xs text-muted italic pl-6 border-l-2 border-accent/20">
                            "{def.example}"
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
            <Book className="w-12 h-12 text-muted" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-ink">Ready to define</p>
              <p className="text-[10px] text-muted uppercase tracking-widest">Enter a word above to begin</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-accent/5 border border-accent/10 rounded-xl flex items-start gap-3">
        <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
          <Book className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-ink">Academic Vocabulary</p>
          <p className="text-[10px] text-muted leading-relaxed">
            Expand your vocabulary by defining complex terms. Use the audio icon to hear the correct pronunciation.
          </p>
        </div>
      </div>
    </div>
  );
};
