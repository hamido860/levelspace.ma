import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { ShieldCheck, ArrowLeft, BookOpen, Plus, ChevronRight, CheckCircle2, Clock, Brain, Sparkles, Loader2, MoreHorizontal, Play, Target, Dumbbell, Database, BarChart2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { supabase } from '../db/supabase';
import { TagsManager } from '../components/TagsManager';
import { generateSeedLesson, generateLessonSuggestions, LessonSuggestion, checkAIProvider } from '../services/geminiService';
import { aiCrew } from '../services/aiCrewService';
import { getQuizzesByLesson } from '../services/quizService';
import { getExercisesByLesson } from '../services/exerciseService';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

// Moroccan bilingual system — map English ↔ French subject/grade names
const SUBJECT_ALIASES: Record<string, string[]> = {
  'mathematics': ['mathématiques', 'maths', 'math'],
  'mathématiques': ['mathematics', 'maths', 'math'],
  'physics': ['physique-chimie', 'physique', 'physics-chemistry'],
  'chemistry': ['physique-chimie', 'chimie'],
  'physics-chemistry': ['physique-chimie', 'physics', 'chemistry'],
  'physique-chimie': ['physics-chemistry', 'physics', 'chemistry'],
  'biology': ['sciences de la vie et de la terre', 'svt', 'life and earth sciences'],
  'svt': ['biology', 'sciences de la vie et de la terre', 'life and earth sciences'],
  'sciences de la vie et de la terre': ['biology', 'svt', 'life and earth sciences'],
  'life and earth sciences': ['sciences de la vie et de la terre', 'svt', 'biology'],
  'engineering': ['sciences de l\'ingénieur', 'engineering sciences', 'technology'],
  'sciences de l\'ingénieur': ['engineering', 'engineering sciences', 'technology'],
  'engineering sciences': ['sciences de l\'ingénieur', 'engineering', 'technology'],
  'accounting': ['comptabilité', 'finance', 'business'],
  'comptabilité': ['accounting', 'finance', 'business'],
  'philosophy': ['philosophie'],
  'philosophie': ['philosophy'],
  'history': ['histoire-géographie', 'histoire', 'history-geography'],
  'histoire': ['history', 'histoire-géographie', 'history-geography'],
  'histoire-géographie': ['history', 'geography', 'history-geography'],
  'geography': ['géographie', 'histoire-géographie'],
  'french': ['langue française', 'français', 'french language'],
  'français': ['french', 'langue française', 'french language'],
  'arabic': ['langue arabe', 'arabe', 'arabic language'],
  'arabe': ['arabic', 'langue arabe', 'arabic language'],
  'english': ['anglais', 'english language'],
  'anglais': ['english', 'english language'],
  'computer science': ['informatique', 'it', 'computer'],
  'informatique': ['computer science', 'it'],
  'economics': ['économie', 'economy'],
  'économie': ['economics', 'economy'],
  'management': ['sciences de gestion', 'business studies', 'gestion'],
  'sciences de gestion': ['management', 'business studies', 'gestion'],
};

const GRADE_ALIASES: Record<string, string[]> = {
  'grade 12': ['terminale', '2ème bac', 'bac 2', 'tle'],
  'terminale': ['grade 12', '2ème bac', 'bac 2', 'tle'],
  '2ème bac': ['grade 12', 'terminale'],
  'grade 11': ['première', '1ère bac', 'bac 1'],
  'première': ['grade 11', '1ère bac', 'bac 1'],
  '1ère bac': ['grade 11', 'première'],
  'grade 10': ['tronc commun', 'seconde', 'tc'],
  'tronc commun': ['grade 10', 'seconde'],
  'seconde': ['grade 10', 'tronc commun'],
};

const getSubjectSearchTerms = (name: string): string[] => {
  const key = name.toLowerCase().trim();
  const aliases = SUBJECT_ALIASES[key] || [];
  return [name, ...aliases];
};

const getGradeSearchTerms = (grade: string): string[] => {
  const key = grade.toLowerCase().trim();
  const aliases = GRADE_ALIASES[key] || [];
  return [grade, ...aliases];
};

export const ClassroomView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [generatingTitle, setGeneratingTitle] = useState<string | null>(null);
  const [isFetchingGallery, setIsFetchingGallery] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [suggestions, setSuggestions] = useState<LessonSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'quizzes' | 'exercises'>('lessons');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);
  const aiAvailable = checkAIProvider();

  const module = useLiveQuery(() => id ? db.modules.get(id) : undefined, [id]);
  const allLessons = useLiveQuery(() => id ? db.lessons.where('moduleId').equals(id).sortBy('createdAt') : [], [id]);
  // ⚡ Bolt: Memoize derived array to prevent cascading re-renders on LiveQuery updates
  const lessons = useMemo(() => allLessons?.filter(l => l.status !== 'suggested') || [], [allLessons]);

  // Auto-seed from Supabase when local lessons are empty — no AI needed
  useEffect(() => {
    if (!module || !id || allLessons === undefined) return;
    if (allLessons.filter(l => l.status !== 'suggested').length > 0) return;
    (async () => {
      try {
        const subjectTerms = getSubjectSearchTerms(module.name);
        const gradeTerms = getGradeSearchTerms(selectedGrade);
        // Build OR of (subject AND grade) pairs to handle bilingual name mismatches
        const pairs = subjectTerms.flatMap(st =>
          gradeTerms.map(gt => `and(subject.ilike.%${st}%,grade.ilike.%${gt}%)`)
        ).join(',');
        const { data: dbLessons } = await supabase
          .from('lessons')
          .select('id, lesson_title, content, blocks, subtitle, status')
          .or(pairs);
        if (!dbLessons || dbLessons.length === 0) return;
        const toAdd = [];
        for (const les of dbLessons) {
          const existing = await db.lessons
            .where('title').equals(les.lesson_title)
            .and(l => l.moduleId === module.id)
            .first();
          if (!existing) {
            toAdd.push({
              id: les.id,
              moduleId: module.id,
              title: les.lesson_title,
              content: les.content || '',
              blocks: les.blocks,
              subtitle: les.subtitle,
              status: (les.status === 'published' || les.status === 'done') ? 'done' as const : 'pending' as const,
              createdAt: Date.now()
            });
          }
        }
        if (toAdd.length > 0) await db.lessons.bulkAdd(toAdd);
      } catch (err) {
        console.warn('[ClassroomView] Auto-seed from Supabase failed:', err);
      }
    })();
  }, [module?.id, allLessons?.length]);

  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  // ⚡ Bolt: Memoize derived object to preserve referential equality on LiveQuery updates
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const selectedGrade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const country = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';

  useEffect(() => {
    const fetchExtraData = async () => {
      if (!lessons.length) return;
      setIsLoadingExtra(true);
      try {
        const allQuizzes = [];
        const allExercises = [];
        for (const lesson of lessons) {
          const lessonQuizzes = await getQuizzesByLesson(lesson.id);
          const lessonExercises = await getExercisesByLesson(lesson.id);
          allQuizzes.push(...(lessonQuizzes || []));
          allExercises.push(...(lessonExercises || []));
        }
        setQuizzes(allQuizzes);
        setExercises(allExercises);
      } catch (error) {
        console.error("Failed to fetch extra data:", error);
      } finally {
        setIsLoadingExtra(false);
      }
    };
    
    if (activeTab !== 'lessons') {
      fetchExtraData();
    }
  }, [activeTab, lessons]);

  const fetchGallery = async () => {
    if (!module || !aiAvailable) return;
    setIsFetchingGallery(true);
    try {
      // Fetch existing topics from Supabase if they exist
      let existingTopics: string[] = [];
      try {
        const { data: grades } = await supabase.from('grades').select('id').eq('name', selectedGrade).limit(1);
        const gradeId = grades?.[0]?.id;

        const { data: subjects } = await supabase.from('subjects').select('id').eq('name', module.name).limit(1);
        const subjectId = subjects?.[0]?.id;

        if (gradeId && subjectId) {
          const { data: topics } = await supabase
            .from('topics')
            .select('title')
            .eq('grade_id', gradeId)
            .eq('subject_id', subjectId);
          if (topics) {
            existingTopics = topics.map(t => t.title);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch topics from Supabase:", err);
      }

      // Check database first
      const existingSuggestions = await db.lessons
        .where('moduleId').equals(module.id)
        .filter(l => l.status === 'suggested')
        .toArray();
        
      if (existingSuggestions.length > 0) {
        setSuggestions(existingSuggestions.map(s => ({ title: s.title, description: s.content })));
        return;
      }

      // If not in DB, fetch from net
      const gallery = await generateLessonSuggestions(module.name, selectedGrade, country, 2, existingTopics);
      
      // Save to DB for future
      const newSuggestions = gallery.map(g => ({
        id: crypto.randomUUID(),
        moduleId: module.id,
        title: g.title,
        content: g.description,
        status: 'suggested' as const,
        createdAt: Date.now()
      }));
      await db.lessons.bulkPut(newSuggestions);
      
      setSuggestions(gallery);
    } catch (error) {
      console.error("Failed to fetch gallery:", error);
    } finally {
      setIsFetchingGallery(false);
    }
  };


  const buildChainContext = async (maxChars = 8000): Promise<string> => {
    if (!module) return '';
    const parts: string[] = [];

    // 1. Local lessons (IndexedDB)
    const localLessons = allLessons?.filter(l => l.status !== 'suggested') || [];
    for (const l of localLessons) {
      parts.push(`Title: ${l.title}\nContent: ${l.content || (l.blocks ? l.blocks.map((b: any) => b.content).join('\n') : '')}`);
    }

    // 2. Supabase lessons for this subject/grade/country (seed chaining)
    try {
      const { data: dbLessons } = await supabase
        .from('lessons')
        .select('lesson_title, content')
        .eq('subject', module.category || module.name)
        .eq('grade', selectedGrade)
        .eq('country', country)
        .limit(5);
      if (dbLessons) {
        for (const l of dbLessons) {
          const entry = `Title: ${l.lesson_title}\nContent: ${l.content?.substring(0, 600) ?? ''}`;
          if (!parts.some(p => p.includes(l.lesson_title))) parts.push(entry);
        }
      }
    } catch { /* non-critical */ }

    const combined = parts.join('\n\n');
    return combined.length > maxChars ? combined.substring(0, maxChars) + '...' : combined;
  };

  const handleGenerateLesson = async (title?: string, autoNavigate = false) => {
    if (!module || !aiAvailable) return;
    const lessonTitle = title || module.name;
    setGeneratingTitle(lessonTitle);
    try {
      const existingContext = await buildChainContext();

      const seedLesson = await generateSeedLesson(lessonTitle, selectedGrade, country, 2, module.strictRAG, existingContext);
      if (seedLesson) {
        const newLessonId = crypto.randomUUID();
        await db.lessons.add({
          id: newLessonId,
          moduleId: module.id,
          title: seedLesson.title,
          content: '',
          blocks: seedLesson.blocks,
          subtitle: seedLesson.subtitle,
          status: 'pending',
          createdAt: Date.now()
        });
        
        // Remove from suggestions if it was one
        if (title) {
          setSuggestions(prev => prev.filter(s => s.title !== title));
          setSelectedSuggestions(prev => prev.filter(t => t !== title));
          
          // Remove from DB
          const existingSuggestion = await db.lessons
            .where('moduleId').equals(module.id)
            .filter(l => l.status === 'suggested' && l.title === title)
            .first();
          if (existingSuggestion) {
            await db.lessons.delete(existingSuggestion.id);
          }
        }

        if (autoNavigate) {
          navigate(`/lesson/${newLessonId}`);
        }
      }
    } catch (error) {
      console.error("Failed to generate lesson:", error);
    } finally {
      setGeneratingTitle(null);
    }
  };

  const handleCurateSelected = async () => {
    if (!module || selectedSuggestions.length === 0 || !aiAvailable) return;
    setGeneratingTitle('selected');
    try {
      const existingContext = await buildChainContext();

      for (const title of selectedSuggestions) {
        const seedLesson = await generateSeedLesson(title, selectedGrade, country, 2, module.strictRAG, existingContext);
        if (seedLesson) {
          await db.lessons.add({
            id: crypto.randomUUID(),
            moduleId: module.id,
            title: seedLesson.title,
            content: '',
            blocks: seedLesson.blocks,
            subtitle: seedLesson.subtitle,
            status: 'pending',
            createdAt: Date.now()
          });
          
          // Remove from DB
          const existingSuggestion = await db.lessons
            .where('moduleId').equals(module.id)
            .filter(l => l.status === 'suggested' && l.title === title)
            .first();
          if (existingSuggestion) {
            await db.lessons.delete(existingSuggestion.id);
          }
        }
      }
      setSuggestions(prev => prev.filter(s => !selectedSuggestions.includes(s.title)));
      setSelectedSuggestions([]);
    } catch (error) {
      console.error("Failed to curate selected:", error);
    } finally {
      setGeneratingTitle(null);
    }
  };

  const handleCurateAll = async () => {
    if (!module || suggestions.length === 0 || !aiAvailable) return;
    setGeneratingTitle('all');
    try {
      const existingContext = await buildChainContext();

      const titles = suggestions.map(s => s.title);
      for (const title of titles) {
        const seedLesson = await generateSeedLesson(title, selectedGrade, country, 2, module.strictRAG, existingContext);
        if (seedLesson) {
          await db.lessons.add({
            id: crypto.randomUUID(),
            moduleId: module.id,
            title: seedLesson.title,
            content: '',
            blocks: seedLesson.blocks,
            subtitle: seedLesson.subtitle,
            status: 'pending',
            createdAt: Date.now()
          });
          
          // Remove from DB
          const existingSuggestion = await db.lessons
            .where('moduleId').equals(module.id)
            .filter(l => l.status === 'suggested' && l.title === title)
            .first();
          if (existingSuggestion) {
            await db.lessons.delete(existingSuggestion.id);
          }
        }
      }
      setSuggestions([]);
      setSelectedSuggestions([]);
    } catch (error) {
      console.error("Failed to curate all:", error);
    } finally {
      setGeneratingTitle(null);
    }
  };

  const handleSeedFromSupabase = async () => {
    if (!module) return;
    setIsSeeding(true);
    try {
      // Find matching curriculum metadata
      const { data: dbLessons, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('subject', module.category)
        .eq('grade', selectedGrade)
        .eq('country', country);

      if (error) throw error;
      
      if (!dbLessons || dbLessons.length === 0) {
        toast.info("No existing lessons found in Supabase for this curriculum.");
        return;
      }

      // Add to dexie db
      for (const les of dbLessons) {
        const existing = await db.lessons.where('title').equals(les.lesson_title).and(l => l.moduleId === module.id).first();
        if (!existing) {
          await db.lessons.add({
            id: les.id || crypto.randomUUID(),
            moduleId: module.id,
            title: les.lesson_title,
            content: les.content,
            status: 'done',
            createdAt: Date.now()
          });
        }
      }

      // Enforce strict RAG mode for this module by default as requested
      await db.modules.update(module.id, { strictRAG: true });
      
      toast.success(`Seeded ${dbLessons.length} lessons from Supabase. Strict RAG mode enabled.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to seed from Supabase: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAuditClassroom = async () => {
    if (!module) return;
    
    toast.promise(
      aiCrew.addTask('classroom_audit', {
        moduleName: module.name,
        country: country,
        grade: selectedGrade,
        subject: module.category,
        existingLessons: lessons.map(l => ({ title: l.title, content: l.content }))
      }),
      {
        loading: 'Delegating audit to AI Crew...',
        success: 'Audit task added to queue!',
        error: 'Failed to delegate audit.'
      }
    );
  };

  if (module === undefined) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (module === null) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <BookOpen className="w-12 h-12 text-muted/20" />
          <p className="text-ink font-medium">Classroom not found.</p>
          <button onClick={() => navigate('/dashboard')} className="text-accent hover:underline">Return to Dashboard</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Dashboard
            </button>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="bg-accent/10 text-accent text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">{module.code}</span>
                <span className="text-muted text-xs font-medium">{module.category}</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold font-display leading-[0.88] tracking-tight text-ink editorial-title">{module.name}</h1>
              <p className="text-muted text-sm max-w-2xl leading-relaxed">{module.description}</p>
            </div>
          </div>

            <div className="flex items-center gap-3">
            <button
              onClick={handleAuditClassroom}
              disabled={!aiAvailable}
              title={!aiAvailable ? "AI features need an API key, but your classroom content is available." : "Audit Classroom Content"}
              className="flex items-center gap-2 bg-surface-low text-muted hover:text-accent px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-ink/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck size={14} />
              Audit
            </button>
            <button
              onClick={() => handleGenerateLesson()}
              disabled={!aiAvailable || !!generatingTitle}
              title={!aiAvailable ? "AI features need an API key, but your classroom content is available." : ""}
              className="flex items-center gap-2 bg-ink text-paper px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all shadow-lg shadow-ink/10 disabled:opacity-50"
            >
              {generatingTitle === module.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate Lesson
            </button>
            <button className="w-12 h-12 bg-surface-low rounded-xl flex items-center justify-center text-muted hover:text-ink transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>

        {/* Admin Dashboard Panel */}
        {isAdmin && (
          <div className="bg-surface-low rounded-3xl p-6 border border-accent/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                <Database size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">Admin Operations</h2>
                <p className="text-xs text-muted">Manage Supabase synchronization and constraints.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-paper border border-ink/5 p-5 rounded-2xl">
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2 font-bold text-ink text-sm">
                     <BarChart2 size={16} className="text-accent" />
                     Classroom Settings
                   </div>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-surface-low rounded-xl">
                   <div>
                     <p className="text-sm font-bold text-ink">Strict RAG Mode</p>
                     <p className="text-[10px] text-muted">Restrict AI generation to lesson context only</p>
                   </div>
                   <button
                     onClick={async () => {
                       await db.modules.update(module.id, { strictRAG: !module.strictRAG });
                     }}
                     className={`w-12 h-6 rounded-full transition-colors relative ${module.strictRAG ? 'bg-accent' : 'bg-ink/20'}`}
                   >
                     <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${module.strictRAG ? 'translate-x-6' : 'translate-x-0'}`} />
                   </button>
                 </div>
              </div>

              <div className="bg-paper border border-ink/5 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 font-bold text-ink text-sm">
                  <Database size={16} className="text-accent" />
                  Supabase Seeding
                </div>
                <p className="text-xs text-muted">Fetch existing certified curriculum units from the master database directly into this local classroom.</p>
                <button
                  onClick={handleSeedFromSupabase}
                  disabled={isSeeding}
                  className="w-full flex items-center justify-center gap-2 bg-ink text-paper py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  Seed Classroom from Supabase
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-paper border border-ink/5 rounded-2xl p-6 space-y-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Progress</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-ink">{module.progress}%</span>
              <span className="text-xs text-muted">Complete</span>
            </div>
            <div className="w-full h-1.5 bg-surface-low rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${module.progress}%` }} />
            </div>
          </div>
          <div className="bg-paper border border-ink/5 rounded-2xl p-6 space-y-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Lessons</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-ink">{lessons.length}</span>
              <span className="text-xs text-muted">Units Curated</span>
            </div>
          </div>
          <div className="bg-paper border border-ink/5 rounded-2xl p-6 space-y-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-bold text-ink">Active Learning</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink/10">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'lessons' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Lessons
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'quizzes' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Quizzes
          </button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'exercises' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Exercises
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'lessons' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <BookOpen size={20} className="text-accent" />
                Curriculum Units
              </h3>
              {lessons.length > 0 && suggestions.length === 0 && (
                <button
                  onClick={fetchGallery}
                  disabled={isFetchingGallery || !aiAvailable}
                  title={!aiAvailable ? "AI features need an API key, but your classroom content is available." : ""}
                  className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFetchingGallery ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  Fetch Lesson Gallery
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {Array.isArray(lessons) && lessons.length > 0 ? (
                lessons.map((lesson, i) => (
                  <motion.div 
                    key={lesson.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/lesson/${lesson.id}`)}
                    className="bg-paper border border-ink/5 p-5 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-accent/30 hover:shadow-xl hover:shadow-ink/5 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                        lesson.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-surface-low text-muted group-hover:bg-accent/10 group-hover:text-accent'
                      }`}>
                        {lesson.status === 'done' ? <CheckCircle2 size={24} /> : <Play size={20} className="ml-1" />}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-ink group-hover:text-accent transition-colors">{lesson.title}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted/60">Unit {i + 1}</span>
                          <span className="w-1 h-1 rounded-full bg-ink/10" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted/60">~15 min</span>
                        </div>
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <TagsManager 
                            tags={lesson.tags || []} 
                            onAddTag={async (tag) => {
                              const currentTags = lesson.tags || [];
                              if (!currentTags.includes(tag)) {
                                await db.lessons.update(lesson.id, { tags: [...currentTags, tag] });
                              }
                            }}
                            onRemoveTag={async (tag) => {
                              const currentTags = lesson.tags || [];
                              await db.lessons.update(lesson.id, { tags: currentTags.filter(t => t !== tag) });
                            }}
                            maxDisplay={7}
                          />
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-muted/30 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </motion.div>
                ))
              ) : (
                <div className="bg-surface-low/50 border border-dashed border-ink/10 rounded-3xl p-16 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-16 h-16 bg-paper rounded-full flex items-center justify-center shadow-sm">
                    <BookOpen size={24} className="text-accent" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-ink">No units curated yet</p>
                    <p className="text-xs text-muted max-w-xs">Load existing curriculum units from Supabase or generate new ones with AI.</p>
                  </div>
                  {!aiAvailable && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 w-full max-w-sm">
                      <p className="text-xs text-amber-800 font-medium">AI features need an API key, but your classroom content is available.</p>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                    <button
                      onClick={handleSeedFromSupabase}
                      disabled={isSeeding}
                      className="flex-1 flex items-center justify-center gap-2 bg-ink text-paper px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all disabled:opacity-50"
                    >
                      {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                      {isSeeding ? "Loading..." : "Load from Supabase"}
                    </button>
                    <button
                      onClick={fetchGallery}
                      disabled={isFetchingGallery || !aiAvailable}
                      title={!aiAvailable ? "AI features need an API key, but your classroom content is available." : ""}
                      className="flex-1 flex items-center justify-center gap-2 bg-surface-low text-ink px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent/10 transition-all disabled:opacity-50"
                    >
                      {isFetchingGallery ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isFetchingGallery ? "Generating..." : "Generate with AI"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'quizzes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <Target size={20} className="text-accent" />
                Available Quizzes
              </h3>
            </div>
            {isLoadingExtra ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : quizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-paper border border-ink/5 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer">
                    <h4 className="font-bold text-ink">{quiz.title}</h4>
                    <p className="text-sm text-muted mt-1">{quiz.description}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-surface-low px-2 py-1 rounded text-muted">{quiz.difficulty}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-surface-low px-2 py-1 rounded text-muted">{quiz.questions?.length || 0} Questions</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-low/50 border border-dashed border-ink/10 rounded-3xl p-16 text-center">
                <p className="text-muted">No quizzes available for these lessons yet.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercises' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <Dumbbell size={20} className="text-accent" />
                Practice Exercises
              </h3>
            </div>
            {isLoadingExtra ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : exercises.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exercises.map((exercise) => (
                  <div key={exercise.id} className="bg-paper border border-ink/5 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer">
                    <h4 className="font-bold text-ink">{exercise.title}</h4>
                    <p className="text-sm text-muted mt-1 line-clamp-2">{exercise.prompt}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-surface-low px-2 py-1 rounded text-muted">{exercise.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-low/50 border border-dashed border-ink/10 rounded-3xl p-16 text-center">
                <p className="text-muted">No exercises available for these lessons yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Gallery Section */}
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-8 border-t border-ink/5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Sparkles size={20} className="text-accent" />
                  Suggested Units
                </h3>
                <div className="flex items-center gap-4">
                  {selectedSuggestions.length > 0 ? (
                    <button 
                      onClick={handleCurateSelected}
                      disabled={!!generatingTitle}
                      className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                    >
                      {generatingTitle === 'selected' ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                      Curate Selected ({selectedSuggestions.length})
                    </button>
                  ) : (
                    <button 
                      onClick={handleCurateAll}
                      disabled={!!generatingTitle}
                      className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                    >
                      {generatingTitle === 'all' ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                      Curate All
                    </button>
                  )}
                  <button 
                    onClick={() => setSuggestions([])}
                    className="text-[10px] font-bold text-muted uppercase tracking-widest hover:text-ink"
                  >
                    Close Gallery
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.isArray(suggestions) && suggestions.map((suggestion, i) => {
                  const isSelected = selectedSuggestions.includes(suggestion.title);
                  const isThisGenerating = generatingTitle === suggestion.title;
                  const anyGenerating = !!generatingTitle;

                  return (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        if (anyGenerating) return;
                        setSelectedSuggestions(prev => 
                          prev.includes(suggestion.title) 
                            ? prev.filter(t => t !== suggestion.title) 
                            : [...prev, suggestion.title]
                        );
                      }}
                      className={`bg-paper border p-6 rounded-2xl space-y-4 transition-all group cursor-pointer relative ${
                        isSelected ? 'border-accent ring-1 ring-accent/20 bg-accent/[0.02]' : 'border-ink/5 hover:border-accent/30'
                      } ${anyGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSelected && (
                        <div className="absolute top-4 right-4 text-accent">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                      <div className="space-y-1">
                        <h4 className={`text-base font-bold transition-colors ${isSelected ? 'text-accent' : 'text-ink group-hover:text-accent'}`}>
                          {suggestion.title}
                        </h4>
                        <p className="text-xs text-muted leading-relaxed">{suggestion.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateLesson(suggestion.title);
                          }}
                          disabled={anyGenerating}
                          className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                        >
                          {isThisGenerating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          Curate
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateLesson(suggestion.title, true);
                          }}
                          disabled={anyGenerating}
                          className="flex items-center gap-2 text-[10px] font-bold text-ink uppercase tracking-widest hover:underline disabled:opacity-50"
                        >
                          {isThisGenerating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                          Curate & Launch
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
