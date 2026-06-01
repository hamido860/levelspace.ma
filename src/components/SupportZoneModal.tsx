import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Brain, Target, Compass, CheckCircle, AlertCircle, Loader2, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  generateAssessmentQuestion,
  evaluateAssessmentAnswer,
  generateAssessmentInsights,
  AssessmentQuestion,
  SKILL_MAPS,
  SUPPORTED_SUBJECTS,
} from '../services/geminiService';

interface SupportZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject?: string;
  grade?: string;
}

type Phase = 'subject-select' | 'self-rating' | 'assessment' | 'results';
type SelfRating = 'A' | 'B' | 'C' | 'D';
type Difficulty = 'low' | 'medium' | 'high';

interface AnswerRecord {
  question: AssessmentQuestion;
  userAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
}

// IRT-lite ability score bounds
const ABILITY_START: Record<SelfRating, number> = { A: 80, B: 60, C: 38, D: 18 };

// Weighted points per difficulty
const POINTS: Record<Difficulty, number> = { low: 1, medium: 2, high: 3 };
const MAX_POINTS_PER_Q = 2; // baseline for normalization

const MAX_QUESTIONS = 20;

function abilityToDifficulty(ability: number): Difficulty {
  if (ability >= 68) return 'high';
  if (ability >= 38) return 'medium';
  return 'low';
}

const SUBJECT_ICONS: Record<string, string> = {
  Mathematics: '📐',
  Physics: '⚡',
  French: '🇫🇷',
  Arabic: '📖',
  Science: '🔬',
  History: '🌍',
  English: '🇬🇧',
};

const RATING_OPTIONS = [
  { id: 'A' as SelfRating, label: 'Very confident', desc: 'I find it easy and rarely need help.', color: 'border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30', badge: 'bg-emerald-500' },
  { id: 'B' as SelfRating, label: 'Good, but I make some mistakes', desc: 'I understand most of it but need practice.', color: 'border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30', badge: 'bg-blue-500' },
  { id: 'C' as SelfRating, label: 'I understand some things but need help', desc: 'I often get stuck and need guidance.', color: 'border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30', badge: 'bg-amber-500' },
  { id: 'D' as SelfRating, label: 'I have difficulty and need step-by-step support', desc: 'I struggle with the basics.', color: 'border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30', badge: 'bg-rose-500' },
];

export const SupportZoneModal: React.FC<SupportZoneModalProps> = ({
  isOpen,
  onClose,
  subject: defaultSubject,
  grade = 'Grade 9',
}) => {
  const { profile } = useAuth();
  const effectiveGrade = profile?.grade || grade;

  const [phase, setPhase] = useState<Phase>('subject-select');
  const [selectedSubject, setSelectedSubject] = useState<string>(defaultSubject || 'Mathematics');
  const [rating, setRating] = useState<SelfRating | null>(null);

  // Adaptive engine state
  const [ability, setAbility] = useState(50);
  const abilityRef = useRef(50);
  const [coveredSkills, setCoveredSkills] = useState<string[]>([]);
  const coveredSkillsRef = useRef<string[]>([]);
  const questionCountRef = useRef(0);
  const usedQuestionTextsRef = useRef<Set<string>>(new Set());

  // Assessment state
  const [currentQuestion, setCurrentQuestion] = useState<AssessmentQuestion | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionError, setQuestionError] = useState(false); // AI failed even with fallback
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; text: string } | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);

  // Results state
  const [insights, setInsights] = useState<string[]>([]);
  const [roadmap, setRoadmap] = useState<{
    daily_practice: string;
    focus_skills: string[];
    week_1: string[];
    week_2: string[];
    goal: string;
  } | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [derivedLevel, setDerivedLevel] = useState('');

  const resetState = () => {
    setPhase('subject-select');
    setRating(null);
    setAbility(50);
    abilityRef.current = 50;
    setCoveredSkills([]);
    coveredSkillsRef.current = [];
    questionCountRef.current = 0;
    usedQuestionTextsRef.current = new Set();
    setCurrentQuestion(null);
    setQuestionCount(0);
    setAnswers([]);
    setUserAnswer('');
    setFeedback(null);
    setQuestionError(false);
    setInsights([]);
    setRoadmap(null);
    setFinalScore(0);
    setTotalPoints(0);
  };

  useEffect(() => {
    if (isOpen) resetState();
  }, [isOpen]);

  // Pick the next uncovered skill from the subject skill map
  const pickNextSkill = (covered: string[]): { skill: string; resetCovered: boolean } => {
    const skills = SKILL_MAPS[selectedSubject] || SKILL_MAPS['Mathematics'];
    const uncovered = skills.filter(s => !covered.includes(s));
    if (uncovered.length === 0) {
      // All skills covered — cycle from beginning, meaning we need to reset 'covered'
      const randomSkill = skills[Math.floor(Math.random() * skills.length)];
      return { skill: randomSkill, resetCovered: true };
    }
    // Pick randomly from uncovered
    const randomSkill = uncovered[Math.floor(Math.random() * uncovered.length)];
    return { skill: randomSkill, resetCovered: false };
  };

  const handleSelectSubject = (sub: string) => {
    setSelectedSubject(sub);
  };

  const handleStartRating = () => setPhase('self-rating');

  const handleSelectRating = async (selected: SelfRating) => {
    setRating(selected);
    const startAbility = ABILITY_START[selected];
    setAbility(startAbility);
    abilityRef.current = startAbility;
    setPhase('assessment');
    await loadNextQuestion(selected, startAbility);
  };

  const loadNextQuestion = useCallback(async (
    currentRating: SelfRating,
    currentAbility: number
  ) => {
    setIsGenerating(true);
    setFeedback(null);
    setUserAnswer('');
    setQuestionError(false);

    // Read from refs to avoid stale closure
    let covered = coveredSkillsRef.current;
    const difficulty = abilityToDifficulty(currentAbility);
    const { skill, resetCovered } = pickNextSkill(covered);
    
    if (resetCovered) {
      covered = [];
    }

    const q = await generateAssessmentQuestion(
      selectedSubject,
      effectiveGrade,
      skill,
      difficulty,
      covered,
      currentRating,
      usedQuestionTextsRef.current
    );

    if (q) {
      // Register question text to avoid future duplicates
      usedQuestionTextsRef.current.add(q.questionText);
      setCurrentQuestion(q);
      const newCount = questionCountRef.current + 1;
      questionCountRef.current = newCount;
      setQuestionCount(newCount);
      // Update covered skills ref + state
      coveredSkillsRef.current = [...covered, skill];
      setCoveredSkills(coveredSkillsRef.current);
      setQuestionError(false);
    } else {
      // This should be very rare — fallback bank also failed
      setQuestionError(true);
    }
    setIsGenerating(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, effectiveGrade]);

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !userAnswer.trim() || isEvaluating) return;

    setIsEvaluating(true);
    const result = await evaluateAssessmentAnswer(currentQuestion, userAnswer);

    const diff: Difficulty = currentQuestion.difficulty as Difficulty || abilityToDifficulty(abilityRef.current);
    const points = result.isCorrect ? POINTS[diff] : 0;
    setTotalPoints(prev => prev + points);

    // Update IRT-lite ability
    let newAbility = abilityRef.current;
    if (result.isCorrect) {
      newAbility = Math.min(100, newAbility + 10 * (1 - newAbility / 100));
    } else {
      newAbility = Math.max(0, newAbility - 8 * (newAbility / 100));
    }
    abilityRef.current = newAbility;
    setAbility(newAbility);

    setFeedback({ isCorrect: result.isCorrect, text: result.feedback });

    const newAnswer: AnswerRecord = {
      question: currentQuestion,
      userAnswer,
      isCorrect: result.isCorrect,
      pointsEarned: points,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setIsEvaluating(false);

    setTimeout(async () => {
      // Use ref — avoids stale closure on questionCount
      if (questionCountRef.current >= MAX_QUESTIONS) {
        await finishAssessment(updatedAnswers, newAbility);
      } else {
        await loadNextQuestion(rating!, newAbility);
      }
    }, 2800);
  };

  const finishAssessment = async (finalAnswers: AnswerRecord[], finalAbility: number) => {
    setPhase('results');
    setIsGenerating(true);

    const earnedPoints = finalAnswers.reduce((sum, a) => sum + a.pointsEarned, 0);
    const maxPossible = finalAnswers.length * MAX_POINTS_PER_Q;
    const weightedScore = Math.round((earnedPoints / maxPossible) * 100);
    setFinalScore(weightedScore);

    let level = 'C';
    if (weightedScore >= 85) level = 'A';
    else if (weightedScore >= 65) level = 'B';
    else if (weightedScore < 40) level = 'D';
    setDerivedLevel(level);

    const result = await generateAssessmentInsights(
      selectedSubject,
      effectiveGrade,
      finalAnswers,
      weightedScore,
      level
    );

    setInsights(result.insights || []);
    setRoadmap(result.roadmap || null);
    setIsGenerating(false);
  };

  if (!isOpen) return null;

  const progressPct = (Math.max(1, questionCount) / MAX_QUESTIONS) * 100;
  const abilityPct = Math.round(ability);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-paper rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-ink/5 bg-white/50 dark:bg-paper shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Compass size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">Support Zone / MyLevel</h2>
                <p className="text-xs text-muted font-medium">
                  {phase === 'subject-select' ? 'Choose your subject' : `${selectedSubject} • ${effectiveGrade}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-ink/5 flex items-center justify-center text-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10">

            {/* ── SUBJECT SELECT ── */}
            {phase === 'subject-select' && (
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 mx-auto bg-accent/10 rounded-xl flex items-center justify-center text-accent mb-4">
                    <Target size={40} />
                  </div>
                  <h1 className="text-3xl font-bold text-ink">Find your real level.</h1>
                  <p className="text-muted text-base leading-relaxed max-w-md mx-auto">
                    An adaptive 20-question check that locates your strengths and gaps, then builds your personal roadmap.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-bold text-muted uppercase tracking-wider mb-4">Select a subject</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {SUPPORTED_SUBJECTS.map(sub => (
                      <button
                        key={sub}
                        onClick={() => handleSelectSubject(sub)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-medium text-sm ${
                          selectedSubject === sub
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-ink/8 hover:border-accent/40 text-ink hover:bg-ink/3'
                        }`}
                      >
                        <span className="text-2xl">{SUBJECT_ICONS[sub] || '📚'}</span>
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleStartRating}
                    className="px-10 py-4 bg-accent text-white rounded-2xl font-bold text-base hover:bg-accent/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-accent/20 flex items-center gap-2"
                  >
                    Start MyLevel Check
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ── SELF RATING ── */}
            {phase === 'self-rating' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center space-y-2 mb-8">
                  <h2 className="text-2xl font-bold text-ink">How do you rate yourself in {selectedSubject}?</h2>
                  <p className="text-muted text-sm">Be honest — this sets your starting difficulty level.</p>
                </div>

                <div className="grid gap-3">
                  {RATING_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectRating(opt.id)}
                      className={`flex items-center gap-5 p-5 rounded-2xl border-2 border-ink/8 text-left transition-all group ${opt.color}`}
                    >
                      <div className={`w-10 h-10 rounded-xl ${opt.badge} text-white flex items-center justify-center font-black text-lg shrink-0`}>
                        {opt.id}
                      </div>
                      <div>
                        <h3 className="font-bold text-ink text-base">{opt.label}</h3>
                        <p className="text-sm text-muted">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── ASSESSMENT ── */}
            {phase === 'assessment' && (
              <div className="max-w-3xl mx-auto">
                {/* Progress bar */}
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider shrink-0">
                    {isGenerating && questionCount === 0 ? 'Q 1' : `Q ${questionCount}`} / {MAX_QUESTIONS}
                  </span>
                  <div className="h-1.5 flex-1 bg-ink/8 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-accent rounded-full"
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  {/* Live ability meter */}
                  <div className="flex items-center gap-2 text-xs font-bold text-muted shrink-0">
                    <div className="w-16 h-1.5 bg-ink/8 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald-500 rounded-full"
                        animate={{ width: `${abilityPct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                    <span>Ability {abilityPct}%</span>
                  </div>
                </div>

                {isGenerating ? (
                  <div className="py-24 flex flex-col items-center justify-center space-y-4 text-muted">
                    <div className="relative">
                      <Brain size={40} className="text-accent animate-pulse" />
                      <Loader2 size={16} className="text-accent animate-spin absolute -top-1 -right-1" />
                    </div>
                    <p className="font-medium text-sm animate-pulse">Adapting difficulty and generating next question…</p>
                  </div>
                ) : questionError ? (
                  <div className="py-24 flex flex-col items-center justify-center space-y-5 text-muted text-center">
                    <AlertCircle size={40} className="text-amber-500" />
                    <div className="space-y-2">
                      <h3 className="font-bold text-ink">Could not load question</h3>
                      <p className="text-sm">The AI service is temporarily unavailable.</p>
                    </div>
                    <button
                      onClick={() => loadNextQuestion(rating!, abilityRef.current)}
                      className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all"
                    >
                      <RefreshCw size={16} /> Try Again
                    </button>
                  </div>
                ) : currentQuestion ? (
                  <div className="space-y-6">
                    {/* Question badge */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                        currentQuestion.difficulty === 'high' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                        currentQuestion.difficulty === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {currentQuestion.difficulty}
                      </span>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                        {currentQuestion.skill}
                      </span>
                    </div>

                    {/* Question text */}
                    <div className="p-7 bg-ink/2 dark:bg-white/3 rounded-2xl border border-ink/5">
                      <p className="text-xl font-medium text-ink leading-relaxed">
                        {currentQuestion.questionText}
                      </p>
                    </div>

                    {/* Answer options */}
                    {currentQuestion.type === 'multiple-choice' && currentQuestion.options ? (
                      <div className="grid gap-3">
                        {currentQuestion.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => !feedback && setUserAnswer(opt)}
                            disabled={!!feedback}
                            className={`p-5 text-left rounded-2xl border-2 transition-all font-medium ${
                              userAnswer === opt
                                ? feedback
                                  ? feedback.isCorrect
                                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                                    : 'border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                                  : 'border-accent bg-accent/5 text-ink'
                                : feedback && opt === currentQuestion.correctAnswer
                                  ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                                  : 'border-ink/8 hover:border-ink/20 text-ink'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={userAnswer}
                        onChange={e => setUserAnswer(e.target.value)}
                        disabled={!!feedback}
                        placeholder="Type your answer here…"
                        className="w-full p-5 rounded-2xl border-2 border-ink/10 bg-transparent text-ink placeholder:text-muted/40 focus:border-accent focus:outline-none resize-none h-28 transition-colors"
                      />
                    )}

                    {/* Submit */}
                    {!feedback && (
                      <div className="flex justify-end">
                        <button
                          onClick={handleSubmitAnswer}
                          disabled={!userAnswer.trim() || isEvaluating}
                          className="px-8 py-3.5 bg-ink text-white rounded-2xl font-bold hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                        >
                          {isEvaluating ? <Loader2 className="animate-spin" size={18} /> : 'Submit Answer'}
                        </button>
                      </div>
                    )}

                    {/* Feedback */}
                    <AnimatePresence>
                      {feedback && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`p-5 rounded-2xl flex gap-4 ${
                            feedback.isCorrect
                              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
                          }`}
                        >
                          {feedback.isCorrect
                            ? <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                            : <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
                          }
                          <div>
                            <h4 className="font-bold mb-1">{feedback.isCorrect ? '✓ Correct!' : 'Not quite'}</h4>
                            <p className="text-sm opacity-90">{feedback.text}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── RESULTS ── */}
            {phase === 'results' && (
              <div className="max-w-4xl mx-auto">
                {isGenerating ? (
                  <div className="py-32 flex flex-col items-center justify-center space-y-6 text-muted">
                    <div className="relative">
                      <Sparkles size={48} className="text-accent animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold text-ink">Analyzing your performance…</h3>
                      <p className="text-sm">Generating your personalized MyLevel insights and LevelUp roadmap.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Score + Insights */}
                    <div className="lg:col-span-4 space-y-5">
                      {/* Score card */}
                      <div className="p-7 bg-ink rounded-xl text-white text-center space-y-3">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Weighted Score</span>
                        <div className="text-6xl font-black tracking-tighter text-accent">
                          {finalScore}<span className="text-2xl text-white/30">/100</span>
                        </div>
                        <div className={`inline-block text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                          derivedLevel === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                          derivedLevel === 'B' ? 'bg-blue-500/20 text-blue-400' :
                          derivedLevel === 'C' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          Level {derivedLevel}
                        </div>
                        <p className="text-xs text-white/50">
                          {answers.filter(a => a.isCorrect).length} / {answers.length} correct · Difficulty-weighted
                        </p>
                      </div>

                      {/* Insights */}
                      <div className="p-6 bg-accent/8 rounded-xl border border-accent/15">
                        <h4 className="font-bold text-accent mb-4 flex items-center gap-2 text-sm">
                          <Brain size={16} /> Performance Insights
                        </h4>
                        <ul className="space-y-3">
                          {insights.map((insight, i) => (
                            <li key={i} className="text-sm text-ink/80 dark:text-ink/70 flex items-start gap-2">
                              <span className="text-accent mt-0.5 shrink-0">▸</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Right: Roadmap */}
                    <div className="lg:col-span-8">
                      <div className="bg-paper rounded-xl border border-ink/5 p-7 h-full flex flex-col">
                        <h3 className="text-xl font-bold text-ink mb-6">Your 2-Week LevelUp Roadmap</h3>

                        {roadmap && (
                          <div className="space-y-6 flex-1">
                            {/* Daily + goal row */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-ink/3 dark:bg-white/3 rounded-2xl">
                                <span className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Daily Practice</span>
                                <span className="font-semibold text-ink text-sm">{roadmap.daily_practice}</span>
                              </div>
                              <div className="p-4 bg-accent/5 rounded-2xl border border-accent/15">
                                <span className="block text-[10px] font-bold text-accent uppercase tracking-wider mb-1">Goal</span>
                                <span className="font-semibold text-ink text-sm">{roadmap.goal}</span>
                              </div>
                            </div>

                            {/* Focus skills chips */}
                            {roadmap.focus_skills?.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Focus Skills</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {roadmap.focus_skills.map((skill, i) => (
                                    <span key={i} className="text-xs font-medium px-3 py-1 rounded-full bg-ink/5 text-ink/70 dark:bg-white/5 dark:text-ink/60">
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Week timeline */}
                            <div className="space-y-5">
                              <div className="relative pl-6 border-l-2 border-accent/30 pb-6">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-accent" />
                                <h4 className="font-bold text-ink text-sm mb-3">Week 1</h4>
                                <ul className="space-y-2">
                                  {roadmap.week_1?.map((task, i) => (
                                    <li key={i} className="text-sm text-muted flex items-start gap-2">
                                      <CheckCircle size={13} className="text-accent/40 shrink-0 mt-0.5" />
                                      {task}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="relative pl-6 border-l-2 border-ink/10">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-ink bg-paper" />
                                <h4 className="font-bold text-ink text-sm mb-3">Week 2</h4>
                                <ul className="space-y-2">
                                  {roadmap.week_2?.map((task, i) => (
                                    <li key={i} className="text-sm text-muted flex items-start gap-2">
                                      <div className="w-3 h-3 rounded-full border border-ink/20 shrink-0 mt-0.5" />
                                      {task}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <button
                              onClick={onClose}
                              className="w-full py-4 bg-ink text-white rounded-2xl font-bold hover:bg-ink/90 transition-colors mt-auto"
                            >
                              Start Learning Path →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
