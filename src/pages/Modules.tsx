import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import {
  Filter,
  ArrowUpDown,
  BookOpen,
  Globe,
  FlaskConical,
  Library,
  Brain,
  ArrowRight,
  Info,
  Sparkles,
  Loader2,
  PlusCircle,
  Clock,
  Play,
  Timer,
  RefreshCw,
  Target,
  LayoutGrid,
  TrendingUp,
  Zap
} from 'lucide-react';
import { generateCurriculum, checkAIProvider } from '../services/geminiService';
import { getClassroomLoadPlan, mapSubjectsToModules, mergeModulesWithAiSuggestions, shouldRequestAiCurriculumSuggestions } from '../services/classroomLoader';
import { getGradeCandidates, getSubjectCandidates, normalizeCurriculumValue } from '../services/curriculumMatching';
import { supabase } from '../db/supabase';
import { useSearch } from '../context/SearchContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const relativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getIconForCategory = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('math') || cat.includes('science') || cat.includes('physics') || cat.includes('chem')) return <FlaskConical className="w-5 h-5" />;
  if (cat.includes('hist') || cat.includes('geog') || cat.includes('social') || cat.includes('world')) return <Globe className="w-5 h-5" />;
  if (cat.includes('lit') || cat.includes('lang') || cat.includes('art')) return <BookOpen className="w-5 h-5" />;
  if (cat.includes('psych') || cat.includes('phil') || cat.includes('socio')) return <Brain className="w-5 h-5" />;
  return <Library className="w-5 h-5" />;
};

const getLessonIllustration = (title: string | null | undefined, category?: string | null | undefined) => {
  const t = String(title || '').toLowerCase();
  const c = String(category || '').toLowerCase();
  
  if (
    t.includes('math') || 
    t.includes('geom') || 
    t.includes('arith') || 
    t.includes('calcul') || 
    t.includes('algebra') || 
    t.includes('suite') || 
    t.includes('série') || 
    t.includes('analyse') || 
    c.includes('math')
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
    c.includes('phys') || 
    c.includes('chim')
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
    c.includes('svt') || 
    c.includes('vie')
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
    c.includes('lang') || 
    c.includes('fr') || 
    c.includes('ar') || 
    c.includes('phil')
  ) {
    return '/illustrations/humanities_languages.png';
  }
  return '/illustrations/default_edu.png';
};


const MODULES_SCOPE_VERSION = 'v2';

const MOROCCAN_SCOPE_SUBJECTS: Record<string, string[]> = {
  'tronc commun::tronc commun scientifique': [
    'Mathématiques',
    'Physique-Chimie',
    'Sciences de la Vie et de la Terre (SVT)',
    'Français',
    'Informatique',
    'Arabe',
    'Education Islamique',
    'Histoire-Géographie',
  ],
  'tronc commun::tronc commun litteraire': [
    'Arabe',
    'Français',
    'Histoire-Géographie',
    'Education Islamique',
    'Mathématiques',
    'Informatique',
  ],
  'tronc commun::tronc commun technologique': [
    'Mathématiques',
    'Physique-Chimie',
    "Sciences de l'Ingénieur",
    'Français',
    'Informatique',
  ],
};

const buildTrustedSubjectNames = (country: string, grade: string, track: string) => {
  if (normalizeCurriculumValue(country) !== 'morocco') return [];
  return MOROCCAN_SCOPE_SUBJECTS[`${normalizeCurriculumValue(grade)}::${normalizeCurriculumValue(track)}`] || [];
};

const buildTrustedSubjectSet = (subjectNames: string[]) =>
  new Set(
    subjectNames
      .flatMap((name) => getSubjectCandidates(name))
      .map((name) => normalizeCurriculumValue(name)),
  );

const moduleMatchesTrustedSubjects = (
  module: { name: string; category: string; code: string },
  trustedSubjects: Set<string>,
) => {
  if (trustedSubjects.size === 0) return true;

  const candidates = new Set(
    [
      ...getSubjectCandidates(module.name, module.category),
      module.code,
    ].map((value) => normalizeCurriculumValue(String(value || ''))),
  );

  return Array.from(candidates).some((candidate) => trustedSubjects.has(candidate));
};

const buildFallbackTrustedModules = (subjectNames: string[]) =>
  subjectNames.map((name) => ({
    id: `trusted-${normalizeCurriculumValue(name).replace(/\s+/g, '-')}`,
    name,
    code: name,
    description: 'Trusted Moroccan curriculum subject',
    category: name,
    progress: 0,
    selected: false,
    createdAt: Date.now(),
  }));

const getNestedSingle = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

const inferGradeOrder = (grade: string) => {
  const normalized = normalizeCurriculumValue(grade);
  const numeric = normalized.match(/\d+/)?.[0];
  if (!numeric) return null;

  const value = Number(numeric);
  if (!Number.isFinite(value)) return null;
  return value;
};

const inferCycleKey = (grade: string) => {
  const normalized = normalizeCurriculumValue(grade);

  if (normalized.includes('primaire') || normalized.includes('primary')) return 'primary';
  if (normalized.includes('college') || normalized.includes('middle')) return 'college';
  if (
    normalized.includes('tronc commun') ||
    normalized.includes('bac') ||
    normalized.includes('lycee') ||
    normalized.includes('seconde') ||
    normalized.includes('premiere') ||
    normalized.includes('terminale')
  ) {
    return 'lycee';
  }

  return null;
};

const cycleMatchesKey = (cycleName: string, cycleKey: string | null) => {
  if (!cycleKey) return true;

  const normalized = normalizeCurriculumValue(cycleName);
  if (cycleKey === 'primary') return normalized.includes('primaire') || normalized.includes('primary') || cycleName.includes('الإبتدائي');
  if (cycleKey === 'college') return normalized.includes('college') || normalized.includes('middle') || cycleName.includes('الإعدادي');
  if (cycleKey === 'lycee') return normalized.includes('lycee') || normalized.includes('high') || cycleName.includes('التأهيلي');
  return true;
};

type SupabaseGradeRow = {
  id: string;
  name?: string | null;
  grade_order?: number | null;
  cycles?: {
    name?: string | null;
    curricula?: { country?: string | null } | Array<{ country?: string | null }> | null;
  } | Array<{
    name?: string | null;
    curricula?: { country?: string | null } | Array<{ country?: string | null }> | null;
  }> | null;
};

const findScopedGrade = (grades: SupabaseGradeRow[], country: string, grade: string) => {
  const gradeCandidates = getGradeCandidates(grade);
  const normalizedGradeCandidates = new Set(gradeCandidates.map(normalizeCurriculumValue));
  const normalizedCountry = normalizeCurriculumValue(country);
  const inferredGradeOrder = inferGradeOrder(grade);
  const inferredCycleKey = inferCycleKey(grade);

  const countryGrades = grades.filter((row) => {
    const cycle = getNestedSingle(row.cycles);
    const curriculum = getNestedSingle(cycle?.curricula);
    const rowCountry = normalizeCurriculumValue(String(curriculum?.country || ''));
    return !normalizedCountry || rowCountry === normalizedCountry;
  });

  const exact = countryGrades.find((row) => normalizedGradeCandidates.has(normalizeCurriculumValue(String(row.name || ''))));
  if (exact) return exact;

  if (inferredGradeOrder === null) return null;

  return countryGrades.find((row) => {
    const cycle = getNestedSingle(row.cycles);
    return row.grade_order === inferredGradeOrder && cycleMatchesKey(String(cycle?.name || ''), inferredCycleKey);
  }) || null;
};

const fetchSubjectsForCurrentGrade = async (country: string, grade: string) => {
  const { data: grades, error: gradeError } = await supabase
    .from('grades')
    .select('id, name, grade_order, cycles(name, curricula(country))');

  if (gradeError) throw gradeError;

  const matchedGrade = findScopedGrade((grades || []) as SupabaseGradeRow[], country, grade);
  if (!matchedGrade) return null;

  const { data: gradeSubjects, error: gradeSubjectError } = await supabase
    .from('grade_subjects')
    .select('subjects(*)')
    .eq('grade_id', matchedGrade.id);

  if (gradeSubjectError) throw gradeSubjectError;

  return (gradeSubjects || [])
    .map((row: any) => getNestedSingle(row.subjects))
    .filter(Boolean);
};

export const Modules: React.FC = () => {
  const { t } = useLanguage();
  const { isPro } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { searchQuery } = useSearch();
  const navigate = useNavigate();
  const aiAvailable = checkAIProvider();
  const aiUnavailableMsg = 'AI curriculum suggestions require an API key.';

  const dbModules = useLiveQuery(() => db.modules.toArray());
  const allLessons = useLiveQuery(() => db.lessons.toArray()) || [];

  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const country = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';
  const grade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const selectedBacTrackId = settingsMap['selected_bac_track'] || localStorage.getItem('selected_bac_track') || '';
  const selectedBacIntOptionId = settingsMap['selected_bac_int_option'] || localStorage.getItem('selected_bac_int_option') || '';
  const classroomScopeKey = [
    'modules',
    MODULES_SCOPE_VERSION,
    normalizeCurriculumValue(country),
    normalizeCurriculumValue(grade),
    normalizeCurriculumValue(String(selectedBacTrackId || '')),
    normalizeCurriculumValue(String(selectedBacIntOptionId || '')),
  ].join(':');
  const storedClassroomScopeKey = settingsMap['modules_scope_key'] || localStorage.getItem('modules_scope_key') || '';

  const gradeCandidates = useMemo(() => getGradeCandidates(grade), [grade]);
  const normalizedGradeCandidates = useMemo(
    () => new Set(gradeCandidates.map((g) => String(g || '').trim().toLocaleLowerCase())),
    [gradeCandidates],
  );
  const normalizedCurrentCountry = String(country || '').trim().toLocaleLowerCase();

  const lessonCountByModuleId = useMemo(
    () => allLessons.reduce<Record<string, number>>((acc, l) => {
      if (l.status === 'suggested') return acc;

      const lessonGrade = String(l.grade || '').trim().toLocaleLowerCase();
      if (lessonGrade && !normalizedGradeCandidates.has(lessonGrade)) {
        return acc;
      }

      const lessonCountry = String(l.country || '').trim().toLocaleLowerCase();
      if (normalizedCurrentCountry && lessonCountry) {
        const isMatch =
          (normalizedCurrentCountry === 'morocco' || normalizedCurrentCountry === 'maroc')
            ? (lessonCountry === 'morocco' || lessonCountry === 'maroc')
            : lessonCountry === normalizedCurrentCountry;
        if (!isMatch) return acc;
      }

      acc[l.moduleId] = (acc[l.moduleId] || 0) + 1;
      return acc;
    }, {}),
    [allLessons, normalizedCurrentCountry, normalizedGradeCandidates],
  );

  const lastActivityByModuleId = useMemo(
    () => allLessons.reduce<Record<string, number>>((acc, l) => {
      if (l.status === 'suggested') return acc;

      const lessonGrade = String(l.grade || '').trim().toLocaleLowerCase();
      if (lessonGrade && !normalizedGradeCandidates.has(lessonGrade)) {
        return acc;
      }

      const lessonCountry = String(l.country || '').trim().toLocaleLowerCase();
      if (normalizedCurrentCountry && lessonCountry) {
        const isMatch =
          (normalizedCurrentCountry === 'morocco' || normalizedCurrentCountry === 'maroc')
            ? (lessonCountry === 'morocco' || lessonCountry === 'maroc')
            : lessonCountry === normalizedCurrentCountry;
        if (!isMatch) return acc;
      }

      if (!acc[l.moduleId] || l.createdAt > acc[l.moduleId]) acc[l.moduleId] = l.createdAt;
      return acc;
    }, {}),
    [allLessons, normalizedCurrentCountry, normalizedGradeCandidates],
  );

  const [bacTrackName, setBacTrackName] = useState<string>('');
  const [bacIntOptionName, setBacIntOptionName] = useState<string>('');
  const trustedSubjectNames = useMemo(() => buildTrustedSubjectNames(country, grade, bacTrackName || selectedBacTrackId), [country, grade, bacTrackName, selectedBacTrackId]);
  const trustedSubjectSet = useMemo(() => buildTrustedSubjectSet(trustedSubjectNames), [trustedSubjectNames]);
  const modules = useMemo(() => (dbModules || [])
    .filter((module) => moduleMatchesTrustedSubjects(module, trustedSubjectSet))
    .map(m => ({
      ...m,
      icon: getIconForCategory(m.category)
    })), [dbModules, trustedSubjectSet]);
  const selectedCount = useMemo(() => modules.filter(m => m.selected).length, [modules]);

  useEffect(() => {
    const fetchBacDetails = async () => {
      if (selectedBacTrackId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacTrackId);
        if (isUUID) {
          const { data } = await supabase.from('bac_tracks').select('name').eq('id', selectedBacTrackId).single();
          if (data) setBacTrackName(data.name);
        } else {
          setBacTrackName(selectedBacTrackId);
        }
      } else {
        setBacTrackName("");
      }

      if (selectedBacIntOptionId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacIntOptionId);
        if (isUUID) {
          const { data } = await supabase.from('bac_international_options').select('name').eq('id', selectedBacIntOptionId).single();
          if (data) setBacIntOptionName(data.name);
        } else {
          setBacIntOptionName(selectedBacIntOptionId);
        }
      } else {
        setBacIntOptionName("");
      }
    };
    fetchBacDetails();
  }, [selectedBacTrackId, selectedBacIntOptionId, grade]);

  useEffect(() => {
    if (dbModules === undefined) return;
    if (!country) return;
    if (storedClassroomScopeKey === classroomScopeKey && modules.length > 0) return;

    const plan = getClassroomLoadPlan({ action: 'create_classroom', isPro });
    fetchCurriculum(plan.includeAiSuggestions);
  }, [classroomScopeKey, country, dbModules, grade, isPro, modules.length, storedClassroomScopeKey]);

  const fetchCurriculum = async (includeAiSuggestions = false, bypassAiCache = false) => {
    setIsLoading(true);
    try {
      const scopedSubjectRows = await fetchSubjectsForCurrentGrade(country, grade);
      let subjectRows = scopedSubjectRows;

      if (subjectRows === null) {
        const { data, error } = await supabase.from('subjects').select('*').limit(500);
        if (error) throw error;
        subjectRows = data || [];
      }

      const supabaseModules = mapSubjectsToModules((subjectRows || []) as any[]);
      let modulesToStore = supabaseModules;

      if (trustedSubjectSet.size > 0) {
        const scopedSupabaseModules = supabaseModules.filter((module) => moduleMatchesTrustedSubjects(module, trustedSubjectSet));
        modulesToStore = scopedSupabaseModules.length > 0
          ? scopedSupabaseModules
          : buildFallbackTrustedModules(trustedSubjectNames);
      }

      if (shouldRequestAiCurriculumSuggestions({ includeAiSuggestions, aiAvailable })) {
        let fullGrade = grade;
        if (bacTrackName) {
          fullGrade += ` - ${bacTrackName}`;
        }
        if (bacIntOptionName) {
          fullGrade += ` (${bacIntOptionName})`;
        }

        try {
          const aiModules = await generateCurriculum(country, fullGrade, false, 2, bypassAiCache);
          if (aiModules && aiModules.length > 0) {
            const formattedAiModules = aiModules.map(m => ({
              id: m.id,
              name: m.name,
              code: m.code,
              description: m.description,
              category: m.category,
              progress: 0,
              selected: false,
              createdAt: Date.now()
            }));
            if (trustedSubjectSet.size > 0) {
              modulesToStore = mergeModulesWithAiSuggestions(modulesToStore, formattedAiModules);
            } else {
              modulesToStore = mergeModulesWithAiSuggestions(supabaseModules, formattedAiModules);
            }
          }
        } catch (aiError) {
          console.warn('AI curriculum suggestions failed; keeping Supabase curriculum:', aiError);
        }
      }

      if (trustedSubjectSet.size > 0) {
        modulesToStore = modulesToStore.filter((module) => moduleMatchesTrustedSubjects(module, trustedSubjectSet));
      }

      if (modulesToStore.length > 0) {
        const existingById = new Map((dbModules || []).map((module) => [module.id, module]));
        const mergedModules = modulesToStore.map((module) => {
          const existing = existingById.get(module.id);
          if (!existing) return module;

          return {
            ...module,
            progress: existing.progress ?? module.progress,
            selected: existing.selected ?? module.selected,
            tags: existing.tags ?? module.tags,
            strictRAG: existing.strictRAG ?? module.strictRAG,
            createdAt: existing.createdAt ?? module.createdAt,
          };
        });

        if (scopedSubjectRows !== null) {
          const nextIds = new Set(mergedModules.map((module) => module.id));
          const staleModuleIds = (dbModules || [])
            .filter((module) => !nextIds.has(module.id))
            .map((module) => module.id);

          if (staleModuleIds.length > 0) {
            await db.modules.bulkDelete(staleModuleIds);
          }
        }

        await db.modules.bulkPut(mergedModules);
        localStorage.setItem('modules_scope_key', classroomScopeKey);
        await db.settings.put({ key: 'modules_scope_key', value: classroomScopeKey });
      }
    } catch (error) {
      console.error('Failed to fetch classroom curriculum:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModule = async (id: string) => {
    const module = await db.modules.get(id);
    if (module) {
      if (!module.selected && !isPro && selectedCount >= 3) {
        alert('Free plan is limited to 3 active modules. Please upgrade to Pro for unlimited modules!');
        navigate('/pricing');
        return;
      }
      await db.modules.update(id, { selected: !module.selected });
    }
  };

  const resetSelection = async () => {
    if (!dbModules) return;
    const updates = dbModules.map(m => ({ ...m, selected: false }));
    await db.modules.bulkPut(updates);
  };

  const filteredModules = modules.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Pomodoro state for right sidebar ---
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

  const selectedModules = modules.filter(m => m.selected);

  return (
    <Layout fullWidth>
      <SEO title={t('curriculum_classrooms_title') || 'Syllabus & Academic Classrooms'} />
      <div className="h-full w-full bg-background flex flex-col overflow-hidden p-4">
        {/* 3-Column Layout */}
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 overflow-hidden">
        
          {/* Column 1: Left Sidebar — Subject Overview */}
          <div className="hidden lg:flex lg:w-[220px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-5 gap-4">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-4">
              <div>
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider mb-3">Overview</p>
                <div className="space-y-2">
                  {[
                    { label: 'Total Subjects', value: modules.length, icon: <LayoutGrid size={14} /> },
                    { label: 'Active', value: selectedModules.length, icon: <Zap size={14} /> },
                    { label: 'With Lessons', value: Object.keys(lessonCountByModuleId).length, icon: <BookOpen size={14} /> },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-ink-muted">
                        {s.icon}
                        <span className="text-[11px] font-medium">{s.label}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-800 dark:text-ink">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedModules.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider mb-3">Active Classrooms</p>
                  <div className="space-y-2">
                    {selectedModules.slice(0, 5).map(m => (
                      <button
                        key={m.id}
                        onClick={() => navigate(`/classroom/${m.id}`)}
                        className="w-full flex items-center gap-2 p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5 hover:border-accent/30 transition-all text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                          <BookOpen size={12} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-ink truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider mb-3">Quick Actions</p>
                <div className="space-y-2">
                  <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-2 p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5 hover:border-accent/30 transition-all">
                    <TrendingUp size={13} className="text-accent" />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-ink">Dashboard</span>
                  </button>
                  <button onClick={() => navigate('/levelup')} className="w-full flex items-center gap-2 p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5 hover:border-accent/30 transition-all">
                    <Brain size={13} className="text-accent" />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-ink">LevelUp Hub</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Main Content */}
          <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 p-6">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6">
              {/* Page Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-5">
                <h1 className="ls-page-title text-slate-950 dark:text-ink">Classrooms</h1>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-ink-muted dark:hover:bg-white/5 dark:hover:text-ink transition-all">
                    <Filter className="w-3 h-3" />
                    Filter
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-ink-muted dark:hover:bg-white/5 dark:hover:text-ink transition-all">
                    <ArrowUpDown className="w-3 h-3" />
                    Sort
                  </button>
                </div>
              </div>






        {/* Modules Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-4 bg-white dark:bg-paper">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-[10px] font-mono text-slate-500 dark:text-ink-muted">Curating from trusted resources...</p>
              </div>
            ) : filteredModules.length > 0 ? (
              filteredModules.map((module, i) => (
                <motion.div
                  key={module.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05, duration: 0.6 }}
                  onClick={() => navigate(`/classroom/${module.id}`)}
                  className="bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col group hover:border-accent/30 hover:shadow-lg transition-all dark:bg-paper dark:border-white/8 shadow-sm"
                >
                  {/* Top Redesigned Teal Header Bar */}
                  <div className="bg-[#007A87] px-5 py-3.5 flex items-center justify-between text-white dark:bg-accent shrink-0">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 shrink-0 text-white" />
                      <h3 className="text-sm font-bold leading-tight truncate text-white max-w-[160px]">{module.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {module.category && module.category !== module.name && (
                        <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[90px]">{module.category}</span>
                      )}
                      {module.code && module.code !== module.name && (
                        <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[60px]">{module.code}</span>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Dynamic Illustration Banner */}
                  <div className="h-24 w-full overflow-hidden relative border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                    <img 
                      src={getLessonIllustration(module.name, module.category)}
                      alt={module.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col space-y-4">
                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm border-b border-slate-100 pb-4 dark:border-white/6 items-center">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400 dark:text-ink-muted" />
                        <span className="font-bold text-slate-800 dark:text-ink">{lessonCountByModuleId[module.id] ?? 0} Lessons</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                          <span className="text-slate-800 dark:text-ink">{module.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-mid">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${module.progress}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Last activity */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-ink-muted">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        Last Active: {lastActivityByModuleId[module.id] ? relativeTime(lastActivityByModuleId[module.id]) : 'No activity yet'}
                      </span>
                    </div>

                    {/* Footer: status + actions */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/classroom/${module.id}`); }}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                        >
                          <Play className="w-3 h-3 fill-current text-white" />
                          Start Lesson
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleModule(module.id); }}
                          className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                        >
                          View Plan
                        </button>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        module.selected ? 'text-accent' : 'text-emerald-700 dark:text-emerald-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${module.selected ? 'bg-accent' : 'bg-emerald-500 animate-pulse'}`} />
                        {module.selected ? 'Active' : 'Available'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-32 bg-white dark:bg-paper flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-serif">Your classroom is ready to be built.</h3>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500/40 dark:text-ink-muted/40 max-w-md mx-auto leading-relaxed">
                    Click 'Create' to load your curriculum from Supabase based on your {grade}{bacTrackName ? ` - ${bacTrackName}` : ''}{bacIntOptionName ? ` (${bacIntOptionName})` : ''} settings in {country}.
                  </p>
                </div>
                {!aiAvailable && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 max-w-sm dark:bg-amber-950/30 dark:border-amber-800/40">
                    <p className="text-xs text-amber-800 font-medium dark:text-amber-400">{aiUnavailableMsg}</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    const plan = getClassroomLoadPlan({ action: 'create_classroom', isPro });
                    fetchCurriculum(plan.includeAiSuggestions);
                  }}
                  className="px-10 py-4 bg-accent text-white rounded-full text-xs font-medium hover:bg-accent-hover transition-all  flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create My Classroom
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Selection Summary Bar */}
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-slate-950 text-white py-6 px-8 rounded-2xl shadow-md flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
              >
                <div className="flex items-center gap-8">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-mono text-white/40 mb-1">Current Selection</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-serif italic">{selectedCount}</span>
                      <span className="text-[10px] font-mono text-white/60">Modules Ready</span>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-white/10 hidden md:block"></div>
                  <button 
                    onClick={resetSelection}
                    className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                  >
                    Reset Selection
                  </button>
                </div>

                <div className="flex items-center gap-6">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/dashboard')}
                    className="bg-white text-slate-950 px-8 py-3 rounded-full text-xs font-mono uppercase tracking-[0.2em] font-bold flex items-center gap-3 hover:bg-accent hover:text-white transition-all duration-500 shadow-sm"
                  >
                    {t('dashboard_continue')}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Column 3: Right Sidebar — Focus & Tools */}
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

              {/* Study Tips */}
              <section className="space-y-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Study Tips</p>
                {[
                  { tip: 'Pick 2–3 subjects per day for deep work', icon: <Target size={12} /> },
                  { tip: 'Use the Pomodoro: 25 min focus, 5 min break', icon: <Timer size={12} /> },
                  { tip: 'Review yesterday\'s material before starting new', icon: <BookOpen size={12} /> },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5">
                    <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0 mt-0.5">{item.icon}</div>
                    <p className="text-[11px] text-slate-600 dark:text-ink-secondary leading-relaxed">{item.tip}</p>
                  </div>
                ))}
              </section>

              {/* Progress Summary */}
              <section className="space-y-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Progress</p>
                {modules.slice(0, 4).map(m => (
                  <div key={m.id} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="font-semibold text-slate-700 dark:text-ink truncate max-w-[140px]">{m.name}</span>
                      <span className="text-slate-400 dark:text-ink-muted">{m.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-surface-mid rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${m.progress}%` }} />
                    </div>
                  </div>
                ))}
              </section>

            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
};
