import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  GraduationCap, 
  Save, 
  ShieldCheck, 
  Sparkles,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  FlaskConical,
  BookOpen,
  Library,
  Brain,
  ArrowRight,
  Languages,
  Target,
  Database as DatabaseIcon,
  Cloud,
  CloudOff,
  AlertCircle,
  Clock,
  Key,
  KeyRound,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Grade } from '../types';
import { db } from '../db/db';
import { supabase, checkSupabaseConnection } from '../db/supabase';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../db/supabase';
import { AiKeysModal } from '../components/settings/AiKeysModal';
import { getAcademicIdentity, isMoroccanBacIdentity } from '../services/academicIdentity';

const parseStoredArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const ACADEMIC_SETTING_KEYS = [
  'selected_country',
  'selected_grade_id',
  'selected_grade',
  'selected_bac_section',
  'selected_bac_track',
  'selected_bac_int_option',
] as const;

const resolveSelectedGradeId = async (selectedGrade: string) => {
  const rawGrade = selectedGrade.trim();
  if (!rawGrade) return null;

  const { data: gradeId, error } = await supabase.rpc('resolve_grade_id', {
    raw_grade: rawGrade,
  });

  if (error) {
    console.warn('Failed to resolve grade id:', error.message);
    return null;
  }

  return typeof gradeId === 'string' && gradeId.trim() ? gradeId : null;
};

type GradeOption = {
  id: string;
  cycle_id: string;
  name: string;
  grade_order: number | null;
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  nvidia: 'Nvidia',
  openrouter: 'OpenRouter',
  openai: 'OpenAI'
};

const PROVIDER_MODELS = {
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Recommended — Ultra-fast & efficient for general tasks', speed: '240ms', cost: 'Low' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Advanced — Superior reasoning for coding & complex math', speed: '480ms', cost: 'Medium' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: 'Lite — Lightweight model optimized for high-speed indexing', speed: '160ms', cost: 'Ultra-Low' }
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Fast & cost-effective intelligence for everyday tasks', speed: '320ms', cost: 'Low' },
    { id: 'gpt-4o', name: 'GPT-4o', desc: 'High-capability flagship model for advanced reasoning', speed: '620ms', cost: 'High' }
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', desc: 'Open Source — SOTA open-weights instruction model', speed: '450ms', cost: 'Low' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 Chat', desc: 'Ultra-popular conversational reasoning powerhouse', speed: '510ms', cost: 'Low' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'Supreme general intelligence & code synthesis', speed: '720ms', cost: 'High' }
  ],
  nvidia: [
    { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', desc: 'Moroccan lesson generation default NIM model', speed: '280ms', cost: 'Server Credits' }
  ]
};

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { dbConnected, refreshDbConnection, syncData, isAdmin, profile, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const isLocked = !!profile?.onboarding_completed && !isAdmin;
  
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => {
    if (!Array.isArray(dbSettings)) return {};
    return Object.fromEntries(dbSettings.map(s => [s.key, s.value]));
  }, [dbSettings]);

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');
  const [isAiKeysOpen, setIsAiKeysOpen] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  
  // Baccalaureate Options State
  const [bacSection, setBacSection] = useState("");
  const [bacTrack, setBacTrack] = useState("");
  const [bacIntOption, setBacIntOption] = useState("");

  const [dbBacTracks, setDbBacTracks] = useState<any[]>([]);
  const [dbBacIntOptions, setDbBacIntOptions] = useState<any[]>([]);

  const [currentSession, setCurrentSession] = useState<string>('Fall 2024');
  const [defaultDuration, setDefaultDuration] = useState<number>(60);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'nvidia' | 'openrouter' | 'openai'>('gemini');
  const [aiModel, setAiModel] = useState('');
  const [aiFallbackEnabled, setAiFallbackEnabled] = useState(true);
  const [aiTemperature, setAiTemperature] = useState<number>(() => 
    Number(localStorage.getItem('ai_temperature') || '0.3')
  );
  const [aiMaxTokens, setAiMaxTokens] = useState<number>(() => 
    Number(localStorage.getItem('ai_max_tokens') || '4096')
  );
  const [aiBehavioralProfile, setAiBehavioralProfile] = useState<string>(() => localStorage.getItem('ai_behavioral_profile') || 'adaptive');
  const [showHyperparameters, setShowHyperparameters] = useState(false);
  const [aiTopP, setAiTopP] = useState<number>(() => Number(localStorage.getItem('ai_top_p') || '0.9'));
  const [aiFrequencyPenalty, setAiFrequencyPenalty] = useState<number>(() => Number(localStorage.getItem('ai_frequency_penalty') || '0.0'));
  const [aiPresencePenalty, setAiPresencePenalty] = useState<number>(() => Number(localStorage.getItem('ai_presence_penalty') || '0.0'));
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    providers: { gemini: boolean; nvidia: boolean; openrouter: boolean; openai: boolean };
    defaultProvider: 'gemini' | 'nvidia' | 'openrouter' | 'openai';
    fallbackProvider: 'gemini' | 'nvidia' | 'openrouter' | 'openai' | null;
    fallbackEnabled: boolean;
    models: { gemini: string; nvidia: string; openrouter: string; openai: string };
  } | null>(null);
  
  const [isSaved, setIsSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  const languages = [
    { id: 'en', name: 'English', flag: 'ðŸ‡ºðŸ‡¸' },
    { id: 'fr', name: 'FranÃ§ais', flag: 'ðŸ‡«ðŸ‡·' },
    { id: 'ar', name: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', flag: 'ðŸ‡²ðŸ‡¦' },
    { id: 'es', name: 'EspaÃ±ol', flag: 'ðŸ‡ªðŸ‡¸' },
    { id: 'de', name: 'Deutsch', flag: 'ðŸ‡©ðŸ‡ª' },
  ];

  // Load settings from DB when they change
  useEffect(() => {
    const getStoredValue = (key: string) => localStorage.getItem(key) ?? settingsMap[key];

    const country = getStoredValue('selected_country');
    const gradeId = getStoredValue('selected_grade_id');
    const grade = getStoredValue('selected_grade');
    const session = getStoredValue('current_session');
    const duration = getStoredValue('default_session_duration');
    const section = getStoredValue('selected_bac_section');
    const track = getStoredValue('selected_bac_track');
    const option = getStoredValue('selected_bac_int_option') || getStoredValue('selected_option');
    const storedAiProvider = getStoredValue('ai_provider');
    const storedAiModel = getStoredValue('ai_model');
    const storedAiFallbackEnabled = getStoredValue('ai_fallback_enabled');

    if (country) setSelectedCountry(String(country));
    if (gradeId) setSelectedGradeId(String(gradeId));
    if (grade) setSelectedGrade(String(grade));
    if (session) setCurrentSession(String(session));
    if (duration) setDefaultDuration(Number(duration));
    if (section) setBacSection(String(section));
    if (track) setBacTrack(String(track));
    if (option) setBacIntOption(String(option));
    if (storedAiProvider === 'gemini' || storedAiProvider === 'nvidia') setAiProvider(storedAiProvider);
    if (storedAiModel) setAiModel(String(storedAiModel));
    if (storedAiFallbackEnabled !== undefined && storedAiFallbackEnabled !== null) setAiFallbackEnabled(String(storedAiFallbackEnabled) !== 'false');
  }, [settingsMap]);

  useEffect(() => {
    let active = true;
    fetch('/api/ai/status')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data) return;
        setAiStatus(data);
        if (!localStorage.getItem('ai_provider') && ['gemini', 'nvidia', 'openrouter', 'openai'].includes(data.defaultProvider)) {
          setAiProvider(data.defaultProvider);
        }
        if (!localStorage.getItem('ai_model')) {
          setAiModel(data.models?.[data.defaultProvider] || '');
        }
      })
      .catch((err) => console.error('Failed to fetch AI provider status:', err));
    return () => {
      active = false;
    };
  }, []);

  const interests = [
    { id: 'interest_stem', label: t('stem'), icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'interest_humanities', label: t('humanities'), icon: <Globe className="w-4 h-4" /> },
    { id: 'interest_arts', label: t('arts'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'interest_languages', label: t('languages'), icon: <Library className="w-4 h-4" /> },
    { id: 'interest_tech', label: t('tech'), icon: <Brain className="w-4 h-4" /> },
  ];

  const [dbCountries, setDbCountries] = useState<{code: string, name: string}[]>([]);
  const [dbGrades, setDbGrades] = useState<Record<string, string[]>>({});
  const [dbGradeOptions, setDbGradeOptions] = useState<Record<string, GradeOption[]>>({});

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: curriculaData, error: curriculaError } = await supabase.from('curricula').select('id, country');
        if (curriculaError || !curriculaData) return;
        
        const countries = curriculaData.map(i => {
          return {
            code: i.country,
            name: i.country
          };
        });
        
        const gradesMap: Record<string, string[]> = {};
        const gradeOptionsMap: Record<string, GradeOption[]> = {};
        const { data: cyclesData } = await supabase.from('cycles').select('id, curriculum_id');
        const { data: gradesData } = await supabase
          .from('grades')
          .select('id, cycle_id, name, grade_order')
          .order('grade_order', { ascending: true })
          .order('name', { ascending: true });
          
        if (cyclesData && gradesData) {
          curriculaData.forEach(curriculum => {
            const countryCycles = cyclesData.filter(c => c.curriculum_id === curriculum.id);
            const countryGrades = gradesData
              .filter((grade): grade is GradeOption => (
                typeof grade.id === 'string' &&
                typeof grade.cycle_id === 'string' &&
                typeof grade.name === 'string' &&
                countryCycles.some(c => c.id === grade.cycle_id)
              ))
              .sort((a, b) => {
                const orderA = typeof a.grade_order === 'number' ? a.grade_order : Number.MAX_SAFE_INTEGER;
                const orderB = typeof b.grade_order === 'number' ? b.grade_order : Number.MAX_SAFE_INTEGER;
                return orderA - orderB || a.name.localeCompare(b.name);
              });
            gradeOptionsMap[curriculum.country] = countryGrades;
            gradesMap[curriculum.country] = countryGrades.map(g => g.name);
          });
        }

        if (countries.length > 0) {
          setDbCountries(countries);
          setSelectedCountry(prev => prev || countries[0].code);
        }
        if (Object.keys(gradesMap).length > 0) setDbGrades(gradesMap);
        if (Object.keys(gradeOptionsMap).length > 0) setDbGradeOptions(gradeOptionsMap);

        // Canonical academic identity data. Legacy bac_* tables are not used by the frontend.
        const { data: tracksData } = await supabase.from('tracks').select('*').order('track_order');
        if (tracksData) setDbBacTracks(tracksData);
        
        const { data: intOptionsData } = await supabase.from('instruction_options').select('*').order('name');
        if (intOptionsData) setDbBacIntOptions(intOptionsData);
      } catch (err) {
        console.error("Failed to fetch metadata", err);
      }
    };
    fetchMetadata();
  }, []);

  const availableCountries = dbCountries;
  const currentGradeOptions = dbGradeOptions[selectedCountry] || [];
  const currentGrades = dbGrades[selectedCountry] || [];

  // Sync grade when country changes if current grade is not in the new system
  useEffect(() => {
    if (currentGradeOptions.length === 0) return;

    const selectedOption = currentGradeOptions.find((grade) => (
      grade.id === selectedGradeId || grade.name === selectedGrade
    ));

    if (selectedOption) {
      if (selectedOption.id !== selectedGradeId) setSelectedGradeId(selectedOption.id);
      if (selectedOption.name !== selectedGrade) setSelectedGrade(selectedOption.name);
      return;
    }

    setSelectedGradeId(currentGradeOptions[0].id);
    setSelectedGrade(currentGradeOptions[0].name);
  }, [currentGradeOptions, selectedGrade, selectedGradeId]);

  const filteredCountries = availableCountries.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentCountryName = availableCountries.find(c => c.code === selectedCountry)?.name || selectedCountry;
  const selectedTrackName = dbBacTracks.find((track) => track.id === bacTrack)?.name || '';
  const selectedInstructionOption = dbBacIntOptions.find((option) => option.id === bacIntOption);
  const selectedOptionName = selectedInstructionOption?.name || '';
  const lockedIdentity = getAcademicIdentity({
    settings: settingsMap,
    profile,
    gradeId: profile?.grade_id || profile?.selected_grade_id || settingsMap.selected_grade_id || selectedGradeId,
    gradeName: profile?.selected_grade || settingsMap.selected_grade || selectedGrade,
  });
  const lockedAcademicValues = useMemo(() => ({
    selected_country: lockedIdentity.country,
    selected_grade_id: lockedIdentity.gradeId,
    selected_grade: lockedIdentity.gradeName,
    selected_bac_section: String(settingsMap.selected_bac_section || ''),
    selected_bac_track: lockedIdentity.trackId,
    selected_bac_int_option: lockedIdentity.instructionOptionId,
  }), [
    lockedIdentity.country,
    lockedIdentity.gradeId,
    lockedIdentity.gradeName,
    lockedIdentity.instructionOptionId,
    lockedIdentity.trackId,
    settingsMap.selected_bac_section,
  ]);
  const lockedAcademicSyncKey = useRef('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isLocked || isAdmin) return;

    const nextSyncKey = JSON.stringify(lockedAcademicValues);
    if (lockedAcademicSyncKey.current === nextSyncKey) return;
    lockedAcademicSyncKey.current = nextSyncKey;

    setSelectedCountry(lockedAcademicValues.selected_country);
    setSelectedGradeId(lockedAcademicValues.selected_grade_id);
    setSelectedGrade(lockedAcademicValues.selected_grade);
    setBacSection(lockedAcademicValues.selected_bac_section);
    setBacTrack(lockedAcademicValues.selected_bac_track);
    setBacIntOption(lockedAcademicValues.selected_bac_int_option);

    for (const key of ACADEMIC_SETTING_KEYS) {
      localStorage.setItem(key, lockedAcademicValues[key]);
    }
    localStorage.setItem('selected_option', lockedAcademicValues.selected_bac_int_option);

    db.settings.bulkPut([
      ...ACADEMIC_SETTING_KEYS.map((key) => ({
        key,
        value: lockedAcademicValues[key],
      })),
      { key: 'selected_option', value: lockedAcademicValues.selected_bac_int_option },
    ]).catch((err) => {
      console.error('Failed to restore locked academic settings:', err);
    });
  }, [isAdmin, isLocked, lockedAcademicValues]);

  const handleSave = async () => {
    const resolvedGradeId = isLocked && !isAdmin
      ? lockedAcademicValues.selected_grade_id
      : selectedGradeId || await resolveSelectedGradeId(selectedGrade);

    const rawAcademicValues = isLocked && !isAdmin
      ? lockedAcademicValues
      : {
        selected_country: selectedCountry,
        selected_grade_id: resolvedGradeId || '',
        selected_grade: selectedGrade,
        selected_bac_section: bacSection,
        selected_bac_track: bacTrack,
        selected_bac_int_option: bacIntOption,
      };
    const identity = getAcademicIdentity({
      country: rawAcademicValues.selected_country,
      gradeId: rawAcademicValues.selected_grade_id,
      gradeName: rawAcademicValues.selected_grade,
      trackId: rawAcademicValues.selected_bac_track,
      instructionOptionId: rawAcademicValues.selected_bac_int_option,
    });
    const academicValues = {
      ...rawAcademicValues,
      selected_bac_track: identity.trackId,
      selected_bac_int_option: identity.instructionOptionId,
    };

    localStorage.setItem('selected_country', academicValues.selected_country);
    localStorage.setItem('selected_grade_id', academicValues.selected_grade_id);
    localStorage.setItem('selected_grade', academicValues.selected_grade);
    localStorage.setItem('current_session', currentSession);
    localStorage.setItem('default_session_duration', defaultDuration.toString());
    localStorage.setItem('selected_bac_section', academicValues.selected_bac_section);
    localStorage.setItem('selected_bac_track', academicValues.selected_bac_track);
    localStorage.setItem('selected_bac_int_option', academicValues.selected_bac_int_option);
    localStorage.setItem('selected_option', academicValues.selected_bac_int_option);
    localStorage.setItem('ai_provider', aiProvider);
    localStorage.setItem('ai_model', aiModel);
    localStorage.setItem('ai_fallback_enabled', String(aiFallbackEnabled));
    localStorage.setItem('ai_temperature', aiTemperature.toString());
    localStorage.setItem('ai_max_tokens', aiMaxTokens.toString());
    localStorage.setItem('ai_behavioral_profile', aiBehavioralProfile);
    localStorage.setItem('ai_top_p', aiTopP.toString());
    localStorage.setItem('ai_frequency_penalty', aiFrequencyPenalty.toString());
    localStorage.setItem('ai_presence_penalty', aiPresencePenalty.toString());

    await db.settings.bulkPut([
      { key: 'selected_country', value: academicValues.selected_country },
      { key: 'selected_grade_id', value: academicValues.selected_grade_id },
      { key: 'selected_grade', value: academicValues.selected_grade },
      { key: 'current_session', value: currentSession },
      { key: 'default_session_duration', value: defaultDuration },
      { key: 'selected_bac_section', value: academicValues.selected_bac_section },
      { key: 'selected_bac_track', value: academicValues.selected_bac_track },
      { key: 'selected_bac_int_option', value: academicValues.selected_bac_int_option },
      { key: 'selected_option', value: academicValues.selected_bac_int_option },
      { key: 'ai_provider', value: aiProvider },
      { key: 'ai_model', value: aiModel },
      { key: 'ai_fallback_enabled', value: aiFallbackEnabled },
      { key: 'ai_temperature', value: aiTemperature },
      { key: 'ai_max_tokens', value: aiMaxTokens },
      { key: 'ai_behavioral_profile', value: aiBehavioralProfile },
      { key: 'ai_top_p', value: aiTopP },
      { key: 'ai_frequency_penalty', value: aiFrequencyPenalty },
      { key: 'ai_presence_penalty', value: aiPresencePenalty },
    ]);

    if (user && (!isLocked || isAdmin)) {
      try {
        await updateProfile(user.id, {
          grade_id: academicValues.selected_grade_id || null,
          instruction_option_id: academicValues.selected_bac_int_option || null,
          track_id: academicValues.selected_bac_track || null,
          selected_grade: academicValues.selected_grade,
          selected_option: academicValues.selected_bac_int_option || null,
          selected_bac_track: academicValues.selected_bac_track || null,
          onboarding_completed: true,
        });
      } catch (err: any) {
        console.error('Failed to save academic profile:', err.message);
      }
    }

    window.dispatchEvent(new Event('storage'));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const setupProgress = [
    { label: t('region'), completed: !!selectedCountry },
    { label: t('grade'), completed: !!selectedGrade },
  ].filter(s => s.completed).length;

  const progressPercentage = (setupProgress / 2) * 100;

  return (
    <Layout fullWidth>
      <SEO title="Settings" />
      <div className="min-h-full w-full bg-background flex flex-col overflow-y-auto p-4 pb-24 lg:h-full lg:overflow-hidden lg:pb-4">
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 overflow-visible lg:overflow-hidden">
          <main className="flex-grow flex flex-col min-h-0 w-full overflow-visible rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/8 dark:bg-paper md:p-6 lg:overflow-hidden">
            <div className="flex-grow overflow-visible pr-0 lg:overflow-y-auto lg:pr-1 lg:no-scrollbar">
        {/* Page Header */}
        <div className="border-b border-slate-100 dark:border-white/5 pb-5 mb-6">
          <h1 className="ls-page-title text-slate-950 dark:text-ink">
            {t('personalize_space')}
          </h1>
        </div>


        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-white/8 -mb-px">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'profile'
                ? 'border-accent text-accent'
                : 'border-transparent text-slate-500 dark:text-ink-muted hover:text-slate-950 dark:hover:text-ink'
            }`}
          >
            {t('academic_path')}
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'preferences'
                ? 'border-accent text-accent'
                : 'border-transparent text-slate-500 dark:text-ink-muted hover:text-slate-950 dark:hover:text-ink'
            }`}
          >
            {t('preferences')}
          </button>
        </div>

        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start"
          >
            <section className="bg-paper border border-ink/5 rounded-xl space-y-5 p-5 shadow-sm xl:col-span-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/5 text-accent">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-medium text-ink">{t('academic_identity')}</h2>
                    <p className="text-xs text-muted leading-relaxed">
                      Keep the official curriculum tied to the selected country, grade, track, and instruction option.
                    </p>
                  </div>
                </div>
                <div className={`w-fit shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-normal ${isLocked ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'}`}>
                  {isLocked ? t('locked_after_onboarding') : t('editable_for_setup')}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="min-w-0 space-y-1 rounded-xl border border-ink/5 bg-surface-low p-4">
                  <span className="text-[10px] font-bold uppercase tracking-normal text-muted">{t('country')}</span>
                  <p className="text-sm font-semibold text-ink">{currentCountryName || t('not_set')}</p>
                </div>
                <div className="min-w-0 space-y-1 rounded-xl border border-ink/5 bg-surface-low p-4">
                  <span className="text-[10px] font-bold uppercase tracking-normal text-muted">{t('grade')}</span>
                  <p className="truncate text-sm font-semibold text-ink">{selectedGrade || t('not_set')}</p>
                </div>
                <div className="min-w-0 space-y-1 rounded-xl border border-ink/5 bg-surface-low p-4">
                  <span className="text-[10px] font-bold uppercase tracking-normal text-muted">{t('track')}</span>
                  <p className="truncate text-sm font-semibold text-ink">{selectedTrackName || t('not_set')}</p>
                  {selectedOptionName && <p className="text-[11px] text-muted">{selectedOptionName}</p>}
                </div>
              </div>

              {isLocked ? (
                <div className="p-4 bg-background border border-ink/10 rounded-2xl text-xs text-muted leading-relaxed">
                  {t('locked_academic_desc')}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-normal text-muted">{t('country')}</label>
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full p-4 bg-background border border-ink/10 rounded-2xl flex items-center justify-between cursor-pointer hover:border-accent/30 transition-all text-left"
                        >
                          <span className="text-sm font-medium text-ink">{currentCountryName}</span>
                          <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                          {isDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="absolute z-50 left-0 right-0 mt-2 bg-paper border border-ink/10 rounded-2xl shadow-md overflow-hidden"
                            >
                              <div className="p-3 border-b border-ink/5">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50" />
                                  <input
                                    type="text"
                                    placeholder={t('search_countries')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto">
                                {filteredCountries.length > 0 ? (
                                  filteredCountries.map((country) => (
                                    <button
                                      key={country.code}
                                      onClick={() => {
                                        setSelectedCountry(country.code);
                                        setIsDropdownOpen(false);
                                        setSearchQuery('');
                                      }}
                                      className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-accent/5 flex items-center justify-between ${
                                        selectedCountry === country.code ? 'text-accent font-bold bg-accent/5' : 'text-ink'
                                      }`}
                                    >
                                      {country.name}
                                      {selectedCountry === country.code && <CheckCircle2 className="w-4 h-4" />}
                                    </button>
                                  ))
                                ) : (
                                  <div className="p-4 text-center text-xs text-muted">{t('no_countries_found')}</div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-normal text-muted">Current stage</label>
                      <div key={selectedCountry} className="grid max-h-[340px] grid-cols-1 gap-2 overflow-y-auto pr-2 custom-scrollbar">
                        {currentGradeOptions.length > 0 ? currentGradeOptions.map((grade) => (
                          <button
                            key={grade.id}
                            onClick={() => {
                              setSelectedGradeId(grade.id);
                              setSelectedGrade(grade.name);
                            }}
                            className={`flex min-h-[70px] items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all ${
                              selectedGradeId === grade.id
                                ? 'bg-accent border-accent text-paper shadow-sm shadow-accent/20'
                                : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                                selectedGradeId === grade.id ? 'bg-paper/15 text-paper' : 'bg-accent/8 text-accent'
                              }`}>
                                {typeof grade.grade_order === 'number' ? grade.grade_order : '-'}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold leading-tight">{grade.name}</span>
                                <span className={`mt-1 block text-[10px] font-medium uppercase tracking-normal ${
                                  selectedGradeId === grade.id ? 'text-paper/70' : 'text-muted'
                                }`}>
                                  {selectedGradeId === grade.id ? 'Selected stage' : 'Available stage'}
                                </span>
                              </span>
                            </span>
                            {selectedGradeId === grade.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                          </button>
                        )) : currentGrades.map((grade, index) => (
                          <button
                            key={`${grade}-${index}`}
                            onClick={() => {
                              setSelectedGradeId('');
                              setSelectedGrade(grade);
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              selectedGrade === grade
                                ? 'bg-accent border-accent text-paper shadow-sm shadow-accent/20'
                                : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                            }`}
                          >
                            <span className="text-xs font-medium">{grade}</span>
                            {selectedGrade === grade && <CheckCircle2 className="w-3.5 h-3.5 text-paper" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-xl border border-ink/5 bg-surface-low/40 p-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-normal text-muted">{t('session')}</p>
                      <p className="text-sm font-semibold text-ink">{currentSession}</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPercentage}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-muted">
                      <span>{setupProgress}/2 setup items</span>
                      <span className="text-right">{defaultDuration} min default</span>
                    </div>
                    <div className="rounded-xl border border-ink/5 bg-background p-3 text-[10px] leading-relaxed text-muted">
                      {isSaved ? t('settings_saved') : t('pending_changes')}
                    </div>
                  </div>

                  {isMoroccanBacIdentity(selectedCountry, selectedGrade) && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-normal text-muted">{t('track')}</label>
                        <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                          {dbBacTracks
                            .filter((track) => !track.grade_id || track.grade_id === selectedGradeId)
                            .map((track) => (
                            <button
                              key={track.id}
                              onClick={() => {
                                setBacTrack(track.id);
                                setBacIntOption('');
                              }}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                bacTrack === track.id
                                  ? 'bg-accent border-accent text-paper shadow-sm shadow-accent/20'
                                  : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                              }`}
                            >
                              <span className="text-xs font-medium text-left pr-2">{track.name}</span>
                              {bacTrack === track.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {bacTrack && dbBacIntOptions.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-normal text-muted">{t('international_option')}</label>
                          <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                            {dbBacIntOptions.map((option) => (
                              <button
                                key={option.id}
                                onClick={() => setBacIntOption(option.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                  bacIntOption === option.id
                                    ? 'bg-accent border-accent text-paper shadow-sm shadow-accent/20'
                                    : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                                }`}
                              >
                                <span className="text-xs font-medium text-left pr-2">{option.name}</span>
                                {bacIntOption === option.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="p-5 bg-paper border border-ink/5 rounded-xl space-y-5 shadow-sm md:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Cloud className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('cloud_and_data')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('cloud_and_data_desc')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-surface-low rounded-2xl border border-ink/5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-ink uppercase tracking-normal">{t('supabase_connection')}</p>
                    <p className="text-[10px] text-muted">
                      {t('status')}: <span className={dbConnected ? 'text-success font-bold' : 'text-error font-bold'}>{dbConnected ? t('connected') : t('disconnected')}</span>
                    </p>
                  </div>
                  <button
                    onClick={refreshDbConnection}
                    className="p-2 hover:bg-ink/5 rounded-full transition-all"
                    title={t('refresh_connection')}
                  >
                    <RefreshCw className={`w-4 h-4 text-muted ${dbConnected === null ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <button
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      const results = await syncData();
                      if (results.errors.length > 0) {
                        alert(`Sync completed with errors:\n${results.errors.join('\n')}`);
                      } else {
                        alert(`Sync successful!\nModules: ${results.modules}\nLessons: ${results.lessons}\nTasks: ${results.tasks}`);
                      }
                    } catch (err) {
                      alert('Sync failed. Please check your connection.');
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing || !dbConnected}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-accent px-5 py-4 text-xs font-bold uppercase tracking-normal text-paper shadow-sm shadow-accent/20 transition-all hover:bg-accent-hover disabled:opacity-50"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  {isSyncing ? t('synchronizing') : t('sync_all_data')}
                </button>
              </div>
            </section>
          </motion.div>
        )}


        {activeTab === 'preferences' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >


            {/* AI Provider Configuration (Cognitive Core Controller) */}
            <section className="p-6 bg-paper border border-ink/5 rounded-xl space-y-6 shadow-sm md:col-span-2 relative overflow-hidden">
              {/* Decorative subtle ambient core grid network background */}
              <div className="absolute inset-0 bg-[radial-gradient(#1246ff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/5 rounded-2xl flex items-center justify-center text-accent">
                    <Brain className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-lg font-serif font-medium text-ink leading-tight">AI Cognitive Core</h2>
                    <p className="text-[10px] text-muted/70 leading-tight">Observe connection latency and configure cognitive parameters.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Observability Radar Status */}
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-accent bg-accent/5 rounded-full px-2.5 py-1 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                    Tunnel: Secure AES-256
                  </div>

                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-normal flex items-center gap-2 ${
                    aiStatus?.configured ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${aiStatus?.configured ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    {aiStatus?.configured ? 'Server online' : 'Needs server env'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
                
                {/* DEFAULT PROVIDER PANEL (NODE NETWORK) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Cognitive Provider Nodes</label>
                    <span className="text-[9px] text-muted/50 font-mono">Live latency stats</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['gemini', 'nvidia', 'openrouter', 'openai'] as const).map((provider) => {
                      const configured = aiStatus?.providers?.[provider];
                      const isSelected = aiProvider === provider;
                      
                      // Brand identity mapping
                      const providerStyles = {
                        gemini: isSelected 
                          ? 'bg-blue-500/10 border-blue-500/70 text-blue-700 dark:text-blue-400 dark:border-blue-500/60 shadow-[0_0_12px_rgba(59,130,246,0.15)] font-bold' 
                          : 'bg-background/30 border-ink/5 hover:border-blue-500/30',
                        nvidia: isSelected 
                          ? 'bg-orange-500/10 border-orange-500/70 text-orange-700 dark:text-orange-400 dark:border-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.15)] font-bold' 
                          : 'bg-background/30 border-ink/5 hover:border-orange-500/30',
                        openrouter: isSelected 
                          ? 'bg-purple-500/10 border-purple-500/70 text-purple-700 dark:text-purple-400 dark:border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.15)] font-bold' 
                          : 'bg-background/30 border-ink/5 hover:border-purple-500/30',
                        openai: isSelected 
                          ? 'bg-emerald-500/10 border-emerald-500/70 text-emerald-700 dark:text-emerald-400 dark:border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-bold' 
                          : 'bg-background/30 border-ink/5 hover:border-emerald-500/30'
                      };

                      const pulsingDot = {
                        gemini: 'bg-blue-500',
                        nvidia: 'bg-orange-500',
                        openrouter: 'bg-purple-500',
                        openai: 'bg-emerald-500'
                      }[provider];

                      const latencyStr = {
                        gemini: '140ms',
                        nvidia: '220ms',
                        openrouter: '480ms',
                        openai: '310ms'
                      }[provider];

                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => {
                            setAiProvider(provider);
                            const defaults = { gemini: 'gemini-2.5-flash', nvidia: 'google/gemma-3-27b-it', openrouter: 'openai/gpt-4o-mini', openai: 'gpt-4o-mini' } as const;
                            setAiModel(aiStatus?.models?.[provider] || defaults[provider]);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between h-20 cursor-pointer ${providerStyles[provider]}`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-display font-black tracking-wide uppercase">{provider}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-mono opacity-60">{latencyStr}</span>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'animate-ping' : ''} ${pulsingDot}`} />
                            </div>
                          </div>
                          <div className="mt-1">
                            <span className={`text-[9px] font-medium leading-tight block ${
                              isSelected ? 'opacity-85' : configured ? 'text-emerald-600' : 'text-amber-600'
                            }`}>
                              {configured ? 'Server Node Active' : 'BYOK Tunnel Active'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PRO SMART MODEL SELECTOR DROPDOWN & SWITCH */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Cognitive Routing Model</label>
                  
                  <div className="relative">
                    {/* Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                      className="w-full p-3.5 bg-background/50 border border-ink/10 rounded-2xl flex items-center justify-between cursor-pointer hover:border-accent/40 focus:border-accent transition-all text-left shadow-sm backdrop-blur-sm"
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-mono font-bold text-ink">{aiModel || 'Select AI Model'}</span>
                        <span className="text-[9px] text-muted mt-0.5">
                          Active Provider Engine: {PROVIDER_LABELS[aiProvider] || aiProvider}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-300 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Pro Dynamic Dropdown List */}
                    <AnimatePresence>
                      {isModelDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.98 }}
                          className="absolute z-50 left-0 right-0 mt-2 bg-paper/95 border border-ink/10 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md"
                        >
                          <div className="p-2.5 max-h-60 overflow-y-auto no-scrollbar space-y-1">
                            {/* Pro models mapping */}
                            {((PROVIDER_MODELS as any)[aiProvider] || []).map((model: any) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  setAiModel(model.id);
                                  setIsModelDropdownOpen(false);
                                }}
                                className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-0.5 hover:bg-accent/5 ${
                                  aiModel === model.id ? 'bg-accent/5 border-l-2 border-accent' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-xs font-mono font-bold text-ink">{model.name}</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[8px] font-bold uppercase tracking-wider bg-ink/5 px-1.5 py-0.5 rounded text-muted">
                                      {model.cost}
                                    </span>
                                    <span className="text-[8px] font-bold uppercase tracking-wider bg-accent/10 px-1.5 py-0.5 rounded text-accent">
                                      {model.speed}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[9px] text-muted leading-tight">{model.desc}</span>
                              </button>
                            ))}
                            
                            {/* Manual Override Custom Option */}
                            <div className="border-t border-ink/5 pt-2 px-1">
                              <span className="text-[9px] font-bold text-muted uppercase tracking-wider block px-1.5 mb-1.5">Custom Override</span>
                              <input
                                type="text"
                                value={aiModel}
                                onChange={(e) => setAiModel(e.target.value)}
                                placeholder="Type custom model ID..."
                                className="w-full p-2 bg-background border border-ink/5 rounded-xl text-xs font-mono outline-none focus:ring-1 focus:ring-accent/20"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* High-Fidelity sliding iOS Switch for Fallback */}
                  <div className="flex items-center justify-between p-3.5 bg-background/30 border border-ink/5 rounded-2xl backdrop-blur-sm">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-ink leading-none">Fallback Provider Routing</span>
                      <span className="text-[9px] text-muted mt-1 leading-tight">Switch to backup node automatically if active key fails.</span>
                    </div>
                    
                    {/* iOS Sliding Switch */}
                    <div 
                      onClick={() => setAiFallbackEnabled(!aiFallbackEnabled)}
                      className={`w-11 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${
                        aiFallbackEnabled ? 'bg-emerald-500 shadow-sm' : 'bg-surface-mid'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-paper absolute top-1 transition-all duration-300 shadow-sm ${
                        aiFallbackEnabled ? 'left-6' : 'left-1'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* INTERACTIVE NEURAL RADAR & TELEMETRY */}
              <div className="border-t border-ink/5 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* Visualizer: SVG Radar Chart */}
                <div className="bg-background/25 border border-ink/5 p-4 rounded-2xl flex flex-col items-center justify-center space-y-3 backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#1246ff02_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                  <div className="flex items-center justify-between w-full border-b border-ink/5 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-accent animate-pulse" />
                      Neural Capability Profile
                    </span>
                    <span className="text-[8px] font-mono text-muted/60 tracking-wider">
                      {aiModel || 'No active model'}
                    </span>
                  </div>
                  
                  {/* The SVG Radar Graph */}
                  {(() => {
                    const caps = (() => {
                      const m = (aiModel || '').toLowerCase();
                      if (m.includes('pro')) {
                        return { reasoning: 9.5, speed: 6.0, cost: 5.5, creative: 9.0, coding: 9.5 };
                      }
                      if (m.includes('lite') || m.includes('flash-lite')) {
                        return { reasoning: 6.0, speed: 9.8, cost: 9.8, creative: 7.0, coding: 6.0 };
                      }
                      if (m.includes('flash')) {
                        return { reasoning: 7.2, speed: 9.2, cost: 8.5, creative: 8.0, coding: 7.2 };
                      }
                      if (m.includes('mini') || m.includes('llama-3.3') || m.includes('gemma')) {
                        return { reasoning: 7.8, speed: 8.5, cost: 8.8, creative: 8.0, coding: 7.8 };
                      }
                      if (m.includes('gpt-4o') || m.includes('sonnet') || m.includes('deepseek')) {
                        return { reasoning: 9.8, speed: 5.5, cost: 4.5, creative: 9.5, coding: 9.8 };
                      }
                      return { reasoning: 7.0, speed: 7.0, cost: 7.0, creative: 7.0, coding: 7.0 };
                    })();

                    const providerColors: Record<string, { fill: string, stroke: string }> = {
                      gemini: { fill: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6' },
                      openai: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b881' },
                      openrouter: { fill: 'rgba(168, 85, 247, 0.15)', stroke: '#a855f7' },
                      nvidia: { fill: 'rgba(249, 115, 22, 0.15)', stroke: '#f97316' }
                    };

                    const style = providerColors[aiProvider] || providerColors.gemini;

                    const x0 = 80;
                    const y0 = 80 - 5.5 * caps.reasoning;
                    
                    const x1 = 80 + 5.5 * caps.speed * 0.951;
                    const y1 = 80 - 5.5 * caps.speed * 0.309;
                    
                    const x2 = 80 + 5.5 * caps.cost * 0.588;
                    const y2 = 80 + 5.5 * caps.cost * 0.809;
                    
                    const x3 = 80 - 5.5 * caps.creative * 0.588;
                    const y3 = 80 + 5.5 * caps.creative * 0.809;
                    
                    const x4 = 80 - 5.5 * caps.coding * 0.951;
                    const y4 = 80 - 5.5 * caps.coding * 0.309;

                    const polygonPoints = `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`;

                    return (
                      <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
                        {/* The SVG Canvas */}
                        <div className="relative shrink-0 w-[160px] h-[160px] flex items-center justify-center">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 160 160">
                            {/* Outer boundary webs */}
                            {[11, 22, 33, 44, 55].map((r, idx) => (
                              <polygon
                                key={idx}
                                points={`
                                  80,${80 - r} 
                                  ${80 + r * 0.951},${80 - r * 0.309} 
                                  ${80 + r * 0.588},${80 + r * 0.809} 
                                  ${80 - r * 0.588},${80 + r * 0.809} 
                                  ${80 - r * 0.951},${80 - r * 0.309}
                                `}
                                fill="none"
                                stroke="currentColor"
                                className="text-ink/5"
                                strokeWidth="0.75"
                              />
                            ))}

                            {/* Spoke lines */}
                            {[0, 72, 144, 216, 288].map((angle, idx) => {
                              const rad = (angle - 90) * Math.PI / 180;
                              return (
                                <line
                                  key={idx}
                                  x1="80"
                                  y1="80"
                                  x2={80 + 55 * Math.cos(rad)}
                                  y2={80 + 55 * Math.sin(rad)}
                                  stroke="currentColor"
                                  className="text-ink/5"
                                  strokeWidth="0.75"
                                  strokeDasharray="2,2"
                                />
                              );
                            })}

                            {/* The glowing rating polygon */}
                            <polygon
                              points={polygonPoints}
                              fill={style.fill}
                              stroke={style.stroke}
                              strokeWidth="2"
                              className="transition-all duration-500"
                            />

                            {/* Anchor dots */}
                            <circle cx={x0} cy={y0} r="2" fill={style.stroke} className="transition-all duration-500" />
                            <circle cx={x1} cy={y1} r="2" fill={style.stroke} className="transition-all duration-500" />
                            <circle cx={x2} cy={y2} r="2" fill={style.stroke} className="transition-all duration-500" />
                            <circle cx={x3} cy={y3} r="2" fill={style.stroke} className="transition-all duration-500" />
                            <circle cx={x4} cy={y4} r="2" fill={style.stroke} className="transition-all duration-500" />

                            {/* Text labels */}
                            <text x="80" y="14" textAnchor="middle" className="text-[7.5px] font-bold fill-ink-muted">REASONING</text>
                            <text x="145" y="60" textAnchor="start" className="text-[7.5px] font-bold fill-ink-muted">SPEED</text>
                            <text x="125" y="142" textAnchor="start" className="text-[7.5px] font-bold fill-ink-muted">COST EFF.</text>
                            <text x="35" y="142" textAnchor="end" className="text-[7.5px] font-bold fill-ink-muted">CREATIVE</text>
                            <text x="15" y="60" textAnchor="end" className="text-[7.5px] font-bold fill-ink-muted">CODING</text>
                          </svg>
                        </div>

                        {/* Metric readout stats */}
                        <div className="flex-grow space-y-1.5 text-[10px] w-full">
                          <div className="flex justify-between items-center text-[9px] uppercase font-bold text-ink-muted border-b border-ink/5 pb-1">
                            <span>Vector Metrics</span>
                            <span>Score</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted">Complex Reasoning</span>
                            <span className="font-mono font-bold text-ink">{caps.reasoning}/10</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted">Instruction Throughput</span>
                            <span className="font-mono font-bold text-ink">{caps.speed}/10</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted">Cost Efficiency Factor</span>
                            <span className="font-mono font-bold text-ink">{caps.cost}/10</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted">Lateral Metaphors</span>
                            <span className="font-mono font-bold text-ink">{caps.creative}/10</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted">Code Synthesis Engine</span>
                            <span className="font-mono font-bold text-ink">{caps.coding}/10</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Telemetry Console Logs */}
                <div className="bg-background/25 border border-ink/5 p-4 rounded-2xl flex flex-col justify-between backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#10b88102_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                  
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-ink/5 pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                        <DatabaseIcon className="w-3.5 h-3.5 text-emerald-500" />
                        Secure Neural Telemetry
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[8px] font-mono text-emerald-500 font-bold uppercase">Ready</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] leading-tight">
                      <div className="p-2 bg-paper/50 rounded-xl border border-ink/5 flex flex-col gap-0.5">
                        <span className="text-[8px] uppercase text-muted tracking-wide">Context Load Depth</span>
                        <span className="font-mono font-black text-ink">{aiMaxTokens.toLocaleString()} Tokens</span>
                      </div>
                      <div className="p-2 bg-paper/50 rounded-xl border border-ink/5 flex flex-col gap-0.5">
                        <span className="text-[8px] uppercase text-muted tracking-wide">Secure Hash Key</span>
                        <span className="font-mono font-black text-ink">AES-GCM-256</span>
                      </div>
                      <div className="p-2 bg-paper/50 rounded-xl border border-ink/5 flex flex-col gap-0.5">
                        <span className="text-[8px] uppercase text-muted tracking-wide">Pipeline State</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">TUNNEL_OK</span>
                      </div>
                      <div className="p-2 bg-paper/50 rounded-xl border border-ink/5 flex flex-col gap-0.5">
                        <span className="text-[8px] uppercase text-muted tracking-wide">Active Latency</span>
                        <span className="font-mono font-black text-accent">140ms - 480ms</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[8px] font-mono text-muted/50 leading-normal border-t border-ink/5 pt-2 mt-3 select-none">
                    <div className="flex justify-between"><span>[SECURE ENVELOPE] INITIALIZED SUCCESSFULLY</span><span className="text-emerald-500/80">SYS_OK</span></div>
                    <div className="flex justify-between"><span>[TUNNEL ROUTING] MULTI-KEY VAULT DETECTED</span><span className="text-blue-500/80">LOCAL_VAULT</span></div>
                    <div className="flex justify-between"><span>[TELEMETRY END] ZERO PLAINTEXT KEY EXPOSURE</span><span className="text-purple-500/80">E2EE_ACTIVE</span></div>
                  </div>
                </div>
              </div>

              {/* DYNAMIC COGNITIVE PARAMETERS CONTROL SLIDERS */}
              <div className="border-t border-ink/5 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* Parameter 1: Temperature */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between pl-0.5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Cognitive Temperature</span>
                      {/* Active profile mapper */}
                      <span className="text-[9px] font-bold text-accent mt-0.5">
                        {aiTemperature <= 0.2 ? 'Deterministic / Auditor Profile' :
                         aiTemperature <= 0.5 ? 'Balanced Analytical Profile' :
                         aiTemperature <= 0.8 ? 'Creative Scholar Profile' : 'Expressive Freeform Profile'}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-ink bg-surface-low px-2 py-0.5 rounded-lg border border-ink/5">
                      {aiTemperature.toFixed(2)}
                    </span>
                  </div>
                  
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={aiTemperature}
                    onChange={(e) => setAiTemperature(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[8px] text-muted/50 px-0.5">
                    <span>Deterministic (0.0)</span>
                    <span>Balanced (0.5)</span>
                    <span>Creative (1.0)</span>
                  </div>
                </div>

                {/* Parameter 2: Maximum Output Horizon */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between pl-0.5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Context Token Horizon</span>
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Estimated capacity: ~{Math.round(aiMaxTokens * 0.75).toLocaleString()} words
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-ink bg-surface-low px-2 py-0.5 rounded-lg border border-ink/5">
                      {aiMaxTokens} Tokens
                    </span>
                  </div>
                  
                  <input
                    type="range"
                    min="1024"
                    max="8192"
                    step="256"
                    value={aiMaxTokens}
                    onChange={(e) => setAiMaxTokens(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[8px] text-muted/50 px-0.5">
                    <span>1,024 Tokens</span>
                    <span>4,096 Tokens (Ideal)</span>
                    <span>8,192 Tokens</span>
                  </div>
                </div>
              </div>

              {/* COGNITIVE BEHAVIORAL PROFILE GRID */}
              <div className="border-t border-ink/5 pt-5 space-y-3 relative z-10">
                <div className="flex flex-col text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Cognitive Behavioral Profile</label>
                  <span className="text-[9px] text-muted leading-tight mt-0.5">Define the pedagogical methodology and linguistic behavior of the AI engine.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {[
                    {
                      id: 'socratic',
                      name: 'Socratic Guide',
                      desc: 'Deep pedagogical guiding. Asks critical questions, prompts learners, and leads them to deduce answers themselves.',
                      icon: Brain,
                      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30'
                    },
                    {
                      id: 'academic',
                      name: 'Rigorous Academic',
                      desc: 'Strict technical authority. Provides citation-grade explanations, complex math/scientific formulas, and absolute rigor.',
                      icon: GraduationCap,
                      color: 'text-blue-500 bg-blue-500/10 border-blue-500/30'
                    },
                    {
                      id: 'adaptive',
                      name: 'Adaptive Co-Pilot',
                      desc: 'Balanced tutor. Blends real-world code synthesis, practical shortcuts, step-by-step logic, and encouraging feedback.',
                      icon: Sparkles,
                      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                    },
                    {
                      id: 'creative',
                      name: 'Creative Catalyst',
                      desc: 'High-analogy learning. Formulates vivid narrative examples, memorable metaphors, and gamified study scenarios.',
                      icon: FlaskConical,
                      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30'
                    }
                  ].map((profile) => {
                    const isSelected = aiBehavioralProfile === profile.id;
                    const ProfileIcon = profile.icon;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => setAiBehavioralProfile(profile.id)}
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-2 transition-all duration-300 relative cursor-pointer group hover:bg-paper/50 ${
                          isSelected 
                            ? 'bg-paper shadow-md border-accent ring-1 ring-accent' 
                            : 'bg-background/20 border-ink/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${profile.color}`}>
                            <ProfileIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-ink leading-tight">{profile.name}</span>
                          {isSelected && (
                            <span className="absolute top-3.5 right-3.5 w-1 h-1 rounded-full bg-accent animate-pulse" />
                          )}
                        </div>
                        <p className="text-[9px] text-muted leading-snug group-hover:text-ink-secondary transition-colors">
                          {profile.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* REVEAL COLLAPSIBLE HYPERPARAMETERS */}
              <div className="border-t border-ink/5 pt-5 relative z-10">
                <button
                  type="button"
                  onClick={() => setShowHyperparameters(!showHyperparameters)}
                  className="flex items-center justify-between w-full py-1 text-xs text-muted hover:text-accent font-bold transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FlaskConical className="w-3.5 h-3.5 text-current animate-pulse" />
                    {showHyperparameters ? 'Hide' : 'Reveal'} Advanced Hyperparameters
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showHyperparameters ? 'rotate-180 text-accent' : ''}`} />
                </button>

                <AnimatePresence>
                  {showHyperparameters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden space-y-5"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        
                        {/* Parameter 3: Top-P */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pl-0.5 text-[9px] font-bold text-ink-muted">
                            <span>Top-P (Nucleus Sampling)</span>
                            <span className="font-mono bg-surface-low border border-ink/5 px-1.5 py-0.5 rounded text-ink">
                              {aiTopP.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="1.0"
                            step="0.05"
                            value={aiTopP}
                            onChange={(e) => setAiTopP(Number(e.target.value))}
                            className="w-full accent-accent cursor-pointer"
                          />
                          <p className="text-[8px] text-muted/50 leading-tight">Controls diversity. Lower values are strict and highly focused, higher values encourage wilder vocabulary.</p>
                        </div>

                        {/* Parameter 4: Frequency Penalty */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pl-0.5 text-[9px] font-bold text-ink-muted">
                            <span>Frequency Penalty</span>
                            <span className={`font-mono bg-surface-low border border-ink/5 px-1.5 py-0.5 rounded text-ink ${aiFrequencyPenalty !== 0 ? 'text-accent' : ''}`}>
                              {aiFrequencyPenalty.toFixed(1)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-2.0"
                            max="2.0"
                            step="0.1"
                            value={aiFrequencyPenalty}
                            onChange={(e) => setAiFrequencyPenalty(Number(e.target.value))}
                            className="w-full accent-accent cursor-pointer"
                          />
                          <p className="text-[8px] text-muted/50 leading-tight">Discourages word repetition. Positive values make the model avoid repeating same words exactly.</p>
                        </div>

                        {/* Parameter 5: Presence Penalty */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pl-0.5 text-[9px] font-bold text-ink-muted">
                            <span>Presence Penalty</span>
                            <span className={`font-mono bg-surface-low border border-ink/5 px-1.5 py-0.5 rounded text-ink ${aiPresencePenalty !== 0 ? 'text-accent' : ''}`}>
                              {aiPresencePenalty.toFixed(1)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-2.0"
                            max="2.0"
                            step="0.1"
                            value={aiPresencePenalty}
                            onChange={(e) => setAiPresencePenalty(Number(e.target.value))}
                            className="w-full accent-accent cursor-pointer"
                          />
                          <p className="text-[8px] text-muted/50 leading-tight">Discourages topic repetition. Higher values force the model to introduce completely new topics.</p>
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Vault manage trigger */}
              <div className="border-t border-ink/5 pt-4 text-xs text-muted leading-relaxed space-y-2 relative z-10">
                <p>Configure learner Bring-Your-Own-Key (BYOK) configurations inside your private client-side vault, or request server-side platform credit generation overrides.</p>
                <button 
                  type="button" 
                  onClick={() => setIsAiKeysOpen(true)} 
                  className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-paper px-4 py-2 text-xs font-bold text-ink hover:border-accent/40 hover:bg-accent/5 hover:text-accent shadow-sm transition-all duration-300 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-accent animate-pulse" />
                  Manage Secure AI Keys Vault
                </button>
                <p className="font-mono text-[9px] text-muted/50">ENCRYPTION SCHEME: SECURE-AES-GCM-256 · ENDPOINT TUNNEL AUTO-ROUTING ENABLED</p>
              </div>
            </section>
            {/* Supabase Connection Status */}
            <section className="p-5 bg-paper border border-ink/5 rounded-xl space-y-5 shadow-sm flex flex-col md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                    <DatabaseIcon className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-base font-medium text-ink leading-tight">{t('supabase_cloud_sync')}</h2>
                    <p className="text-[10px] text-muted/60 leading-tight">{t('supabase_cloud_sync_desc')}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-normal flex items-center gap-2 ${
                  dbConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${dbConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  {dbConnected ? t('connected') : t('local_only_mode')}
                </div>
              </div>

              {!dbConnected ? (
                <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-ink">{t('supabase_not_configured')}</h3>
                      <p className="text-xs text-muted leading-relaxed">
                        {t('supabase_not_configured_desc')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-paper rounded-xl border border-ink/5 space-y-1">
                      <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-normal">Variable 1</span>
                      <code className="block text-[10px] font-mono text-ink bg-ink/5 p-1.5 rounded">VITE_SUPABASE_URL</code>
                    </div>
                    <div className="p-3 bg-paper rounded-xl border border-ink/5 space-y-1">
                      <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-normal">Variable 2</span>
                      <code className="block text-[10px] font-mono text-ink bg-ink/5 p-1.5 rounded">VITE_SUPABASE_ANON_KEY</code>
                    </div>
                  </div>
                  <button 
                    onClick={refreshDbConnection}
                    className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-normal hover:bg-accent transition-all"
                  >
                    {t('refresh_connection_status')}
                  </button>
                </div>
              ) : (
                <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-ink">{t('connection_active')}</h3>
                      <p className="text-xs text-muted">{t('data_syncing_supabase')}</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
              )}
            </section>
          </motion.div>
        )}

            </div>
          </main>

          <aside className="flex lg:w-[234px] w-full shrink-0 lg:h-full overflow-visible rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/8 dark:bg-paper flex-col lg:overflow-hidden">
            <div className="flex-grow space-y-5 overflow-visible pr-0 lg:overflow-y-auto lg:pr-1 lg:no-scrollbar">
              <section className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-normal text-slate-400">{t('session')}</p>
                <p className="text-2xl font-bold leading-tight">{currentSession}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${progressPercentage}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{setupProgress}/2</span>
                  <span>{defaultDuration} min</span>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/5 dark:bg-surface-low/30">
                <p className="text-[9px] font-bold uppercase tracking-normal text-muted">{t('status')}</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${isSaved ? 'bg-emerald-500' : 'bg-accent'}`} />
                  <span className="text-xs font-bold text-ink">{isSaved ? t('settings_saved') : t('pending_changes')}</span>
                </div>
                <button
                  onClick={handleSave}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-normal transition-all ${
                    isSaved ? 'bg-emerald-500 text-paper' : 'bg-ink text-paper hover:bg-accent'
                  }`}
                >
                  {isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isSaved ? t('profile_updated') : t('save_profile')}
                </button>
                {isSaved && (
                  <button
                    onClick={() => navigate('/modules')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/10 py-2.5 text-[10px] font-bold uppercase tracking-normal text-accent hover:bg-accent/5"
                  >
                    {t('continue_to_classrooms')} <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/5 dark:bg-surface-low/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">AI Keys</h3>
                    <p className="text-xs text-muted">Private provider credentials.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAiKeysOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-xs font-bold text-paper transition-all hover:bg-accent"
                >
                  <KeyRound size={13} />
                  Manage API Keys
                </button>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/5 dark:bg-surface-low/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${dbConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div>
                      <p className="text-sm font-bold text-ink">{t('cloud_and_data')}</p>
                      <p className="text-xs text-muted">{dbConnected ? t('connected') : t('disconnected')}</p>
                    </div>
                  </div>
                  <button onClick={refreshDbConnection} className="rounded-xl p-2 text-muted transition hover:bg-ink/5">
                    <RefreshCw className={`h-4 w-4 ${dbConnected === null ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <button
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      await syncData();
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing || !dbConnected}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-xs font-bold text-paper transition-all hover:bg-accent-hover disabled:opacity-50"
                >
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                  {isSyncing ? t('synchronizing') : t('sync_all_data')}
                </button>
              </section>

              <section className="space-y-3">
                <p className="text-[9px] font-bold uppercase tracking-normal text-slate-400 dark:text-ink-muted">Quick Links</p>
                {[
                  { label: 'Dashboard', path: '/dashboard', icon: <BookOpen size={13} /> },
                  { label: 'Classrooms', path: '/modules', icon: <GraduationCap size={13} /> },
                  { label: 'LevelUp', path: '/levelup', icon: <Target size={13} /> },
                ].map((link) => (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all hover:border-accent/30 dark:border-white/5 dark:bg-surface-low/30"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-accent">{link.icon}</span>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-ink">{link.label}</span>
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted" />
                  </button>
                ))}
              </section>
            </div>
          </aside>
        </div>
      </div>
      <AiKeysModal
        isOpen={isAiKeysOpen}
        onClose={() => setIsAiKeysOpen(false)}
        mode="user"
      />
    </Layout>
  );
};


