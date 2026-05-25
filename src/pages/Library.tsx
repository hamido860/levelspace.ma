import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  File,
  Book,
  X,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  Clock,
  CheckCircle2,
  BookOpen,
  Globe,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Volume2,
  BookMarked,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  fetchQuranSurahs,
  fetchQuranSurah,
  lookupWord,
  searchWikipedia,
  getWikipediaSummary,
  type QuranSurah,
  type QuranSurahFull,
  type DictEntry,
  type WikiSearchResult,
  type WikiSummary,
} from '../services/referenceService';

type FileFormat = 'pdf' | 'epub' | 'txt' | 'manual' | 'link';

const getLessonIllustration = (title: string | null | undefined, subject?: string | null | undefined) => {
  const t = String(title || '').toLowerCase();
  const s = String(subject || '').toLowerCase();
  
  if (
    t.includes('math') || 
    t.includes('geom') || 
    t.includes('arith') || 
    t.includes('calcul') || 
    t.includes('algebra') || 
    t.includes('suite') || 
    t.includes('série') || 
    t.includes('analyse') || 
    s.includes('math')
  ) {
    return '/illustrations/math_geometry.png';
  }
  if (
    t.includes('physic') || 
    t.includes('physiq') || 
    t.includes('chem') || 
    t.includes('chim') || 
    t.includes('electr') || 
    t.includes('circuit') || 
    t.includes('combust') || 
    s.includes('phys') || 
    s.includes('chim')
  ) {
    return '/illustrations/physics_chemistry.png';
  }
  if (
    t.includes('svt') || 
    t.includes('earth') || 
    t.includes('life') || 
    t.includes('tecton') || 
    t.includes('plaqu') || 
    t.includes('séisme') || 
    t.includes('volcan') || 
    t.includes('roche') || 
    t.includes('géolog') || 
    t.includes('biolog') || 
    s.includes('svt') || 
    s.includes('vie')
  ) {
    return '/illustrations/earth_sciences.png';
  }
  if (
    t.includes('lang') || 
    t.includes('arab') || 
    t.includes('french') || 
    t.includes('franç') || 
    t.includes('read') || 
    t.includes('book') || 
    t.includes('littér') || 
    t.includes('philoso') || 
    t.includes('lexiq') || 
    t.includes('gramm') || 
    t.includes('ortho') || 
    t.includes('conju') || 
    s.includes('lang') || 
    s.includes('fr') || 
    s.includes('ar') || 
    s.includes('phil')
  ) {
    return '/illustrations/humanities_languages.png';
  }
  return '/illustrations/default_edu.png';
};


interface LibraryItem {
  id: string;
  title: string;
  author: string;
  format: FileFormat;
  size: string;
  addedDate: string;
  status: 'to-read' | 'reading' | 'completed';
  progress: number;
  category: string;
  content?: string;
  url?: string;
}

const initialLibrary: LibraryItem[] = [
  {
    id: '1',
    title: 'Advanced Cognitive Psychology',
    author: 'Dr. Sarah Chen',
    format: 'pdf',
    size: '4.2 MB',
    addedDate: '2024-03-15',
    status: 'reading',
    progress: 45,
    category: 'Science',
    content: '# Advanced Cognitive Psychology\n\n## Chapter 1: Introduction to Cognitive Science\n\nCognitive psychology is the scientific study of mental processes such as "attention, language use, memory, perception, problem solving, creativity, and thinking".\n\n### The Information Processing Approach\n\nOne of the central tenets of cognitive psychology is the idea that the mind can be understood as a complex system that processes information. This approach often uses the computer as a metaphor for the human mind, with sensory input being the "input," mental processes being the "software," and behavior being the "output."\n\n### Key Research Methods\n\n1. **Experimental Psychology**: Using controlled experiments to test hypotheses about mental processes.\n2. **Cognitive Neuropsychology**: Studying individuals with brain damage to understand how specific brain regions contribute to cognitive functions.\n3. **Cognitive Neuroscience**: Using brain imaging techniques (like fMRI or EEG) to observe the brain in action during cognitive tasks.\n4. **Computational Modeling**: Creating computer programs that simulate human cognitive processes.'
  },
  {
    id: '2',
    title: 'The Art of Deep Work',
    author: 'Cal Newport',
    format: 'epub',
    size: '1.8 MB',
    addedDate: '2024-03-10',
    status: 'to-read',
    progress: 0,
    category: 'Productivity',
    content: '# Deep Work\n\n## Rules for Focused Success in a Distracted World\n\nDeep work is the ability to focus without distraction on a cognitively demanding task. It\'s a skill that allows you to quickly master complicated information and produce better results in less time.\n\n### The Deep Work Hypothesis\n\nThe ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable in our economy. As a consequence, the few who cultivate this skill, and then make it the core of their working life, will thrive.\n\n### The Rules\n\n1. **Work Deeply**: Schedule blocks of time for deep work and stick to them.\n2. **Embrace Boredom**: Train your brain to tolerate a lack of stimulation.\n3. **Quit Social Media**: Be intentional about the tools you use.\n4. **Drain the Shallows**: Minimize shallow work (emails, meetings, etc.).'
  },
  {
    id: '3',
    title: 'Quantum Mechanics Notes',
    author: 'MIT OpenCourseWare',
    format: 'txt',
    size: '156 KB',
    addedDate: '2024-03-20',
    status: 'completed',
    progress: 100,
    category: 'Physics',
    content: '# Quantum Mechanics Fundamentals\n\n## Wave-Particle Duality\n\nOne of the most profound discoveries of the 20th century is that all particles exhibit both wave-like and particle-like properties. This is most famously demonstrated in the double-slit experiment.\n\n### The Schrödinger Equation\n\nThe fundamental equation of quantum mechanics is the Schrödinger equation, which describes how the quantum state of a physical system changes over time.\n\n### Heisenberg Uncertainty Principle\n\nIt is impossible to simultaneously know both the exact position and exact momentum of a particle. The more precisely one is known, the less precisely the other can be determined.'
  },
  {
    id: '4',
    title: 'Lab Manual: Organic Chemistry',
    author: 'University Press',
    format: 'manual',
    size: '12.5 MB',
    addedDate: '2024-03-18',
    status: 'reading',
    progress: 12,
    category: 'Chemistry',
    content: '# Organic Chemistry Lab Manual\n\n## Experiment 1: Recrystallization\n\nRecrystallization is a technique used to purify solid compounds. It relies on the fact that most solids are more soluble in a hot solvent than in a cold one.\n\n### Procedure\n\n1. Dissolve the impure solid in a minimum amount of hot solvent.\n2. Filter the hot solution to remove insoluble impurities.\n3. Allow the solution to cool slowly to room temperature, then in an ice bath.\n4. Filter the crystals using a Buchner funnel.\n5. Wash the crystals with a small amount of cold solvent.'
  },
  {
    id: '5',
    title: 'History of Modern Architecture',
    author: 'Kenneth Frampton',
    format: 'pdf',
    size: '8.9 MB',
    addedDate: '2024-03-22',
    status: 'to-read',
    progress: 0,
    category: 'Architecture',
    content: '# History of Modern Architecture\n\n## The Rise of Modernism\n\nModern architecture emerged in the late 19th and early 20th centuries as a response to the Industrial Revolution and the need for new types of buildings.\n\n### Key Movements\n\n1. **Bauhaus**: A German art school that combined crafts and the fine arts, and was famous for the approach to design that it publicized and taught.\n2. **International Style**: Characterized by rectilinear forms, light, taut plane surfaces that have been completely stripped of applied ornamentation and decoration, open interior spaces, and a visually weightless quality engendered by the use of cantilever construction.\n3. **Brutalism**: Characterized by simple, block-like structures that often feature bare building materials.'
  },
  {
    id: '6',
    title: 'Introduction to Algorithms',
    author: 'CLRS',
    format: 'pdf',
    size: '15.2 MB',
    addedDate: '2024-03-23',
    status: 'reading',
    progress: 5,
    category: 'Computer Science',
    content: '# Introduction to Algorithms\n\n## Sorting and Order Statistics\n\nSorting is the process of arranging items in a specific order, typically numerical or lexicographical.\n\n### Common Sorting Algorithms\n\n1. **Insertion Sort**: A simple sorting algorithm that builds the final sorted array one item at a time.\n2. **Merge Sort**: An efficient, stable, comparison-based, divide and conquer sorting algorithm.\n3. **Quick Sort**: An efficient sorting algorithm, serving as a systematic method for placing the elements of an array in order.\n4. **Heap Sort**: A comparison-based sorting algorithm that uses a binary heap data structure.'
  },
  {
    id: '7',
    title: 'Philosophy of Mind',
    author: 'David Chalmers',
    format: 'epub',
    size: '1.2 MB',
    addedDate: '2024-03-24',
    status: 'to-read',
    progress: 0,
    category: 'Philosophy',
    content: '# Philosophy of Mind\n\n## The Hard Problem of Consciousness\n\nThe hard problem of consciousness is the problem of explaining why and how we have qualia or phenomenal experiences—how sensations acquire characteristics, such as colors and tastes.\n\n### Dualism vs. Physicalism\n\n1. **Dualism**: The view that the mind and body are distinct and separable.\n2. **Physicalism**: The view that everything is physical, including the mind.'
  }
];

export const Library: React.FC = () => {
  const { t } = useLanguage();
  const { isPro } = useAuth();
  const navigate = useNavigate();

  // ─── My Library state ────────────────────────────────────────────────────
  const [items, setItems] = useState<LibraryItem[]>(initialLibrary);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | FileFormat>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [newItem, setNewItem] = useState({ title: '', url: '' });

  // ─── Tab state ───────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'library' | 'discover'>('library');
  const [discoverSection, setDiscoverSection] = useState<'quran' | 'dict' | 'wiki'>('quran');

  // ─── Quran state ─────────────────────────────────────────────────────────
  const [quranSurahs, setQuranSurahs] = useState<QuranSurah[]>([]);
  const [quranLoading, setQuranLoading] = useState(false);
  const [openSurah, setOpenSurah] = useState<QuranSurahFull | null>(null);
  const [surahLoading, setSurahLoading] = useState(false);
  const [quranSearch, setQuranSearch] = useState('');

  // ─── Dictionary state ─────────────────────────────────────────────────────
  const [dictQuery, setDictQuery] = useState('');
  const [dictLang, setDictLang] = useState<'en' | 'fr'>('en');
  const [dictResults, setDictResults] = useState<DictEntry[]>([]);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictError, setDictError] = useState('');

  // ─── Wikipedia state ─────────────────────────────────────────────────────
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiLang, setWikiLang] = useState<'en' | 'fr'>('en');
  const [wikiResults, setWikiResults] = useState<WikiSearchResult[]>([]);
  const [wikiSummary, setWikiSummary] = useState<WikiSummary | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  // Load surahs lazily when first entering Quran section
  useEffect(() => {
    if (mainTab === 'discover' && discoverSection === 'quran' && quranSurahs.length === 0) {
      setQuranLoading(true);
      fetchQuranSurahs()
        .then(setQuranSurahs)
        .catch(console.error)
        .finally(() => setQuranLoading(false));
    }
  }, [mainTab, discoverSection]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleOpenSurah = async (number: number) => {
    setSurahLoading(true);
    try {
      const data = await fetchQuranSurah(number);
      setOpenSurah(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSurahLoading(false);
    }
  };

  const handleDictSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dictQuery.trim()) return;
    setDictLoading(true);
    setDictError('');
    setDictResults([]);
    try {
      const results = await lookupWord(dictQuery.trim(), dictLang);
      setDictResults(results);
    } catch {
      setDictError(`No definition found for "${dictQuery}"`);
    } finally {
      setDictLoading(false);
    }
  };

  const handleWikiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wikiQuery.trim()) return;
    setWikiLoading(true);
    setWikiSummary(null);
    setWikiResults([]);
    try {
      const results = await searchWikipedia(wikiQuery.trim(), wikiLang);
      setWikiResults(results);
    } catch {
      setWikiResults([]);
    } finally {
      setWikiLoading(false);
    }
  };

  const handleWikiArticle = async (key: string) => {
    setWikiLoading(true);
    try {
      const summary = await getWikipediaSummary(key, wikiLang);
      setWikiSummary(summary);
    } catch {
      // ignore
    } finally {
      setWikiLoading(false);
    }
  };

  const playAudio = (url: string) => {
    new Audio(url).play().catch(() => {});
  };

  const saveToLibrary = (title: string, author: string, category: string, content: string) => {
    const item: LibraryItem = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      author,
      format: 'txt',
      size: 'Reference',
      addedDate: new Date().toISOString().split('T')[0],
      status: 'to-read',
      progress: 0,
      category,
      content,
    };
    setItems(prev => [item, ...prev]);
    setMainTab('library');
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || item.format === filter;
    return matchesSearch && matchesFilter;
  });

  const filteredSurahs = quranSurahs.filter(s =>
    s.englishName.toLowerCase().includes(quranSearch.toLowerCase()) ||
    s.name.includes(quranSearch) ||
    String(s.number).includes(quranSearch)
  );

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    const item: LibraryItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: newItem.title || newItem.url,
      author: 'Web Resource',
      format: 'link',
      size: 'URL',
      addedDate: new Date().toISOString().split('T')[0],
      status: 'to-read',
      progress: 0,
      category: 'Web',
      url: newItem.url
    };
    setItems([item, ...items]);
    setShowAddModal(false);
    setNewItem({ title: '', url: '' });
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const getFormatIcon = (format: FileFormat) => {
    switch (format) {
      case 'pdf': return <FileText className="text-red-500" />;
      case 'epub': return <Book className="text-blue-500" />;
      case 'txt': return <File className="text-gray-500 dark:text-ink-muted" />;
      case 'manual': return <BookOpen className="text-emerald-500" />;
      case 'link': return <ExternalLink className="text-blue-500" />;
    }
  };

  if (!isPro) {
    return (
      <Layout>
        <SEO title="Library" />
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
            <Book className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="ls-section-title">Pro Feature</h2>
            <p className="text-slate-500 dark:text-ink-muted">
              The Library is available exclusively on the Pro plan. Upgrade to store, read, and organize your academic materials.
            </p>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="px-6 py-3 bg-slate-950 text-white rounded-xl font-bold hover:bg-accent transition-colors dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white"
          >
            Upgrade to Pro
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Support Classroom" />
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="ls-page-title">{t('support_classroom') || 'Support Classroom'}</h1>
            <p className="ls-body-text mt-1">Resources and guided paths to strengthen your skills.</p>
          </div>
          {mainTab === 'library' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl font-bold text-sm hover:bg-accent/90 transition-all"
            >
              <Plus size={18} />
              Add Resource
            </button>
          )}
        </div>

        {/* Main tab switcher */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-white/8">
          {[
            { id: 'library', label: 'My Library', icon: <BookOpen size={14} /> },
            { id: 'discover', label: 'Discover', icon: <Globe size={14} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id as 'library' | 'discover')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                mainTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 dark:text-ink-muted hover:text-slate-950 dark:hover:text-ink'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── MY LIBRARY TAB ─── */}
        {mainTab === 'library' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500/50 dark:text-ink-muted/50" />
                  <input
                    type="text"
                    placeholder="Search by title or author..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 ls-card text-sm text-slate-950 placeholder:text-slate-400 focus:border-slate-300 outline-none transition-all dark:text-ink dark:placeholder:text-ink-muted dark:focus:border-white/15"
                  />
                </div>
                <div className="flex gap-2">
                  {(['all', 'pdf', 'epub', 'txt', 'manual'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        filter === f
                          ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                          : 'bg-white text-slate-500 hover:bg-slate-950/5 dark:bg-paper dark:text-ink-muted dark:hover:bg-surface-low'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Library Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white p-5 rounded-3xl border border-slate-200 group transition-all dark:border-white/8 dark:bg-paper"
                      style={{ boxShadow: 'var(--ls-shadow)' }}
                    >
                      {/* Premium Dynamic Illustration */}
                      <div className="h-28 w-full rounded-2xl overflow-hidden mb-4 relative bg-slate-50 border border-slate-100 dark:border-white/5 dark:bg-surface-low shadow-sm">
                        <img 
                          src={getLessonIllustration(item.title, item.category)}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </div>

                      <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white rounded-lg dark:bg-surface-low border border-slate-100 dark:border-white/5 shadow-sm">
                          {getFormatIcon(item.format)}
                        </div>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-2 text-slate-500/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="space-y-1 mb-4">
                        <h3 className="font-bold text-slate-950 line-clamp-1 dark:text-ink">{item.title}</h3>
                        <p className="ls-micro-label font-medium">{item.author}</p>
                      </div>

                      <div className="flex items-center justify-between ls-micro-label/60 mb-4">
                        <span>{item.category}</span>
                        <span>{item.size}</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-500/60 dark:text-ink-muted/60">Progress</span>
                          <span className="text-accent">{item.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-low rounded-full overflow-hidden dark:bg-surface-mid">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            className="h-full bg-accent"
                          />
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center dark:border-white/8">
                        <div className="flex items-center gap-2 ls-micro-label/60">
                          {item.status === 'completed' ? (
                            <CheckCircle2 size={12} className="text-emerald-500" />
                          ) : (
                            <Clock size={12} className="text-amber-500" />
                          )}
                          {item.status}
                        </div>
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="p-2 text-slate-500 hover:text-accent transition-colors dark:text-ink-muted"
                        >
                          <ExternalLink size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Column: Reading List & Stats */}
            <div className="space-y-6">
              <div className="bg-slate-950 text-white p-6 rounded-3xl shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-accent">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold tracking-tight">Reading List</h2>
                    <p className="text-[10px] text-white/60">Active Sessions</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {items.filter(i => i.status === 'reading').map(item => (
                    <div key={item.id} className="p-4 bg-white/5 rounded-2xl space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold line-clamp-1">{item.title}</h4>
                        <span className="text-[10px] font-mono text-accent">{item.progress}%</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const reading = items.find(i => i.status === 'reading');
                    if (reading) setSelectedItem(reading);
                  }}
                  className="w-full py-4 bg-white text-slate-950 rounded-2xl text-xs font-medium hover:bg-accent hover:text-white transition-all dark:bg-surface-mid dark:text-ink dark:hover:bg-accent dark:hover:text-white"
                >
                  Continue Reading
                </button>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 dark:border-white/8 dark:bg-paper" style={{ boxShadow: 'var(--ls-shadow)' }}>
                <h2 className="font-bold text-slate-950 tracking-tight dark:text-ink">Library Stats</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-low rounded-2xl dark:bg-surface-mid">
                    <p className="ls-micro-label mb-1">Total Files</p>
                    <span className="ls-section-title">{items.length}</span>
                  </div>
                  <div className="p-4 bg-surface-low rounded-2xl dark:bg-surface-mid">
                    <p className="ls-micro-label mb-1">Completed</p>
                    <span className="ls-section-title">{items.filter(i => i.status === 'completed').length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── DISCOVER TAB ─── */}
        {mainTab === 'discover' && (
          <div className="space-y-6">
            {/* Section switcher */}
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'quran', label: 'القرآن الكريم', sub: 'Arabic Text' },
                { id: 'dict',  label: 'Dictionary',     sub: 'EN · FR' },
                { id: 'wiki',  label: 'Encyclopedia',   sub: 'Wikipedia' },
              ] as const).map(s => (
                <button
                  key={s.id}
                  onClick={() => setDiscoverSection(s.id)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all flex flex-col items-start leading-tight ${
                    discoverSection === s.id
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 dark:bg-paper dark:text-ink dark:border-white/8 hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                  style={{ boxShadow: discoverSection === s.id ? 'none' : 'var(--ls-shadow)' }}
                >
                  <span>{s.label}</span>
                  <span className={`text-[10px] font-normal mt-0.5 ${discoverSection === s.id ? 'text-white/60 dark:text-slate-950/50' : 'text-slate-400 dark:text-ink-muted'}`}>{s.sub}</span>
                </button>
              ))}
            </div>

            {/* ── Quran Panel ── */}
            {discoverSection === 'quran' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950 dark:text-ink" style={{ fontFamily: 'serif' }}>القرآن الكريم</h2>
                    <p className="text-xs text-slate-500 dark:text-ink-muted mt-0.5">114 surahs · Uthmani script</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-ink-muted" />
                    <input
                      type="text"
                      placeholder="Search surah..."
                      value={quranSearch}
                      onChange={e => setQuranSearch(e.target.value)}
                      className="h-9 pl-9 pr-4 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-300 dark:bg-paper dark:border-white/8 dark:text-ink dark:placeholder:text-ink-muted dark:focus:border-white/15"
                    />
                  </div>
                </div>

                {quranLoading ? (
                  <div className="flex items-center justify-center py-16 text-slate-400 dark:text-ink-muted">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span className="text-sm">Loading surahs…</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filteredSurahs.map(s => (
                      <button
                        key={s.number}
                        onClick={() => handleOpenSurah(s.number)}
                        className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-sm transition-all text-left group dark:bg-paper dark:border-white/8 dark:hover:border-white/15"
                        style={{ boxShadow: 'var(--ls-shadow)' }}
                      >
                        <span className="w-8 h-8 shrink-0 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
                          {s.number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-950 dark:text-ink truncate">{s.englishName}</p>
                          <p className="text-[10px] text-slate-400 dark:text-ink-muted">{s.numberOfAyahs} ayahs · {s.revelationType}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base text-slate-800 dark:text-ink/90" style={{ fontFamily: "'Amiri', serif" }}>{s.name}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 dark:text-white/20 dark:group-hover:text-white/50 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Dictionary Panel ── */}
            {discoverSection === 'dict' && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-950 dark:text-ink">Dictionary</h2>
                  <p className="text-xs text-slate-500 dark:text-ink-muted">Look up definitions, phonetics, and examples</p>
                </div>

                <form onSubmit={handleDictSearch} className="flex gap-2">
                  {/* Language toggle */}
                  <div className="flex bg-surface-low rounded-xl p-0.5 dark:bg-surface-mid shrink-0">
                    {(['en', 'fr'] as const).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => { setDictLang(l); setDictResults([]); setDictError(''); }}
                        className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                          dictLang === l
                            ? 'bg-white text-slate-950 shadow-sm dark:bg-paper dark:text-ink'
                            : 'text-slate-500 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink'
                        }`}
                      >
                        {l === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-ink-muted" />
                    <input
                      type="text"
                      placeholder={dictLang === 'en' ? 'Search a word…' : 'Chercher un mot…'}
                      value={dictQuery}
                      onChange={e => setDictQuery(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-950 outline-none focus:border-slate-300 transition-all dark:bg-paper dark:border-white/8 dark:text-ink dark:placeholder:text-ink-muted dark:focus:border-white/15"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 h-11 bg-slate-950 text-white rounded-xl text-sm font-bold hover:bg-accent transition-all shrink-0 dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white"
                  >
                    {dictLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look up'}
                  </button>
                </form>

                {dictError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400">
                    {dictError}
                  </div>
                )}

                {dictResults.length > 0 && (
                  <div className="space-y-6">
                    {dictResults.slice(0, 2).map((entry, i) => (
                      <div
                        key={i}
                        className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 dark:bg-paper dark:border-white/8"
                        style={{ boxShadow: 'var(--ls-shadow)' }}
                      >
                        {/* Word + phonetics */}
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-2xl font-bold text-slate-950 dark:text-ink">{entry.word}</h3>
                            {entry.phonetic && (
                              <p className="text-sm text-slate-400 dark:text-ink-muted font-mono mt-0.5">{entry.phonetic}</p>
                            )}
                          </div>
                          {/* Audio buttons */}
                          <div className="flex gap-1 flex-wrap justify-end">
                            {entry.phonetics.filter(p => p.audio).slice(0, 2).map((p, pi) => (
                              <button
                                key={pi}
                                onClick={() => playAudio(p.audio!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-low hover:bg-accent/10 text-slate-600 hover:text-accent rounded-xl text-xs font-medium transition-all dark:bg-surface-mid dark:text-ink-muted dark:hover:text-accent"
                              >
                                <Volume2 size={12} />
                                {p.text || 'Play'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Meanings */}
                        <div className="space-y-4">
                          {entry.meanings.slice(0, 3).map((meaning, mi) => (
                            <div key={mi} className="space-y-2">
                              <span className="inline-block px-2.5 py-0.5 bg-accent/10 text-accent rounded-full text-[11px] font-bold uppercase tracking-wide">
                                {meaning.partOfSpeech}
                              </span>
                              <div className="space-y-2.5">
                                {meaning.definitions.slice(0, 2).map((def, di) => (
                                  <div key={di} className="pl-4 border-l-2 border-slate-200 dark:border-white/10 space-y-1">
                                    <p className="text-sm text-slate-800 dark:text-ink">{def.definition}</p>
                                    {def.example && (
                                      <p className="text-xs text-slate-400 dark:text-ink-muted italic">"{def.example}"</p>
                                    )}
                                    {def.synonyms && def.synonyms.length > 0 && (
                                      <p className="text-[11px] text-slate-400 dark:text-ink-muted">
                                        <span className="font-semibold">Synonyms: </span>
                                        {def.synonyms.slice(0, 5).join(', ')}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Save button */}
                        <button
                          onClick={() => saveToLibrary(
                            entry.word,
                            dictLang === 'en' ? 'English Dictionary' : 'Dictionnaire Français',
                            'Reference',
                            `# ${entry.word}\n\n${entry.meanings.map(m =>
                              `## ${m.partOfSpeech}\n${m.definitions.slice(0, 3).map(d => `- ${d.definition}${d.example ? `\n  > "${d.example}"` : ''}`).join('\n')}`
                            ).join('\n\n')}`
                          )}
                          className="flex items-center gap-2 text-xs text-slate-500 hover:text-accent transition-colors dark:text-ink-muted dark:hover:text-accent"
                        >
                          <BookMarked size={13} />
                          Save to My Library
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Encyclopedia Panel ── */}
            {discoverSection === 'wiki' && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-950 dark:text-ink">Encyclopedia</h2>
                  <p className="text-xs text-slate-500 dark:text-ink-muted">Search Wikipedia articles in English or French</p>
                </div>

                <form onSubmit={handleWikiSearch} className="flex gap-2">
                  {/* Language toggle */}
                  <div className="flex bg-surface-low rounded-xl p-0.5 dark:bg-surface-mid shrink-0">
                    {(['en', 'fr'] as const).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => { setWikiLang(l); setWikiResults([]); setWikiSummary(null); }}
                        className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                          wikiLang === l
                            ? 'bg-white text-slate-950 shadow-sm dark:bg-paper dark:text-ink'
                            : 'text-slate-500 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink'
                        }`}
                      >
                        {l === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-ink-muted" />
                    <input
                      type="text"
                      placeholder={wikiLang === 'en' ? 'Search encyclopedia…' : 'Rechercher…'}
                      value={wikiQuery}
                      onChange={e => setWikiQuery(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-950 outline-none focus:border-slate-300 transition-all dark:bg-paper dark:border-white/8 dark:text-ink dark:placeholder:text-ink-muted dark:focus:border-white/15"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 h-11 bg-slate-950 text-white rounded-xl text-sm font-bold hover:bg-accent transition-all shrink-0 dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white"
                  >
                    {wikiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </button>
                </form>

                {/* Inline article summary */}
                <AnimatePresence>
                  {wikiSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="bg-white border border-slate-200 rounded-3xl overflow-hidden dark:bg-paper dark:border-white/8"
                      style={{ boxShadow: 'var(--ls-shadow-hover)' }}
                    >
                      {wikiSummary.thumbnail && (
                        <img
                          src={wikiSummary.thumbnail.source}
                          alt={wikiSummary.title}
                          className="w-full h-40 object-cover"
                        />
                      )}
                      <div className="p-6 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-xl font-bold text-slate-950 dark:text-ink">{wikiSummary.title}</h3>
                          <button
                            onClick={() => setWikiSummary(null)}
                            className="p-1.5 hover:bg-surface-low rounded-full transition-colors dark:hover:bg-surface-mid shrink-0"
                          >
                            <X size={16} className="text-slate-400 dark:text-ink-muted" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-ink-secondary leading-relaxed line-clamp-6">
                          {wikiSummary.extract}
                        </p>
                        <div className="flex items-center gap-3 pt-2">
                          {wikiSummary.content_urls?.desktop?.page && (
                            <a
                              href={wikiSummary.content_urls.desktop.page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline"
                            >
                              <ExternalLink size={12} />
                              Read full article
                            </a>
                          )}
                          <button
                            onClick={() => saveToLibrary(
                              wikiSummary.title,
                              'Wikipedia',
                              'Encyclopedia',
                              `# ${wikiSummary.title}\n\n${wikiSummary.extract}`
                            )}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-accent transition-colors dark:text-ink-muted dark:hover:text-accent"
                          >
                            <BookMarked size={12} />
                            Save to My Library
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Search results */}
                {wikiResults.length > 0 && !wikiSummary && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 dark:text-ink-muted font-medium uppercase tracking-wide">
                      {wikiResults.length} results
                    </p>
                    <div className="space-y-2">
                      {wikiResults.map(result => (
                        <button
                          key={result.id}
                          onClick={() => handleWikiArticle(result.key)}
                          className="w-full flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 text-left group transition-all dark:bg-paper dark:border-white/8 dark:hover:border-white/15"
                          style={{ boxShadow: 'var(--ls-shadow)' }}
                        >
                          <Globe className="w-5 h-5 text-slate-300 group-hover:text-accent transition-colors dark:text-white/20 dark:group-hover:text-accent shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-sm font-semibold text-slate-950 dark:text-ink group-hover:text-accent transition-colors">{result.title}</p>
                            {result.description && (
                              <p className="text-xs text-slate-400 dark:text-ink-muted truncate">{result.description}</p>
                            )}
                            {result.excerpt && (
                              <p
                                className="text-xs text-slate-500 dark:text-ink-muted line-clamp-2"
                                dangerouslySetInnerHTML={{ __html: result.excerpt }}
                              />
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 dark:text-white/20 dark:group-hover:text-white/40 shrink-0 mt-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── MODALS ─── */}
        <AnimatePresence>
          {/* Surah reader */}
          {(openSurah || surahLoading) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setOpenSurah(null); setSurahLoading(false); }}
                className="absolute inset-0 bg-slate-950/60"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl h-[85vh] bg-white rounded-3xl flex flex-col overflow-hidden dark:bg-paper"
                style={{ boxShadow: 'var(--ls-shadow-hover)' }}
              >
                {surahLoading && !openSurah ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : openSurah && (
                  <>
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-white/8 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setOpenSurah(null)}
                          className="p-2 hover:bg-surface-low rounded-full transition-colors dark:hover:bg-surface-mid"
                        >
                          <ChevronLeft size={18} className="text-slate-500 dark:text-ink-muted" />
                        </button>
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="font-bold text-slate-950 dark:text-ink">{openSurah.englishName}</h2>
                            <span className="text-slate-400 dark:text-ink-muted text-sm">·</span>
                            <span className="text-lg text-slate-700 dark:text-ink/80" style={{ fontFamily: "'Amiri', serif" }}>{openSurah.name}</span>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-ink-muted">
                            Surah {openSurah.number} · {openSurah.numberOfAyahs} ayahs · {openSurah.revelationType}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setOpenSurah(null)}
                        className="p-2 hover:bg-surface-low rounded-full transition-colors dark:hover:bg-surface-mid"
                      >
                        <X size={18} className="text-slate-400 dark:text-ink-muted" />
                      </button>
                    </div>

                    {/* Ayahs */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8" dir="rtl">
                      <div className="space-y-6">
                        {openSurah.number !== 9 && (
                          <p
                            className="text-center text-xl text-slate-600 dark:text-ink/70 py-2 border-b border-slate-100 dark:border-white/5 mb-6"
                            style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                          >
                            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                          </p>
                        )}
                        {openSurah.ayahs.map(ayah => (
                          <div key={ayah.number} className="flex items-start gap-4">
                            <p
                              className="flex-1 text-xl leading-[2.2] text-slate-900 dark:text-ink text-right"
                              style={{ fontFamily: "'Amiri', 'Scheherazade New', serif" }}
                            >
                              {ayah.text}
                            </p>
                            <span className="w-8 h-8 shrink-0 rounded-full border border-accent/30 flex items-center justify-center text-accent text-xs font-bold mt-2">
                              {ayah.numberInSurah}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-white/8 flex items-center justify-between">
                      <p className="text-xs text-slate-400 dark:text-ink-muted">Source: alquran.cloud · Uthmani script</p>
                      <button
                        onClick={() => saveToLibrary(
                          `سورة ${openSurah.name} — ${openSurah.englishName}`,
                          'القرآن الكريم',
                          'Quran',
                          `# سورة ${openSurah.name}\n\n${openSurah.ayahs.map(a => `${a.text} ﴿${a.numberInSurah}﴾`).join('\n\n')}`
                        )}
                        className="flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline"
                      >
                        <BookMarked size={13} />
                        Save to Library
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {/* Book reader */}
          {selectedItem && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedItem(null)}
                className="absolute inset-0 bg-slate-950/60"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl h-[85vh] bg-white rounded-2xl flex flex-col overflow-hidden dark:bg-paper"
                style={{ boxShadow: 'var(--ls-shadow-hover)' }}
              >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10 dark:border-white/8 dark:bg-paper">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-surface-low rounded-xl dark:bg-surface-mid">
                      {getFormatIcon(selectedItem.format)}
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-950 leading-tight dark:text-ink">{selectedItem.title}</h2>
                      <p className="ls-micro-label">{selectedItem.author} · {selectedItem.category}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-2 hover:bg-surface-low rounded-full transition-colors dark:hover:bg-surface-mid"
                  >
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                <div className="flex-grow overflow-y-auto p-8 md:p-12 lg:p-16">
                  <div className="max-w-2xl mx-auto">
                    <div className="prose prose-slate prose-sm md:prose-base lg:prose-lg max-w-none">
                      <div className="markdown-body">
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{selectedItem.content || '# No Content Available\n\nThis resource does not have preview content yet.'}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 bg-white/80 flex items-center justify-between rounded-[13px] dark:border-white/8 dark:bg-paper/80">
                  <div className="flex items-center gap-4">
                    <div className="h-1.5 w-32 bg-surface-low rounded-full overflow-hidden dark:bg-surface-mid">
                      <div className="h-full bg-accent" style={{ width: `${selectedItem.progress}%` }} />
                    </div>
                    <span className="ls-micro-label">{selectedItem.progress}% read</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 ls-card text-xs font-medium text-slate-700 hover:bg-slate-950/5 transition-all dark:text-ink-secondary dark:hover:bg-surface-low">
                      Add Bookmark
                    </button>
                    <button className="px-4 py-2 bg-slate-950 text-white rounded-xl text-xs font-medium hover:bg-accent transition-all dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white">
                      Mark as Completed
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Add Resource modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddModal(false)}
                className="absolute inset-0 bg-slate-950/40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-3xl p-8 overflow-hidden dark:bg-paper"
                style={{ boxShadow: 'var(--ls-shadow-hover)' }}
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-accent">
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Add Resource</span>
                    </div>
                    <h2 className="text-2xl font-bold font-sans tracking-tight text-slate-950 dark:text-ink">New Library Item</h2>
                  </div>

                  <form onSubmit={addItem} className="space-y-4">
                    <div className="space-y-1">
                      <label className="ls-micro-label">URL / Link</label>
                      <input
                        type="url"
                        required
                        placeholder="https://example.com/resource"
                        value={newItem.url}
                        onChange={(e) => setNewItem({...newItem, url: e.target.value})}
                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-950 outline-none focus:border-slate-300 dark:border-white/8 dark:bg-surface-low dark:text-ink dark:placeholder:text-ink-muted dark:focus:border-white/15"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="ls-micro-label">Title (Optional)</label>
                      <input
                        type="text"
                        placeholder="My Resource"
                        value={newItem.title}
                        onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-950 outline-none focus:border-slate-300 dark:border-white/8 dark:bg-surface-low dark:text-ink dark:placeholder:text-ink-muted dark:focus:border-white/15"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="flex-1 py-3 bg-white text-slate-500 rounded-xl text-xs font-medium hover:bg-slate-950/5 transition-all dark:bg-surface-low dark:text-ink-muted dark:hover:bg-surface-mid"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-3 bg-accent text-white rounded-xl text-xs font-medium hover:bg-accent/90 transition-all"
                      >
                        Add to Library
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
