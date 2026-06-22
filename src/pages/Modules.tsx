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
  ArrowLeft,
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
  Rows3,
  TrendingUp,
  Zap,
  Shuffle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { HorizontalSlider } from '../components/HorizontalSlider';
import { generateCurriculum, checkAIProvider } from '../services/geminiService';
import { getClassroomLoadPlan, mapSubjectsToModules, mergeModulesWithAiSuggestions, shouldRequestAiCurriculumSuggestions } from '../services/classroomLoader';
import { getGradeCandidates, getSubjectCandidates, normalizeCurriculumValue } from '../services/curriculumMatching';
import { supabase } from '../db/supabase';
import { useSearch } from '../context/SearchContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { getCardGradient, randomBanner, randomCardGradient, CARD_GRADIENTS } from '../utils/cardColors';

// ⚡ Bolt: Stable fallback array to prevent cascading re-renders when useLiveQuery loads
const EMPTY_ARRAY: any[] = [];

const relativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const containsArabic = (value: string | null | undefined) =>
  /[\u0600-\u06FF]/.test(String(value || ''));

const getReadableSubjectLabel = (name: string | null | undefined, code?: string | null | undefined) => {
  const value = String(name || '').trim();
  const normalized = normalizeCurriculumValue(`${value} ${code || ''}`);

  if (normalized.includes('islam') || normalized.includes('التربية الاسلامية') || normalized.includes('التربيه الاسلاميه')) {
    return containsArabic(value) ? 'التربية الإسلامية' : 'Islamic Education';
  }
  if (normalized.includes('arab') || normalized.includes('العربية') || normalized.includes('اللغه العربيه')) {
    return containsArabic(value) ? 'اللغة العربية' : 'Arabic';
  }
  if (normalized === 'fr' || normalized.includes('francais') || normalized.includes('french')) {
    return 'French';
  }

  return value || 'General';
};

const getReadableCategoryLabel = (category: string | null | undefined, subjectLabel: string) => {
  const value = String(category || '').trim();
  if (!value || value === subjectLabel || value.length <= 3 || /^[A-Z0-9_]{2,}$/.test(value)) return 'General';
  return value;
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
  const allLessonsVal = useLiveQuery(() => db.lessons.toArray());
  const allLessons = allLessonsVal || EMPTY_ARRAY;

  const dbSettingsVal = useLiveQuery(() => db.settings.toArray());
  const dbSettings = dbSettingsVal || EMPTY_ARRAY;
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const country = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';
  const grade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || '';
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

  const completedLessonCountByModuleId = useMemo(
    () => allLessons.reduce<Record<string, number>>((acc, l) => {
      if (l.status !== 'done') return acc;

      const lessonGrade = String(l.grade || '').trim().toLocaleLowerCase();
      if (lessonGrade && !normalizedGradeCandidates.has(lessonGrade)) return acc;

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
          const { data } = await supabase.from('tracks').select('name').eq('id', selectedBacTrackId).single();
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
          const { data } = await supabase.from('instruction_options').select('name').eq('id', selectedBacIntOptionId).single();
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

  // Layout mode: grid or carousel
  const [layoutMode, setLayoutMode] = useState<'grid' | 'carousel'>('grid');
  // Per-module banner and color overrides (for bulk randomize)
  const [moduleBannerOverrides, setModuleBannerOverrides] = useState<Record<string, string>>({});
  const [moduleColorOverrides, setModuleColorOverrides] = useState<Record<string, string>>({});
  
  // Clean UI layout states
  const [showStats, setShowStats] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [sidebarCollapsedSections, setSidebarCollapsedSections] = useState<Record<string, boolean>>({
    pomodoro: false,
    studyTips: false,
    progress: false,
  });

  const toggleSidebarSection = (section: string) => {
    setSidebarCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCardExpansion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRandomizeAllBanners = () => {
    const bannerMap: Record<string, string> = {};
    const colorMap: Record<string, string> = {};
    filteredModules.forEach(m => {
      bannerMap[m.id] = randomBanner();
      colorMap[m.id] = randomCardGradient();
    });
    setModuleBannerOverrides(bannerMap);
    setModuleColorOverrides(colorMap);
  };

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
      <div className="min-h-full w-full bg-background flex flex-col overflow-visible p-3 sm:p-4 md:h-full md:overflow-hidden">
        {/* 3-Column Layout */}
        <div className="flex-1 min-h-0 w-full flex flex-col md:flex-row gap-3 overflow-visible md:overflow-hidden">
        
          {/* Column 2: Main Content */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 w-full overflow-visible bg-white dark:bg-paper rounded-xl shadow-lg border border-slate-200 dark:border-white/8 p-4 sm:p-6 md:overflow-hidden">
            <div className="flex-1 overflow-visible md:overflow-y-auto no-scrollbar flex flex-col gap-6">
              {/* Page Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-accent hover:text-white dark:bg-surface-low dark:hover:bg-accent text-slate-600 dark:text-ink-secondary transition-all shadow-sm shrink-0 cursor-pointer"
                    title="Back to Dashboard"
                  >
                    <ArrowLeft size={16} className="stroke-[2.5]" />
                  </button>
                  <h1 className="ls-page-title text-slate-950 dark:text-ink">Classrooms</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Layout Mode Toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-surface-low rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('grid')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        layoutMode === 'grid'
                          ? 'bg-white dark:bg-paper text-slate-800 dark:text-ink shadow-sm'
                          : 'text-slate-500 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink'
                      }`}
                      title="Grid view"
                    >
                      <LayoutGrid size={13} />
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode('carousel')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        layoutMode === 'carousel'
                          ? 'bg-white dark:bg-paper text-slate-800 dark:text-ink shadow-sm'
                          : 'text-slate-500 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink'
                      }`}
                      title="Carousel view"
                    >
                      <Rows3 size={13} />
                      Slide
                    </button>
                  </div>
                  {/* Toggle Global Stats Row */}
                  <button
                    type="button"
                    onClick={() => setShowStats(!showStats)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      showStats
                        ? 'bg-slate-900 text-white dark:bg-white/10 dark:text-white'
                        : 'bg-slate-100 dark:bg-surface-low text-slate-600 dark:text-ink-muted hover:bg-slate-200'
                    }`}
                    title="Toggle curriculum statistics overview"
                  >
                    {showStats ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showStats ? 'Hide Stats' : 'Show Stats'}
                  </button>
                  {/* Randomize All */}
                  <button
                    type="button"
                    onClick={handleRandomizeAllBanners}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-surface-low text-slate-600 dark:text-ink-muted hover:bg-slate-200 dark:hover:bg-surface-mid transition-all"
                    title="Randomize all module card images & colors"
                  >
                    <Shuffle size={13} />
                    Randomize
                  </button>
                </div>
              </div>

              <AnnouncementBanner bannerKey="classrooms_ad_cta" />

              {/* Symmetrical Stats Row - Collapsible */}
              <AnimatePresence>
                {showStats && (
                  <motion.section 
                    initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
                    exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mt-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: 'Total Subjects', value: modules.length, icon: <LayoutGrid size={16} /> },
                        { label: 'Active Classrooms', value: selectedModules.length, icon: <Zap size={16} /> },
                        { label: 'With Lessons', value: Object.keys(lessonCountByModuleId).length, icon: <BookOpen size={16} /> },
                      ].map((s, i) => (
                        <div key={i} className="bg-slate-50/50 dark:bg-surface-low/30 p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between shadow-sm hover:border-slate-200 dark:hover:border-white/10 transition-all cursor-default">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-surface-low flex items-center justify-center text-slate-400 dark:text-ink-muted shrink-0">
                              {s.icon}
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-normal">{s.label}</p>
                              <span className="text-lg font-bold text-slate-800 dark:text-ink">{s.value}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

        {/* Modules List */}
        {layoutMode === 'carousel' ? (
          // ---- CAROUSEL (Horizontal Slider) MODE ----
          <div className="mt-2">
            <AnimatePresence>
              {isLoading ? (
                <div className="py-32 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-[10px] font-mono text-slate-500 dark:text-ink-muted">Curating from trusted resources...</p>
                </div>
              ) : filteredModules.length > 0 ? (
                <HorizontalSlider>
                  {filteredModules.map((module, i) => (
                    <motion.div
                      key={module.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      onClick={() => navigate(`/classroom/${module.id}`)}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col group hover:border-accent/30 hover:shadow-lg transition-all dark:bg-paper dark:border-white/8 shadow-sm cursor-pointer"
                      style={{ width: '300px', minWidth: '300px' }}
                    >
                      <div className={`bg-gradient-to-r ${moduleColorOverrides[module.id] || getCardGradient(module.id)} px-5 py-3.5 flex items-center justify-between text-white shrink-0`}>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 shrink-0 text-white" />
                          <h3 className="text-sm font-bold leading-tight truncate text-white max-w-[160px]">{module.name}</h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {module.category && module.category !== module.name && (
                            <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[90px]">{module.category}</span>
                          )}
                        </div>
                      </div>
                      <div className="h-24 w-full overflow-hidden relative border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                        <img
                          src={moduleBannerOverrides[module.id] || getLessonIllustration(module.name, module.category)}
                          alt={module.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-75"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col space-y-3">
                        <AnimatePresence>
                          {expandedCards[module.id] && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden space-y-3"
                            >
                              <div className="flex items-center gap-2 text-xs">
                                <BookOpen className="w-4 h-4 text-slate-400" />
                                <span className="font-bold text-slate-800 dark:text-ink">{lessonCountByModuleId[module.id] ?? 0} Lessons</span>
                              </div>
                              <div className="space-y-1 pb-1">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                                  <span className="text-slate-800 dark:text-ink">{module.progress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-mid">
                                  <div className="h-full bg-slate-700 dark:bg-slate-400 rounded-full" style={{ width: `${module.progress}%` }} />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div className="flex items-center gap-2 mt-auto">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/classroom/${module.id}`); }}
                            className="flex-grow flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white hover:text-accent dark:bg-white/10 dark:text-ink dark:hover:text-accent px-3.5 py-2 text-xs font-bold transition-all shadow-sm"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Start
                          </button>
                          <button
                            onClick={(e) => toggleCardExpansion(module.id, e)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700 hover:text-accent transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:text-accent flex items-center justify-center"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expandedCards[module.id] ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </HorizontalSlider>
              ) : null}
            </AnimatePresence>
          </div>
        ) : (
          // ---- GRID MODE ----
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-4 bg-white dark:bg-paper">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-[10px] font-mono text-slate-500 dark:text-ink-muted">Curating from trusted resources...</p>
              </div>
            ) : filteredModules.length > 0 ? (
              filteredModules.map((module, i) => {
                const lessonCount = lessonCountByModuleId[module.id] ?? 0;
                const completedLessonCount = completedLessonCountByModuleId[module.id] ?? 0;
                const progress = lessonCount > 0 ? Math.round((completedLessonCount / lessonCount) * 100) : 0;
                const subjectLabel = getReadableSubjectLabel(module.name, module.code);
                const categoryLabel = getReadableCategoryLabel(module.category, subjectLabel);
                const isRTLSubject = containsArabic(subjectLabel);

                return (
                  <motion.div
                    key={module.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05, duration: 0.6 }}
                    onClick={() => navigate(`/classroom/${module.id}`)}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col group hover:border-accent/30 hover:shadow-lg transition-all dark:bg-paper dark:border-white/8 shadow-sm"
                  >
                    {/* Consistent illustration banner with compact title overlay */}
                    <div className="h-28 w-full overflow-hidden relative border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                      <img
                        src={getLessonIllustration(subjectLabel, module.category)}
                        alt={subjectLabel}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
                      <div dir={isRTLSubject ? 'rtl' : 'ltr'} className="absolute inset-x-0 bottom-0 p-4 text-white">
                        <div className={`flex items-center gap-2 ${isRTLSubject ? 'flex-row-reverse justify-end text-right' : ''}`}>
                          <BookOpen className="w-4 h-4 shrink-0 text-blue-200" />
                          <h3 className="text-sm font-bold leading-tight truncate">{subjectLabel}</h3>
                        </div>
                        <div className={`mt-2 flex flex-wrap items-center gap-1.5 ${isRTLSubject ? 'justify-end' : ''}`}>
                          <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[140px]">{categoryLabel}</span>
                          {bacTrackName && (
                            <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[150px]">{bacTrackName}</span>
                          )}
                          {bacIntOptionName && (
                            <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[130px]">{bacIntOptionName}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div dir="ltr" className="p-4 flex-1 flex flex-col gap-3">
                      {lessonCount === 0 ? (
                        <div>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-ink">
                            <BookOpen className="w-4 h-4 text-slate-400 dark:text-ink-muted shrink-0" />
                            <span>No lessons yet</span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-ink-muted">
                            This classroom is ready, but lessons are not assigned yet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-sm items-center">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-slate-400 dark:text-ink-muted shrink-0" />
                            <span className="font-bold text-slate-800 dark:text-ink">{lessonCount} Lessons</span>
                          </div>
                          {progress > 0 ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                                <span className="text-slate-800 dark:text-ink">{progress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-mid">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-right text-xs font-medium text-slate-500 dark:text-ink-muted">Not started</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-ink-muted">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          Last Active: {lastActivityByModuleId[module.id] ? relativeTime(lastActivityByModuleId[module.id]) : 'No activity yet'}
                        </span>
                      </div>

                      <div className="pt-3 mt-auto flex items-center gap-2 border-t border-slate-100 dark:border-white/6">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/classroom/${module.id}`); }}
                          className="h-9 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 text-xs font-bold text-white transition-colors shadow-sm"
                        >
                          <Play className="w-3 h-3 fill-current text-white" />
                          Open Classroom
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleModule(module.id); }}
                          className="h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 text-xs font-bold text-slate-700 transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                        >
                          Details
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expandedCards[module.id] ? 'rotate-180' : ''}`} />
                        </button>
                        {lessonCount === 0 && (
                          <span className="ms-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Empty
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
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
        )}
        {/* Selection Summary Bar */}
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-slate-950 text-white py-5 px-4 sm:px-8 rounded-2xl shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 md:gap-6 relative overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
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
                    className="w-full justify-center bg-white text-slate-950 px-6 sm:px-8 py-3 rounded-full text-xs font-mono uppercase tracking-normal font-bold flex items-center gap-3 hover:bg-accent hover:text-white transition-all duration-500 shadow-sm sm:w-auto"
                  >
                    {t('dashboard_continue')}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Column 3: Right Sidebar — Focus & Tools */}
          <div className="flex md:w-[234px] w-full shrink-0 md:h-full bg-white dark:bg-paper rounded-xl shadow-lg border border-slate-200 dark:border-white/8 overflow-visible md:overflow-hidden flex-col p-4 sm:p-5">
            <div className="flex-1 overflow-visible md:overflow-y-auto no-scrollbar flex flex-col gap-6 md:pr-1">

              {/* Deep Focus Pomodoro - Premium Calmer Box */}
              <section className="bg-slate-900 text-white rounded-2xl p-5 relative dark:bg-surface-low">
                <button 
                  type="button" 
                  onClick={() => toggleSidebarSection('pomodoro')} 
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-ink-muted outline-none"
                >
                  <span>Deep Focus</span>
                  {sidebarCollapsedSections.pomodoro ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
                
                <AnimatePresence initial={false}>
                  {!sidebarCollapsedSections.pomodoro && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <div className="text-3xl font-bold tracking-tight mb-3 text-white dark:text-ink">{formatTime(timerSeconds)}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsTimerRunning(!isTimerRunning)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            isTimerRunning ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          {isTimerRunning ? 'Pause' : 'Start Timer'}
                        </button>
                        <button
                          onClick={() => { setIsTimerRunning(false); setTimerSeconds(25 * 60); }}
                          className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all dark:bg-surface-mid"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Active Classrooms */}
              {selectedModules.length > 0 && (
                <section className="space-y-3">
                  <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Active Classrooms</p>
                  <div className="space-y-2">
                    {selectedModules.slice(0, 5).map(m => (
                      <button
                        key={m.id}
                        onClick={() => navigate(`/classroom/${m.id}`)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-surface-low transition-all group"
                      >
                        <div className="w-6 h-6 rounded bg-slate-100 dark:bg-surface-low flex items-center justify-center text-slate-500 shrink-0 transition-colors">
                          <BookOpen size={11} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-ink truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Study Tips - Borderless & Collapsible */}
              <section className="space-y-3">
                <button 
                  type="button" 
                  onClick={() => toggleSidebarSection('studyTips')}
                  className="w-full flex items-center justify-between text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider outline-none"
                >
                  <span>Study Tips</span>
                  {sidebarCollapsedSections.studyTips ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
                
                <AnimatePresence initial={false}>
                  {!sidebarCollapsedSections.studyTips && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-3"
                    >
                      {[
                        { tip: 'Pick 2–3 subjects per day for deep work', icon: <Target size={12} /> },
                        { tip: 'Use the Pomodoro: 25 min focus, 5 min break', icon: <Timer size={12} /> },
                        { tip: 'Review yesterday\'s material before starting new', icon: <BookOpen size={12} /> },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 py-1 text-slate-600 dark:text-ink-secondary">
                          <div className="text-slate-400 shrink-0 mt-0.5">{item.icon}</div>
                          <p className="text-[11px] leading-relaxed">{item.tip}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Progress Summary - Borderless & Collapsible */}
              <section className="space-y-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Progress</p>
                {modules.slice(0, 4).map(m => {
                  const lessonCount = lessonCountByModuleId[m.id] ?? 0;
                  const completedLessonCount = completedLessonCountByModuleId[m.id] ?? 0;
                  const progress = lessonCount > 0 ? Math.round((completedLessonCount / lessonCount) * 100) : 0;

                  return (
                    <div key={m.id} className="space-y-1">
                      <div className="flex justify-between gap-2 text-[10px]">
                        <span className="font-semibold text-slate-700 dark:text-ink truncate max-w-[140px]">{m.name}</span>
                        <span className="text-slate-400 dark:text-ink-muted shrink-0">
                          {lessonCount === 0 ? 'No lessons' : progress > 0 ? `${progress}%` : 'Not started'}
                        </span>
                      </div>
                      {lessonCount > 0 && progress > 0 && (
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-surface-mid rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>

            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
};
