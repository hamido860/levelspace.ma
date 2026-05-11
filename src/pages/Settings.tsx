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
  X,
  FlaskConical,
  BookOpen,
  Library,
  Brain,
  Check,
  ArrowRight,
  Languages,
  Target,
  Database as DatabaseIcon,
  Cloud,
  CloudOff,
  AlertCircle,
  Clock,
  Key,
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
import { getCustomApiKey, setCustomApiKey, getNvidiaApiKey, setNvidiaApiKey } from '../services/geminiService';

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

const CAREER_GOALS = [
  'Doctor',
  'Engineer',
  'Scientist',
  'Teacher',
  'Designer',
  'Entrepreneur',
  'Lawyer',
  'Still exploring',
] as const;

const TONE_OPTIONS = ['Encouraging', 'Calm', 'Direct', 'Coach-like'] as const;
const EXPLANATION_STYLES = ['Step by step', 'Simple', 'Exam-focused', 'Real-world'] as const;
const MOTIVATION_FOCUS_OPTIONS = ['Confidence', 'Career', 'Grades', 'Discipline'] as const;

const ACADEMIC_SETTING_KEYS = [
  'selected_country',
  'selected_grade',
  'selected_bac_section',
  'selected_bac_track',
  'selected_bac_int_option',
] as const;


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

  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('Grade 12');
  
  // Baccalaureate Options State
  const [bacSection, setBacSection] = useState("");
  const [bacTrack, setBacTrack] = useState("");
  const [bacIntOption, setBacIntOption] = useState("");

  const [dbBacSections, setDbBacSections] = useState<any[]>([]);
  const [dbBacTracks, setDbBacTracks] = useState<any[]>([]);
  const [dbBacIntOptions, setDbBacIntOptions] = useState<any[]>([]);
  const [dbBacTrackIntOptions, setDbBacTrackIntOptions] = useState<any[]>([]);

  const [careerGoal, setCareerGoal] = useState<string>('Still exploring');
  const [careerGoalCustom, setCareerGoalCustom] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [targetSkills, setTargetSkills] = useState<string[]>([]);
  const [hobbyInput, setHobbyInput] = useState('');
  const [targetSkillInput, setTargetSkillInput] = useState('');
  const [preferredTone, setPreferredTone] = useState<string>('Encouraging');
  const [preferredExplanationStyle, setPreferredExplanationStyle] = useState<string>('Step by step');
  const [motivationFocus, setMotivationFocus] = useState<string>('Confidence');
  const [currentSession, setCurrentSession] = useState<string>('Fall 2024');
  const [defaultDuration, setDefaultDuration] = useState<number>(60);
  
  const [isSaved, setIsSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [nvidiaKey, setNvidiaKey] = useState('');
  const [isNvidiaKeySaved, setIsNvidiaKeySaved] = useState(false);

  const languages = [
    { id: 'en', name: 'English', flag: '🇺🇸' },
    { id: 'fr', name: 'Français', flag: '🇫🇷' },
    { id: 'ar', name: 'العربية', flag: '🇲🇦' },
    { id: 'es', name: 'Español', flag: '🇪🇸' },
    { id: 'de', name: 'Deutsch', flag: '🇩🇪' },
  ];

  // Load settings from DB when they change
  useEffect(() => {
    const getStoredValue = (key: string) => localStorage.getItem(key) ?? settingsMap[key];

    const country = getStoredValue('selected_country');
    const grade = getStoredValue('selected_grade');
    const session = getStoredValue('current_session');
    const duration = getStoredValue('default_session_duration');
    const section = getStoredValue('selected_bac_section');
    const track = getStoredValue('selected_bac_track');
    const option = getStoredValue('selected_bac_int_option');
    const storedCareerGoal = getStoredValue('career_goal');
    const storedCareerGoalCustom = getStoredValue('career_goal_custom');
    const storedHobbies = getStoredValue('hobbies');
    const storedTargetSkills = getStoredValue('target_skills');
    const storedTone = getStoredValue('preferred_tone');
    const storedExplanationStyle = getStoredValue('preferred_explanation_style');
    const storedMotivationFocus = getStoredValue('motivation_focus');

    if (country) setSelectedCountry(String(country));
    if (grade) setSelectedGrade(String(grade));
    if (session) setCurrentSession(String(session));
    if (duration) setDefaultDuration(Number(duration));
    if (section) setBacSection(String(section));
    if (track) setBacTrack(String(track));
    if (option) setBacIntOption(String(option));
    if (storedCareerGoal) setCareerGoal(String(storedCareerGoal));
    if (storedCareerGoalCustom) setCareerGoalCustom(String(storedCareerGoalCustom));
    if (storedHobbies) setHobbies(parseStoredArray(storedHobbies));
    if (storedTargetSkills) setTargetSkills(parseStoredArray(storedTargetSkills));
    if (storedTone) setPreferredTone(String(storedTone));
    if (storedExplanationStyle) setPreferredExplanationStyle(String(storedExplanationStyle));
    if (storedMotivationFocus) setMotivationFocus(String(storedMotivationFocus));
  }, [settingsMap]);

  useEffect(() => {
    setApiKey(getCustomApiKey());
    setNvidiaKey(getNvidiaApiKey());
  }, []);

  const interests = [
    { id: 'interest_stem', label: t('stem'), icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'interest_humanities', label: t('humanities'), icon: <Globe className="w-4 h-4" /> },
    { id: 'interest_arts', label: t('arts'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'interest_languages', label: t('languages'), icon: <Library className="w-4 h-4" /> },
    { id: 'interest_tech', label: t('tech'), icon: <Brain className="w-4 h-4" /> },
  ];

  const goals = [
    { id: 'goal_exam_prep', label: t('exam_prep') },
    { id: 'goal_skill_dev', label: t('skill_dev') },
    { id: 'goal_general_learning', label: t('general_learning') },
    { id: 'goal_career_transition', label: t('career_transition') },
  ];

  const [dbCountries, setDbCountries] = useState<{code: string, name: string}[]>([]);
  const [dbGrades, setDbGrades] = useState<Record<string, string[]>>({});

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
        const { data: cyclesData } = await supabase.from('cycles').select('id, curriculum_id');
        const { data: gradesData } = await supabase.from('grades').select('id, cycle_id, name');
          
        if (cyclesData && gradesData) {
          curriculaData.forEach(curriculum => {
            const countryCycles = cyclesData.filter(c => c.curriculum_id === curriculum.id);
            const countryGrades = gradesData.filter(g => countryCycles.some(c => c.id === g.cycle_id));
            gradesMap[curriculum.country] = countryGrades.map(g => g.name);
          });
        }

        if (countries.length > 0) {
          setDbCountries(countries);
          setSelectedCountry(prev => prev || countries[0].code);
        }
        if (Object.keys(gradesMap).length > 0) setDbGrades(gradesMap);

        // Fetch Baccalaureate data
        const { data: sectionsData } = await supabase.from('bac_sections').select('*');
        if (sectionsData) setDbBacSections(sectionsData);
        
        const { data: tracksData } = await supabase.from('bac_tracks').select('*');
        if (tracksData) setDbBacTracks(tracksData);
        
        const { data: intOptionsData } = await supabase.from('bac_international_options').select('*');
        if (intOptionsData) setDbBacIntOptions(intOptionsData);
        
        const { data: trackIntOptionsData } = await supabase.from('bac_track_international_options').select('*');
        if (trackIntOptionsData) setDbBacTrackIntOptions(trackIntOptionsData);
      } catch (err) {
        console.error("Failed to fetch metadata", err);
      }
    };
    fetchMetadata();
  }, []);

  const availableCountries = dbCountries;
  const currentGrades = dbGrades[selectedCountry] || [];

  // Sync grade when country changes if current grade is not in the new system
  useEffect(() => {
    if (currentGrades && currentGrades.length > 0 && !currentGrades.includes(selectedGrade)) {
      setSelectedGrade(currentGrades[0]);
    }
  }, [selectedCountry, currentGrades, selectedGrade]);

  const filteredCountries = availableCountries.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentCountryName = availableCountries.find(c => c.code === selectedCountry)?.name || selectedCountry;
  const selectedSectionName = dbBacSections.find((section) => section.id === bacSection)?.name || '';
  const selectedTrackName = dbBacTracks.find((track) => track.id === bacTrack)?.name || '';
  const selectedOptionName = dbBacIntOptions.find((option) => option.id === bacIntOption)?.name || '';
  const lockedAcademicValues = useMemo(() => ({
    selected_country: String(settingsMap.selected_country || 'Morocco'),
    selected_grade: String(profile?.selected_grade || settingsMap.selected_grade || selectedGrade),
    selected_bac_section: String(settingsMap.selected_bac_section || ''),
    selected_bac_track: String(profile?.selected_bac_track || settingsMap.selected_bac_track || ''),
    selected_bac_int_option: String(settingsMap.selected_bac_int_option || ''),
  }), [
    profile?.selected_bac_track,
    profile?.selected_grade,
    selectedGrade,
    settingsMap.selected_bac_int_option,
    settingsMap.selected_bac_section,
    settingsMap.selected_bac_track,
    settingsMap.selected_country,
    settingsMap.selected_grade,
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
    setSelectedGrade(lockedAcademicValues.selected_grade);
    setBacSection(lockedAcademicValues.selected_bac_section);
    setBacTrack(lockedAcademicValues.selected_bac_track);
    setBacIntOption(lockedAcademicValues.selected_bac_int_option);

    for (const key of ACADEMIC_SETTING_KEYS) {
      localStorage.setItem(key, lockedAcademicValues[key]);
    }

    db.settings.bulkPut(ACADEMIC_SETTING_KEYS.map((key) => ({
      key,
      value: lockedAcademicValues[key],
    }))).catch((err) => {
      console.error('Failed to restore locked academic settings:', err);
    });
  }, [isAdmin, isLocked, lockedAcademicValues]);

  const handleSave = async () => {
    const academicValues = isLocked && !isAdmin
      ? lockedAcademicValues
      : {
        selected_country: selectedCountry,
        selected_grade: selectedGrade,
        selected_bac_section: bacSection,
        selected_bac_track: bacTrack,
        selected_bac_int_option: bacIntOption,
      };

    localStorage.setItem('selected_country', academicValues.selected_country);
    localStorage.setItem('selected_grade', academicValues.selected_grade);
    localStorage.setItem('current_session', currentSession);
    localStorage.setItem('default_session_duration', defaultDuration.toString());
    localStorage.setItem('selected_bac_section', academicValues.selected_bac_section);
    localStorage.setItem('selected_bac_track', academicValues.selected_bac_track);
    localStorage.setItem('selected_bac_int_option', academicValues.selected_bac_int_option);
    localStorage.setItem('career_goal', careerGoal);
    localStorage.setItem('career_goal_custom', careerGoalCustom);
    localStorage.setItem('hobbies', JSON.stringify(hobbies));
    localStorage.setItem('target_skills', JSON.stringify(targetSkills));
    localStorage.setItem('preferred_tone', preferredTone);
    localStorage.setItem('preferred_explanation_style', preferredExplanationStyle);
    localStorage.setItem('motivation_focus', motivationFocus);

    await db.settings.bulkPut([
      { key: 'selected_country', value: academicValues.selected_country },
      { key: 'selected_grade', value: academicValues.selected_grade },
      { key: 'current_session', value: currentSession },
      { key: 'default_session_duration', value: defaultDuration },
      { key: 'selected_bac_section', value: academicValues.selected_bac_section },
      { key: 'selected_bac_track', value: academicValues.selected_bac_track },
      { key: 'selected_bac_int_option', value: academicValues.selected_bac_int_option },
      { key: 'career_goal', value: careerGoal },
      { key: 'career_goal_custom', value: careerGoalCustom },
      { key: 'hobbies', value: hobbies },
      { key: 'target_skills', value: targetSkills },
      { key: 'preferred_tone', value: preferredTone },
      { key: 'preferred_explanation_style', value: preferredExplanationStyle },
      { key: 'motivation_focus', value: motivationFocus },
    ]);

    if (user && (!isLocked || isAdmin)) {
      try {
        await updateProfile(user.id, {
          selected_grade: academicValues.selected_grade,
          selected_bac_track: academicValues.selected_bac_track || null,
        });
      } catch (err: any) {
        console.error('Failed to save academic profile:', err.message);
      }
    }

    window.dispatchEvent(new Event('storage'));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const addToken = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    reset: () => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setter((prev) => {
      if (prev.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return [...prev, trimmed];
    });
    reset();
  };

  const removeToken = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => prev.filter((item) => item !== value));
  };

  const setupProgress = [
    { label: t('region'), completed: !!selectedCountry },
    { label: t('grade'), completed: !!selectedGrade },
    { label: 'Future goal', completed: !!careerGoal },
    { label: 'Target skills', completed: targetSkills.length > 0 },
  ].filter(s => s.completed).length;

  const progressPercentage = (setupProgress / 4) * 100;

  const handleSaveNvidiaKey = () => {
    setNvidiaApiKey(nvidiaKey.trim());
    setIsNvidiaKeySaved(true);
    setTimeout(() => setIsNvidiaKeySaved(false), 3000);
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      setCustomApiKey(apiKey.trim());
      setIsApiKeySaved(true);
      setTimeout(() => setIsApiKeySaved(false), 3000);
    } else {
      setCustomApiKey('');
      setApiKey('');
      setIsApiKeySaved(true);
      setTimeout(() => setIsApiKeySaved(false), 3000);
    }
  };

  return (
    <Layout>
      <SEO title="Settings" />
      <div className="max-w-4xl mx-auto space-y-12 py-8 px-4 pb-32">
        {/* Onboarding Header */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 text-accent"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em]">{t('profile_setup')}</span>
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl font-serif font-medium tracking-tight text-ink"
              >
                {t('personalize_space')}
              </motion.h1>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted/40">{t('setup_progress')}</span>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-32 h-1.5 bg-ink/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    className="h-full bg-accent"
                  />
                </div>
                <span className="text-xs font-bold text-ink">{Math.round(progressPercentage)}%</span>
              </div>
            </div>
          </div>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted text-lg max-w-2xl leading-relaxed"
          >
            {t('configure_context')}
          </motion.p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink/10">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'profile' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t('academic_path')}
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'preferences' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t('preferences')}
          </button>
        </div>

        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <section className="p-6 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/5 rounded-2xl flex items-center justify-center text-accent shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-medium text-ink">{t('academic_identity')}</h2>
                    <p className="text-xs text-muted leading-relaxed">
                      {t('academic_identity_desc')}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isLocked ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'}`}>
                  {isLocked ? t('locked_after_onboarding') : t('editable_for_setup')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl border border-ink/5 bg-surface-low space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('country')}</span>
                  <p className="text-sm font-semibold text-ink">{currentCountryName || t('not_set')}</p>
                </div>
                <div className="p-4 rounded-2xl border border-ink/5 bg-surface-low space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('grade')}</span>
                  <p className="text-sm font-semibold text-ink">{selectedGrade || t('not_set')}</p>
                </div>
                <div className="p-4 rounded-2xl border border-ink/5 bg-surface-low space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('track')}</span>
                  <p className="text-sm font-semibold text-ink">{selectedTrackName || selectedSectionName || t('not_set')}</p>
                  {selectedOptionName && <p className="text-[11px] text-muted">{selectedOptionName}</p>}
                </div>
              </div>

              {isLocked ? (
                <div className="p-4 bg-background border border-ink/10 rounded-2xl text-xs text-muted leading-relaxed">
                  {t('locked_academic_desc')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('country')}</label>
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
                              className="absolute z-50 left-0 right-0 mt-2 bg-paper border border-ink/10 rounded-2xl shadow-2xl overflow-hidden"
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
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('grade')}</label>
                      <div key={selectedCountry} className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {currentGrades.map((grade, index) => (
                          <button
                            key={`${grade}-${index}`}
                            onClick={() => setSelectedGrade(grade)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              selectedGrade === grade
                                ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20'
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

                  {selectedCountry === 'Morocco' && (selectedGrade.includes('Bac') || selectedGrade.includes('Tronc Commun')) && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('section')}</label>
                        <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                          {dbBacSections.map((section) => (
                            <button
                              key={section.id}
                              onClick={() => {
                                setBacSection(section.id);
                                setBacTrack('');
                                setBacIntOption('');
                              }}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                bacSection === section.id
                                  ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20'
                                  : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                              }`}
                            >
                              <span className="text-xs font-medium text-left pr-2">{section.name}</span>
                              {bacSection === section.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {bacSection && !selectedGrade.includes('Tronc Commun') && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('track')}</label>
                          <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                            {dbBacTracks.filter((track) => track.section_id === bacSection).map((track) => (
                              <button
                                key={track.id}
                                onClick={() => {
                                  setBacTrack(track.id);
                                  setBacIntOption('');
                                }}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                  bacTrack === track.id
                                    ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20'
                                    : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                                }`}
                              >
                                <span className="text-xs font-medium text-left pr-2">{track.name}</span>
                                {bacTrack === track.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {bacTrack && !selectedGrade.includes('Tronc Commun') && dbBacTrackIntOptions.some((item) => item.track_id === bacTrack) && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('international_option')}</label>
                          <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                            <button
                              onClick={() => setBacIntOption('')}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                bacIntOption === ''
                                  ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20'
                                  : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                              }`}
                            >
                              <span className="text-xs font-medium text-left pr-2">{t('none')}</span>
                              {bacIntOption === '' && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                            </button>
                            {dbBacTrackIntOptions
                              .filter((item) => item.track_id === bacTrack)
                              .map((item) => {
                                const option = dbBacIntOptions.find((match) => match.id === item.international_option_id);
                                if (!option) return null;
                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => setBacIntOption(option.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                      bacIntOption === option.id
                                        ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20'
                                        : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                                    }`}
                                  >
                                    <span className="text-xs font-medium text-left pr-2">{option.name}</span>
                                    {bacIntOption === option.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Target className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('future_goals')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('future_goals_desc')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('career_direction')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CAREER_GOALS.map((goal) => (
                      <button
                        key={goal}
                        onClick={() => setCareerGoal(goal)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          careerGoal === goal
                            ? 'bg-ink border-ink text-paper shadow-lg shadow-ink/20'
                            : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                        }`}
                      >
                        <span className="text-xs font-medium">{goal}</span>
                        {careerGoal === goal && <Check className="w-3.5 h-3.5 text-accent" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('custom_goal')}</label>
                  <input
                    type="text"
                    value={careerGoalCustom}
                    onChange={(e) => setCareerGoalCustom(e.target.value)}
                    placeholder={t('custom_goal_placeholder')}
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('hobbies_interests')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={hobbyInput}
                      onChange={(e) => setHobbyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToken(hobbyInput, setHobbies, () => setHobbyInput(''));
                        }
                      }}
                      placeholder={t('hobbies_placeholder')}
                      className="flex-1 p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20"
                    />
                    <button
                      onClick={() => addToken(hobbyInput, setHobbies, () => setHobbyInput(''))}
                      className="px-4 py-3 rounded-xl bg-ink text-paper text-[10px] font-bold uppercase tracking-widest"
                    >
                      {t('add')}
                    </button>
                  </div>
                  {hobbies.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {hobbies.map((item) => (
                        <button
                          key={item}
                          onClick={() => removeToken(item, setHobbies)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-accent/8 text-accent text-xs font-semibold"
                        >
                          {item}
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Brain className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('learning_style')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('learning_style_desc')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('target_skills')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetSkillInput}
                      onChange={(e) => setTargetSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToken(targetSkillInput, setTargetSkills, () => setTargetSkillInput(''));
                        }
                      }}
                      placeholder={t('target_skills_placeholder')}
                      className="flex-1 p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20"
                    />
                    <button
                      onClick={() => addToken(targetSkillInput, setTargetSkills, () => setTargetSkillInput(''))}
                      className="px-4 py-3 rounded-xl bg-ink text-paper text-[10px] font-bold uppercase tracking-widest"
                    >
                      {t('add')}
                    </button>
                  </div>
                  {targetSkills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {targetSkills.map((item) => (
                        <button
                          key={item}
                          onClick={() => removeToken(item, setTargetSkills)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-ink text-paper text-xs font-semibold"
                        >
                          {item}
                          <X className="w-3 h-3 text-accent" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('preferred_tone')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {TONE_OPTIONS.map((option) => (
                        <button
                          key={option}
                          onClick={() => setPreferredTone(option)}
                          className={`p-3 rounded-xl border text-xs font-medium transition-all ${
                            preferredTone === option
                              ? 'bg-accent border-accent text-paper'
                              : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('explanation_style')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {EXPLANATION_STYLES.map((option) => (
                        <button
                          key={option}
                          onClick={() => setPreferredExplanationStyle(option)}
                          className={`p-3 rounded-xl border text-xs font-medium transition-all ${
                            preferredExplanationStyle === option
                              ? 'bg-accent border-accent text-paper'
                              : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('motivation_focus')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {MOTIVATION_FOCUS_OPTIONS.map((option) => (
                        <button
                          key={option}
                          onClick={() => setMotivationFocus(option)}
                          className={`p-3 rounded-xl border text-xs font-medium transition-all ${
                            motivationFocus === option
                              ? 'bg-ink border-ink text-paper'
                              : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Cloud className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('cloud_and_data')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('cloud_and_data_desc')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
                <div className="p-4 bg-surface-low rounded-2xl border border-ink/5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-ink uppercase tracking-widest">{t('supabase_connection')}</p>
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
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-accent text-paper rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
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
            {/* Session Settings */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('session_settings')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('configure_study_defaults')}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('current_session')}</label>
                  <input 
                    type="text" 
                    value={currentSession}
                    onChange={(e) => setCurrentSession(e.target.value)}
                    placeholder={t('e_g_fall_2024')}
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('default_session_duration')}</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="15" 
                      max="180" 
                      step="15"
                      value={defaultDuration}
                      onChange={(e) => setDefaultDuration(Number(e.target.value))}
                      className="flex-grow accent-accent"
                    />
                    <span className="text-xs font-bold text-ink w-20 text-right">{defaultDuration} {t('minutes')}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* AI Provider API Key */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm flex flex-col">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Key className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('ai_provider_api_key')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('ai_provider_api_key_desc')}</p>
                </div>
              </div>

              <div className="space-y-4 flex-grow">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">AI_API_KEY</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy... or sk-... or nvapi-..."
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20 font-mono"
                  />
                </div>
                <div className="text-xs text-muted leading-relaxed space-y-1">
                  <p>{t('stored_locally')}</p>
                  <p className="text-[10px] font-mono text-muted/60">AI_PROVIDER · AI_API_KEY · AI_MODEL · AI_BASE_URL</p>
                </div>
              </div>

              <div className="pt-4 border-t border-ink/5 flex justify-end">
                <button
                  onClick={handleSaveApiKey}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                    isApiKeySaved ? 'bg-emerald-500 text-paper' : 'bg-ink text-paper hover:bg-accent'
                  }`}
                >
                  {isApiKeySaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {isApiKeySaved ? t('saved') : t('save_key')}
                </button>
              </div>
            </section>

            {/* NVIDIA NIM API Key — Admin AI Features */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm flex flex-col">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center text-success">
                  <Key className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('nvidia_api_key')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('nvidia_api_key_desc')}</p>
                </div>
              </div>

              <div className="space-y-4 flex-grow">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">NVIDIA_API_KEY</label>
                  <input
                    type="password"
                    value={nvidiaKey}
                    onChange={(e) => setNvidiaKey(e.target.value)}
                    placeholder="nvapi-..."
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20 font-mono"
                  />
                </div>
                <div className="text-xs text-muted leading-relaxed">
                  {t('nvidia_api_key_help')}
                </div>
              </div>

              <div className="pt-4 border-t border-ink/5 flex justify-end">
                <button
                  onClick={handleSaveNvidiaKey}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                    isNvidiaKeySaved ? 'bg-emerald-500 text-paper' : 'bg-ink text-paper hover:bg-accent'
                  }`}
                >
                  {isNvidiaKeySaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {isNvidiaKeySaved ? t('saved') : t('save_key')}
                </button>
              </div>
            </section>

            {/* Supabase Connection Status */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm flex flex-col md:col-span-2">
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
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
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
                      <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest">Variable 1</span>
                      <code className="block text-[10px] font-mono text-ink bg-ink/5 p-1.5 rounded">VITE_SUPABASE_URL</code>
                    </div>
                    <div className="p-3 bg-paper rounded-xl border border-ink/5 space-y-1">
                      <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest">Variable 2</span>
                      <code className="block text-[10px] font-mono text-ink bg-ink/5 p-1.5 rounded">VITE_SUPABASE_ANON_KEY</code>
                    </div>
                  </div>
                  <button 
                    onClick={refreshDbConnection}
                    className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
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

        {/* Action Bar */}
        <div className="sticky bottom-8 z-40">
          <div className="p-6 bg-ink text-paper rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl border border-paper/10">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-paper/40 mb-1">{t('status')}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSaved ? 'bg-emerald-400 animate-pulse' : 'bg-accent'}`} />
                  <span className="text-xs font-bold">{isSaved ? t('settings_saved') : t('pending_changes')}</span>
                </div>
              </div>
              {isSaved && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => navigate('/modules')}
                  className="flex items-center gap-2 text-accent text-[10px] font-bold uppercase tracking-widest hover:underline"
                >
                  {t('continue_to_classrooms')} <ArrowRight className="w-3 h-3" />
                </motion.button>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-paper/40 hover:text-paper transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSave}
                className={`px-10 py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-xl shadow-ink/20 flex items-center gap-3 ${
                  isSaved ? 'bg-emerald-500 text-paper' : 'bg-paper text-ink hover:bg-accent hover:text-paper'
                }`}
              >
                {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {isSaved ? t('profile_updated') : t('save_profile')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

