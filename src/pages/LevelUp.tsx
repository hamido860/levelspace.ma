import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
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
  Brain,
  Sparkles,
  TrendingUp,
  Award,
  Zap,
  Check,
  AlertTriangle,
  Info,
  RefreshCw,
  Timer,
  Target,
  Lightbulb
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { TabbedHeader, TabItem } from '../components/TabbedHeader';
import { toast } from 'sonner';
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

type FileFormat = 'pdf' | 'epub' | 'txt' | 'cheatsheet' | 'link';

interface ResourceItem {
  id: string;
  title: string;
  author: string;
  format: FileFormat;
  size: string;
  addedDate: string;
  description: string;
  category: string;
  downloadUrl?: string;
  content?: string;
}

interface KnowledgeGap {
  id: string;
  concept: string;
  subject: string;
  failedIn: string;
  severity: 'high' | 'medium' | 'low';
  lastAttemptedAt: string;
  explanationSnippet: string;
  solutionQuestion: string;
  solutionOptions: string[];
  correctOptionIndex: number;
  solved: boolean;
}

const initialKnowledgeGaps: KnowledgeGap[] = [
  {
    id: 'gap-1',
    concept: "Newton's Second Law of Motion",
    subject: "Physics-Chemistry",
    failedIn: "Force & Movement Quiz",
    severity: 'high',
    lastAttemptedAt: "2 hours ago",
    explanationSnippet: "Newton's Second Law states that the acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass: **F = ma**.\n\nTo bridge this gap, follow these fundamental rules:\n1. **Identify the System:** Isolate the block or object of interest.\n2. **Free Body Diagram (FBD):** Draw all active vectors acting on it (Gravity $F_g = mg$, Normal force $F_N$, Applied push, and Friction $F_f$).\n3. **Sum of Forces:** Calculate ∑F along the direction of motion: \n   $$\\sum F = F_{push} - F_{friction} = m \\cdot a$$\n4. **Solve for Acceleration:**\n   $$a = \\frac{F_{push} - F_{friction}}{m}$$",
    solutionQuestion: "A 5 kg block is subjected to a horizontal force of 20 N. If there is a friction force of 5 N opposing the motion, what is the acceleration of the block?",
    solutionOptions: ["4.0 m/s²", "3.0 m/s² (Correct)", "5.0 m/s²", "1.0 m/s²"],
    correctOptionIndex: 1,
    solved: false
  },
  {
    id: 'gap-2',
    concept: "Calculus Limits & Indeterminate Forms (0/0)",
    subject: "Mathématiques",
    failedIn: "Limit Analysis Chapter Test",
    severity: 'high',
    lastAttemptedAt: "Yesterday",
    explanationSnippet: "When a limit yields the indeterminate form **0/0**, it means there is a common factor in the numerator and denominator causing the zero.\n\nCore strategies to resolve 0/0 forms:\n* **Factoring & Canceling:** Factor polynomials and cancel the zero-causing terms. For example:\n  $$\\frac{x^2-9}{x-3} = \\frac{(x-3)(x+3)}{x-3} = x+3$$\n* **Rationalization:** Multiply by the conjugate for square root terms.\n* **L'Hôpital's Rule:** If f(x)/g(x) approaches 0/0, evaluate the limit of their derivatives f'(x)/g'(x).",
    solutionQuestion: "Evaluate the limit: lim (x -> 3) of (x² - 9) / (x - 3).",
    solutionOptions: ["3", "6 (Correct)", "0", "Undefined"],
    correctOptionIndex: 1,
    solved: false
  },
  {
    id: 'gap-3',
    concept: "Tectonic Subduction Zones & Volcanism",
    subject: "Sciences de la Vie et de la Terre (SVT)",
    failedIn: "Tectonics Chapter Quiz",
    severity: 'medium',
    lastAttemptedAt: "3 days ago",
    explanationSnippet: "Subduction is a geological process that takes place at convergent boundaries of tectonic plates where one plate moves under another and is forced to sink due to high gravity into the mantle.\n\nKey features:\n* **Deep Ocean Trenches:** Formed where the subducting plate bends downward.\n* **Explosive Volcanism:** The sinking oceanic slab carries hydrated minerals. As temperature rises, volatile gases release, lowering the melting point of the mantle wedge and triggering explosive andesitic/dacitic volcanic arcs.",
    solutionQuestion: "Which geological feature is typically formed parallel to a subduction trench on the continental plate?",
    solutionOptions: ["Mid-Oceanic Ridge", "Rift Valley", "Volcanic Mountain Arc (Correct)", "Transform Fault"],
    correctOptionIndex: 2,
    solved: false
  }
];

const initialResources: ResourceItem[] = [
  {
    id: 'res-1',
    title: 'Mastering the Baccalaureate Math Syllabus',
    author: 'LevelUp Editorial Board',
    format: 'pdf',
    size: '5.4 MB',
    addedDate: '2026-05-10',
    description: 'A comprehensive workbook containing solved national baccalaureate exam problems, step-by-step calculus proofs, and algebra shortcuts.',
    category: 'Mathematics',
    content: '# Mastering the Baccalaureate Math Syllabus\n\n## Chapter 1: Complex Numbers & Geometry\n\nComplex numbers are of the form $z = a + ib$, where $a$ is the real part and $b$ is the imaginary part.\n\n### Polar Representation\n\nEvery complex number can be written as:\n$$z = r(\\cos \\theta + i \\sin \\theta) = r e^{i\\theta}$$\nwhere $r = |z| = \\sqrt{a^2 + b^2}$ is the modulus, and $\\theta = \\text{arg}(z)$ is the argument.'
  },
  {
    id: 'res-2',
    title: 'Physics & Chemistry Quick Formulas Cheatsheet',
    author: 'Dr. Marc Dubois',
    format: 'cheatsheet',
    size: '1.2 MB',
    addedDate: '2026-05-18',
    description: 'All core equations for electricity, combustion, organic chemistry, and Newtonian mechanics summarized on a single page.',
    category: 'Physics',
    content: '# Physics & Chemistry Quick Formulas\n\n## Mechanics\n\n* **Newton\'s Second Law:** $\\sum \\vec{F} = m\\vec{a}$\n* **Kinetic Energy:** $E_k = \\frac{1}{2}mv^2$\n* **Gravitational Potential Energy:** $E_p = mgh$\n\n## Chemistry\n\n* **Ideal Gas Law:** $PV = nRT$\n* **pH Formula:** $\\text{pH} = -\\log[H_3O^+]$\n* **Concentration:** $C = \\frac{n}{V}$'
  },
  {
    id: 'res-3',
    title: 'Strategic French Writing & Argumentation Guide',
    author: 'Prof. Amélie Roche',
    format: 'epub',
    size: '2.1 MB',
    addedDate: '2026-05-15',
    description: 'Outsourced masterclass guide on structured writing, literary devices, and exam-grade essay construction for national regional exams.',
    category: 'Humanities',
    content: '# Guide de Production Écrite\n\n## Introduction au Plan Dialectique\n\nLe plan dialectique est idéal pour les sujets controversés. Il s\'articule en trois parties principales :\n\n1. **Thèse :** Présentation des arguments en faveur de l\'opinion dominante.\n2. **Antithèse :** Présentation des arguments opposés, réfutant la thèse.\n3. **Synthèse :** Dépassement de la contradiction, réconciliation des points de vue.'
  },
  {
    id: 'res-4',
    title: 'SVT Interactive Immunology & Geology Atlas',
    author: 'LevelUp SVT Team',
    format: 'link',
    size: 'Interactive Portal',
    addedDate: '2026-05-22',
    description: 'High-resolution external 3D models and animated guides covering tectonic plate dynamics and human immunology pathways.',
    category: 'Biology',
    downloadUrl: 'https://illustration-atlas.levelspace.edu'
  }
];

export const LevelUp: React.FC = () => {
  const { t } = useLanguage();
  const { isPro } = useAuth();
  const navigate = useNavigate();

  // ─── Main Tabs ───────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'support' | 'resources' | 'discover'>('support');

  // ─── Support Hub state ───────────────────────────────────────────────────
  const [gaps, setGaps] = useState<KnowledgeGap[]>(initialKnowledgeGaps);
  const [selectedGap, setSelectedGap] = useState<KnowledgeGap | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isQuizChecked, setIsQuizChecked] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);

  // ─── Resource Vault state ────────────────────────────────────────────────
  const [resources, setResources] = useState<ResourceItem[]>(initialResources);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | FileFormat>('all');
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newResource, setNewResource] = useState({ title: '', description: '', url: '' });

  // ─── Reference Suite Tab state ───────────────────────────────────────────
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

  // ─── Vocabulary Vault state ──────────────────────────────────────────────
  const [vocab, setVocab] = useState<string[]>(['metacognition', 'heuristic', 'epistemology']);

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

  // ─── Support Hub Explainer ───────────────────────────────────────────────
  const triggerAiExplainer = (gap: KnowledgeGap) => {
    setSelectedGap(gap);
    setExplainerOpen(true);
    setAiResponding(true);
    setSelectedOptionIndex(null);
    setIsQuizChecked(false);
    setIsAnswerCorrect(null);

    // Simulate real-time pedagogical core compilation
    setTimeout(() => {
      setAiResponding(false);
    }, 1200);
  };

  const handleOptionSelect = (idx: number) => {
    if (isQuizChecked) return;
    setSelectedOptionIndex(idx);
  };

  const checkBridgeSuccess = () => {
    if (selectedOptionIndex === null || !selectedGap) return;
    setIsQuizChecked(true);
    
    const correct = selectedOptionIndex === selectedGap.correctOptionIndex;
    setIsAnswerCorrect(correct);

    if (correct) {
      // Update the gap state as Solved
      setGaps(prev => prev.map(g => g.id === selectedGap.id ? { ...g, solved: true } : g));
      toast.success("Gap Bridged Successfully!", {
        description: "Concept marked as Mastered in your local academic profile."
      });
    } else {
      toast.error("Bridge Attemp Failed", {
        description: "Review the formulas above and try again to close your knowledge gap."
      });
    }
  };

  // ─── Resource Handlers ──────────────────────────────────────────────────
  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    const item: ResourceItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: newResource.title || newResource.url,
      author: 'Academic Upload',
      format: 'link',
      size: 'External',
      addedDate: new Date().toISOString().split('T')[0],
      description: newResource.description || 'Predefined link resource cached for LevelUp support.',
      category: 'Web Source',
      downloadUrl: newResource.url
    };
    setResources([item, ...resources]);
    setShowAddModal(false);
    setNewResource({ title: '', description: '', url: '' });
    toast.success("Outsourced resource registered in LevelUp Hub!");
  };

  const filteredResources = resources.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         res.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         res.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || res.format === filter;
    return matchesSearch && matchesFilter;
  });

  const activeGapsCount = gaps.filter(g => !g.solved).length;
  const completedGapsCount = gaps.filter(g => g.solved).length;
  const masteryPercentage = Math.round((completedGapsCount / gaps.length) * 100);

  if (!isPro) {
    return (
      <Layout>
        <SEO title="LevelUp" />
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="ls-section-title">LevelUp Premium Hub</h2>
            <p className="text-slate-500 dark:text-ink-muted">
              LevelUp is exclusive to Pro members. Upgrade to get diagnostic AI-driven support, bridge academic gaps, and access pre-curated learning resources.
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

  // Pomodoro timer for right sidebar
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s > 0 ? s - 1 : 0), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning]);
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const tabItems: TabItem[] = [
    { id: "support", label: "Support Hub", icon: Brain },
    { id: "resources", label: "Resource Vault", icon: BookOpen },
    { id: "discover", label: "Discover", icon: Globe },
  ];

  return (
    <Layout fullWidth>
      <SEO title="LevelUp - Support Hub" />
      <div className="h-full w-full bg-background flex flex-col overflow-hidden p-4">
        {/* 3-Column Layout */}
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 overflow-hidden">

          {/* Column 2: Main Content */}
          <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 p-6">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6">

        {/* Compact Shared Flat Tab Header */}
        <TabbedHeader
          title={t('library') || 'LevelUp'}
          tabs={tabItems}
          activeTab={mainTab}
          onChangeTab={(id) => setMainTab(id as any)}
        />

        {/* ─── TAB 1: SUPPORT HUB (AI EXPLAINER & GAP CONSOLE) ─── */}
        {mainTab === 'support' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1 & 2: Diagnostic Deck */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Telemetry Stats Card */}
              <div className="bg-slate-950 text-white p-6 rounded-[2rem] border border-slate-800/60 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#a855f708_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
                
                <div className="space-y-1 flex flex-col justify-between">
                  <span className="text-[10px] font-mono text-white/40 uppercase">Diagnostic Status</span>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                    <span className="text-sm font-bold">{activeGapsCount} Active Gaps</span>
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed mt-2">Identified areas where you struggled in recent quizzes.</p>
                </div>

                <div className="space-y-1 flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 sm:pl-6 pt-4 sm:pt-0">
                  <span className="text-[10px] font-mono text-white/40 uppercase">Resolved Concepts</span>
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-sm font-bold">{completedGapsCount} Mastered</span>
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed mt-2">Gaps completely bridged through AI tutorial verification.</p>
                </div>

                <div className="space-y-1 flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 sm:pl-6 pt-4 sm:pt-0">
                  <span className="text-[10px] font-mono text-white/40 uppercase">Gap-Reduction Index</span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl font-serif font-bold text-accent">{masteryPercentage}%</span>
                    <span className="text-[9px] text-white/40">Resolved</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-accent transition-all duration-500" style={{ width: `${masteryPercentage}%` }} />
                  </div>
                </div>
              </div>

              {/* Active Gaps List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pl-1">
                  <h3 className="text-sm font-bold text-slate-950 dark:text-ink">Diagnosed Knowledge Gaps</h3>
                  <span className="text-[10px] font-mono text-muted bg-surface-low border border-ink/5 px-2 py-0.5 rounded-full">
                    Telemetry Live Sync
                  </span>
                </div>

                <div className="space-y-3">
                  {gaps.map((gap) => (
                    <div 
                      key={gap.id}
                      className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-paper ${
                        gap.solved 
                          ? 'border-emerald-500/10 dark:border-emerald-500/20 bg-emerald-500/5' 
                          : gap.severity === 'high' 
                            ? 'border-red-500/10 dark:border-red-500/20 hover:border-red-500/30' 
                            : 'border-amber-500/10 dark:border-amber-500/20 hover:border-amber-500/30'
                      }`}
                      style={{ boxShadow: 'var(--ls-shadow)' }}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                            gap.solved 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : gap.severity === 'high' 
                                ? 'bg-red-500/10 text-red-500' 
                                : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {gap.solved ? 'Mastered' : `${gap.severity} gap`}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-ink-muted">{gap.subject}</span>
                          <span className="text-[10px] text-muted">• Diagnosed: {gap.failedIn}</span>
                        </div>
                        <h4 className="font-bold text-base text-slate-950 dark:text-ink">{gap.concept}</h4>
                        <p className="text-[10px] text-slate-500/80 dark:text-ink-muted flex items-center gap-1">
                          <Clock size={11} className="text-muted" /> Last failed attempt: {gap.lastAttemptedAt}
                        </p>
                      </div>

                      <button
                        onClick={() => triggerAiExplainer(gap)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 border cursor-pointer transition-all ${
                          gap.solved 
                            ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' 
                            : 'bg-slate-950 text-white border-slate-950 hover:bg-accent hover:border-accent dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white'
                        }`}
                      >
                        {gap.solved ? <Check size={13} /> : <Sparkles size={13} />}
                        {gap.solved ? 'Review Concept' : 'Close Gap / Get AI Explanation'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Column 3: Telemetry Analysis Panel */}
            <div className="space-y-6">
              
              <div className="p-6 bg-paper border border-ink/5 rounded-[2rem] space-y-4 shadow-sm flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-accent/5 rounded-xl flex items-center justify-center text-accent shrink-0">
                    <TrendingUp className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink leading-tight">Diagnostic Metrics</h3>
                    <p className="text-[10px] text-muted leading-tight">Overview of recent failures</p>
                  </div>
                </div>

                <div className="space-y-3.5 text-[11px] leading-relaxed pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Total Diagnostic Tests</span>
                    <span className="font-bold text-ink">14</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Struggling Chapters</span>
                    <span className="font-mono font-bold text-red-500">3 areas flagged</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">SVT Subduction geology</span>
                    <span className="font-bold text-ink">Score: 40%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Newtonian Mechanics</span>
                    <span className="font-bold text-ink">Score: 33%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Calculus Limit Theorems</span>
                    <span className="font-bold text-ink">Score: 50%</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ─── TAB 2: RESOURCE VAULT (FREE EBOOKS & OUTSOURCES) ─── */}
        {mainTab === 'resources' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              
              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500/50 dark:text-ink-muted/50" />
                  <input
                    type="text"
                    placeholder="Search cheatsheets, ebooks, or manuals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 ls-card text-sm text-slate-950 placeholder:text-slate-400 focus:border-slate-300 outline-none transition-all dark:text-ink dark:placeholder:text-ink-muted dark:focus:border-white/15"
                  />
                </div>
                <div className="flex gap-2">
                  {(['all', 'pdf', 'epub', 'cheatsheet', 'link'] as const).map(f => (
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

              {/* Resource Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredResources.map((res) => (
                  <div
                    key={res.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 group hover:border-accent/30 hover:shadow-lg transition-all dark:border-white/8 dark:bg-paper flex flex-col justify-between min-h-[180px]"
                    style={{ boxShadow: 'var(--ls-shadow)' }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          res.format === 'cheatsheet' ? 'bg-amber-500/10 text-amber-500' :
                          res.format === 'pdf' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          {res.format}
                        </span>
                        <span className="text-[10px] text-muted">{res.size}</span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-950 dark:text-ink group-hover:text-accent transition-colors line-clamp-1">{res.title}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-ink-muted">By {res.author} • {res.category}</p>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed dark:text-ink-muted line-clamp-2">
                        {res.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between mt-4">
                      <span className="text-[9px] font-mono text-slate-400">Added {res.addedDate}</span>
                      
                      {res.downloadUrl ? (
                        <a
                          href={res.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"
                        >
                          Access Portal <ExternalLink size={10} />
                        </a>
                      ) : (
                        <button
                          onClick={() => setSelectedResource(res)}
                          className="flex items-center gap-1 text-[11px] font-bold text-accent hover:underline cursor-pointer"
                        >
                          View Document <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Column 3: Stats & Outsource summary */}
            <div className="space-y-6">
              
              <div className="bg-slate-950 text-white p-6 rounded-[2rem] border border-slate-800/60 space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#10b88108_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-accent">
                    <Award size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold tracking-tight">Free Ebook Library</h3>
                    <p className="text-[10px] text-white/50">LevelUp Premium Outsources</p>
                  </div>
                </div>

                <p className="text-xs text-white/60 leading-relaxed">
                  Get ahead with pre-curated textbooks, exam preparation syllabuses, formulas cheat sheets, and diagnostic study kits curated by pedagogical specialists.
                </p>

                <div className="bg-white/5 rounded-2xl p-4 flex gap-3 text-xs leading-normal">
                  <Zap size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-white/80">All study resources are completely offline-cached and immediately printable for your study convenience.</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ─── TAB 3: REFERENCE DISCOVER TAB ─── */}
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
                    <h2 className="text-xl font-bold text-slate-950 dark:text-ink font-serif">القرآن الكريم</h2>
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
                    {quranSurahs.filter(s =>
                      s.englishName.toLowerCase().includes(quranSearch.toLowerCase()) ||
                      s.name.includes(quranSearch) ||
                      String(s.number).includes(quranSearch)
                    ).map(s => (
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
                          <p className="text-base text-slate-800 dark:text-ink/90 font-serif">{s.name}</p>
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
                        className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-5 dark:bg-paper dark:border-white/8"
                        style={{ boxShadow: 'var(--ls-shadow)' }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-2xl font-bold text-slate-950 dark:text-ink">{entry.word}</h3>
                              <button
                                onClick={() => {
                                  const isSaved = vocab.includes(entry.word.toLowerCase());
                                  if (isSaved) {
                                    setVocab(prev => prev.filter(w => w !== entry.word.toLowerCase()));
                                    toast.success(`Removed "${entry.word}" from your Vocabulary Vault.`);
                                  } else {
                                    setVocab(prev => [...prev, entry.word.toLowerCase()]);
                                    toast.success(`Saved "${entry.word}" to your Vocabulary Vault!`);
                                  }
                                }}
                                className={`p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all ${
                                  vocab.includes(entry.word.toLowerCase()) ? 'text-accent' : 'text-slate-400 hover:text-slate-600'
                                }`}
                                title={vocab.includes(entry.word.toLowerCase()) ? "Remove from Vocabulary Vault" : "Save to Vocabulary Vault"}
                              >
                                <BookMarked size={16} className={vocab.includes(entry.word.toLowerCase()) ? "fill-current" : ""} />
                              </button>
                            </div>
                            {entry.phonetic && (
                              <p className="text-sm text-slate-400 dark:text-ink-muted font-mono mt-0.5">{entry.phonetic}</p>
                            )}
                          </div>
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
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Wikipedia Panel ── */}
            {discoverSection === 'wiki' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-950 dark:text-ink">Encyclopedia</h2>
                  <p className="text-xs text-slate-500 dark:text-ink-muted">Search general academic concepts and summaries via Wikipedia</p>
                </div>

                <form onSubmit={handleWikiSearch} className="flex gap-2">
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
                      placeholder="Search concept (e.g. gravity, plate tectonics)..."
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

                {wikiLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Searching database...</span>
                  </div>
                ) : wikiSummary ? (
                  <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-4 dark:bg-paper dark:border-white/8" style={{ boxShadow: 'var(--ls-shadow)' }}>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-950 dark:text-ink">{wikiSummary.title}</h3>
                        <a href={wikiSummary.content_urls.desktop.page} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1 mt-1">
                          View full Wikipedia article <ExternalLink size={10} />
                        </a>
                      </div>
                      <button onClick={() => setWikiSummary(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-surface-low rounded-lg transition-all text-slate-400">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="text-sm text-slate-700 dark:text-ink-secondary leading-relaxed font-sans space-y-3">
                      <p>{wikiSummary.extract}</p>
                    </div>
                  </div>
                ) : wikiResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {wikiResults.map(article => (
                      <button
                        key={article.id}
                        onClick={() => handleWikiArticle(article.key)}
                        className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-accent/40 text-left transition-all group dark:bg-paper dark:border-white/8 dark:hover:border-white/15"
                        style={{ boxShadow: 'var(--ls-shadow)' }}
                      >
                        <h4 className="font-bold text-slate-950 dark:text-ink group-hover:text-accent transition-all line-clamp-1">{article.title}</h4>
                        <p className="text-xs text-slate-400 dark:text-ink-muted mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.excerpt) }} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

          </div>
        )}

            </div>
          </div>

          {/* Column 3: Right Sidebar */}
          <div className="hidden lg:flex lg:w-[260px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-5">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6 pr-1">

              {/* Deep Focus Pomodoro */}
              <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Deep Focus</h3>
                  <div className="text-3xl font-bold tracking-tight mb-3">{formatTime(timerSeconds)}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsTimerRunning(!isTimerRunning)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isTimerRunning ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-accent text-white hover:bg-accent/90'
                      }`}
                    >
                      {isTimerRunning ? 'Pause' : 'Start Timer'}
                    </button>
                    <button
                      onClick={() => { setIsTimerRunning(false); setTimerSeconds(25 * 60); }}
                      className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </section>

              {/* Learning Tips */}
              <section className="space-y-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Learning Tips</p>
                {[
                  { tip: 'Use AI Explainer to bridge gaps before moving on', icon: <Brain size={12} /> },
                  { tip: 'Save reference resources to your Vault for offline review', icon: <BookOpen size={12} /> },
                  { tip: 'Look up unfamiliar words in the dictionary tool', icon: <Lightbulb size={12} /> },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5">
                    <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0 mt-0.5">{item.icon}</div>
                    <p className="text-[11px] text-slate-600 dark:text-ink-secondary leading-relaxed">{item.tip}</p>
                  </div>
                ))}
              </section>

              {/* Session Stats */}
              <section className="space-y-2">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Session</p>
                <div className="p-4 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5 space-y-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-ink-muted">Resources</span>
                    <span className="font-bold text-slate-800 dark:text-ink">{resources.length}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-ink-muted">Vocab</span>
                    <span className="font-bold text-slate-800 dark:text-ink">{vocab.length}</span>
                  </div>
                </div>
              </section>

            </div>
          </div>

        </div>
      </div>

      {/* ─── DYNAMIC COGNITIVE AI EXPLAINER PANEL (POPUP OR CARD OVERLAY) ─── */}
      <AnimatePresence>
        {explainerOpen && selectedGap && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/20 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xl h-full bg-paper border-l border-ink/10 shadow-2xl flex flex-col justify-between overflow-hidden relative"
            >
              {/* Top Banner */}
              <div className="p-6 bg-slate-950 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-accent">
                    <Brain className="w-5 h-5 shrink-0 animate-pulse" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold truncate max-w-[280px]">{selectedGap.concept}</h3>
                    <p className="text-[10px] text-white/50 tracking-wider uppercase font-mono mt-0.5">{selectedGap.subject} • AI SUPPORT ACTIVE</p>
                  </div>
                </div>
                <button
                  onClick={() => setExplainerOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/60 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Explainer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scroll-smooth no-scrollbar">
                
                {aiResponding ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span className="text-xs font-mono">Synthesizing pedagogical guide parameters...</span>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 text-left"
                  >
                    {/* Visual warning of the gap */}
                    {!selectedGap.solved && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex gap-3 text-xs leading-relaxed">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-amber-800 dark:text-amber-400 font-medium">
                          Concept flagged during recent {selectedGap.failedIn}. Study the AI tutorial review below, then answer the verification question to bridge the gap.
                        </p>
                      </div>
                    )}

                    {selectedGap.solved && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex gap-3 text-xs leading-relaxed">
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-emerald-800 dark:text-emerald-400 font-bold">
                          Gap Bridged! You have verified your mastery over this concept. Click review to refresh anytime.
                        </p>
                      </div>
                    )}

                    {/* Tutorial content */}
                    <div className="prose prose-slate dark:prose-invert max-w-none text-sm text-slate-800 dark:text-ink-secondary leading-relaxed font-sans space-y-4">
                      <Markdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                      >
                        {selectedGap.explanationSnippet}
                      </Markdown>
                    </div>

                    {/* Verification Quiz Block */}
                    <div className="border-t border-ink/5 pt-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Award size={16} className="text-accent" />
                        <span className="text-[10px] font-black uppercase text-ink-muted tracking-wider">Bridge-the-Gap Verification Task</span>
                      </div>

                      <div className="p-5 bg-background/40 border border-ink/5 rounded-2xl space-y-4">
                        <p className="text-xs font-bold text-ink leading-relaxed">
                          {selectedGap.solutionQuestion}
                        </p>

                        <div className="space-y-2">
                          {selectedGap.solutionOptions.map((opt, oIdx) => {
                            const isSelected = selectedOptionIndex === oIdx;
                            const isCorrectAnswer = oIdx === selectedGap.correctOptionIndex;

                            let optStyle = 'border-ink/5 bg-paper/50 hover:bg-paper';
                            if (isSelected) {
                              optStyle = 'border-accent bg-accent/5 ring-1 ring-accent';
                            }
                            if (isQuizChecked) {
                              if (isCorrectAnswer) {
                                optStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold';
                              } else if (isSelected && !isCorrectAnswer) {
                                optStyle = 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400';
                              } else {
                                optStyle = 'border-ink/5 opacity-50 bg-paper/20';
                              }
                            }

                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => handleOptionSelect(oIdx)}
                                disabled={isQuizChecked}
                                className={`w-full text-left p-3.5 rounded-xl border text-xs leading-tight transition-all duration-300 cursor-pointer ${optStyle}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {!isQuizChecked ? (
                          <button
                            type="button"
                            onClick={checkBridgeSuccess}
                            disabled={selectedOptionIndex === null}
                            className="w-full py-3 bg-slate-950 hover:bg-accent text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Submit Answer & Clear Gap
                          </button>
                        ) : (
                          <div className={`p-4.5 rounded-xl border text-center text-xs font-bold leading-normal ${
                            isAnswerCorrect ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
                          }`}>
                            {isAnswerCorrect 
                              ? "Excellent! Verification success. The knowledge gap has been fully reconciled." 
                              : "Verification failure. Re-read the explanations and formula sheets to try again."}
                          </div>
                        )}
                      </div>
                    </div>

                  </motion.div>
                )}

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── DYNAMIC OUTSOURCED DOCUMENT PREVIEW ─── */}
      <AnimatePresence>
        {selectedResource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-paper border border-ink/10 w-full max-w-3xl rounded-[2rem] shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-ink/5 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/5 text-accent">
                    <FileText size={18} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-950 dark:text-ink">{selectedResource.title}</h3>
                    <p className="text-[10px] text-muted">{selectedResource.author} • {selectedResource.category}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedResource(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-surface-low rounded-lg transition-all text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto no-scrollbar prose prose-slate dark:prose-invert max-w-none text-left p-2">
                <Markdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                >
                  {selectedResource.content || '# Content Not Loaded'}
                </Markdown>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── DYNAMIC ADD MANUAL OUTSOURCED RESOURCE MODAL ─── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-paper border border-ink/10 w-full max-w-md rounded-[2rem] shadow-2xl p-6 relative overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-ink/5 pb-4 mb-4">
                <h3 className="font-bold text-lg text-slate-950 dark:text-ink">Cache Outsourced Link</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-surface-low rounded-lg text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddResource} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-ink-muted">Resource Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Khan Academy Calculus Course"
                    value={newResource.title}
                    onChange={e => setNewResource({ ...newResource, title: e.target.value })}
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20 text-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-ink-muted">Brief Description</label>
                  <input
                    type="text"
                    required
                    placeholder="Describe what help this outsourcing offers..."
                    value={newResource.description}
                    onChange={e => setNewResource({ ...newResource, description: e.target.value })}
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20 text-ink"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-ink-muted">Resource URL Link</label>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/resource"
                    value={newResource.url}
                    onChange={e => setNewResource({ ...newResource, url: e.target.value })}
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20 text-ink"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-accent transition-all cursor-pointer"
                >
                  Register in LevelUp Vault
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </Layout>
  );
};
