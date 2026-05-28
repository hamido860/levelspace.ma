import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Lightbulb, 
  Timer, 
  BookOpen, 
  BarChart3, 
  Settings,
  ArrowRight,
  Trophy,
  RefreshCcw,
  Sparkles,
  Target,
  Brain,
  RefreshCw,
  Zap,
  Clock
} from 'lucide-react';
import { Quiz } from '../types';

const mockQuiz: Quiz = {
  id: '1',
  title: 'The Basics of Perception',
  moduleName: 'Psychology 101',
  timeLimitMinutes: 15,
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      text: 'Which of these is a key component of the Gestalt principles?',
      options: [
        'Linear perspective',
        'Figure-ground relationship',
        'The trichromatic theory',
        'Bottom-up processing'
      ],
      correctAnswer: 'Figure-ground relationship',
      points: 10
    }
  ]
};

export const QuizInterface: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
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

  const currentQuestion = mockQuiz.questions[currentQuestionIndex];
  const totalQuestions = 10;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    if (selectedOption) {
      setIsFinished(true);
    }
  };

  if (isFinished) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full max-w-xl p-16 bg-paper border border-ink/5 rounded-4xl text-center space-y-12 shadow-md shadow-ink/5 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-accent" />
            
            <div className="w-28 h-28 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto border border-accent/20">
              <Trophy className="w-12 h-12" />
            </div>
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/5 rounded-full text-accent text-[10px] font-mono font-bold uppercase tracking-normal">
                <Sparkles className="w-3 h-3" />
                Assessment Complete
              </div>
              <h1 className="text-5xl font-serif font-medium text-ink leading-tight">
                Curated Mastery <br />
                <span className="italic opacity-60">Achieved</span>
              </h1>
              <p className="text-muted font-light text-lg max-w-sm mx-auto leading-relaxed">
                You've successfully mastered the foundations of perception within the Psychology 101 repository.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 py-10 border-y border-ink/5">
              <div className="text-center space-y-2">
                <div className="text-4xl font-serif font-medium text-ink">92%</div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted">Accuracy Rate</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl font-serif font-medium text-ink">08:42</div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted">Time Elapsed</div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => navigate('/modules')}
                className="group w-full py-6 bg-ink text-paper rounded-full font-medium text-sm uppercase tracking-[0.2em] hover:bg-accent transition-all duration-300 flex items-center justify-center gap-3"
              >
                Return to Repository
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => setIsFinished(false)}
                className="w-full py-6 bg-transparent border border-ink/10 text-ink rounded-full font-medium text-sm uppercase tracking-[0.2em] hover:bg-ink hover:text-paper transition-all duration-300 flex items-center justify-center gap-3 group"
              >
                <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                Retake Assessment
              </button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullWidth>
      <div className="h-full w-full bg-background flex flex-col overflow-hidden p-4">
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 overflow-hidden">

          {/* Column 2: Main Quiz Content */}
          <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 p-8">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-8">
              {/* Quiz Header Info Bar */}
              <div className="relative p-6 bg-slate-50 dark:bg-surface-low/30 border border-slate-100 dark:border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-wider">
                    <span>{mockQuiz.moduleName}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-white/20" />
                    <span>{mockQuiz.timeLimitMinutes} min limit</span>
                  </div>
                  <h1 className="text-xl font-serif font-bold text-slate-950 dark:text-ink">{mockQuiz.title}</h1>
                </div>
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold shadow-sm transition-all dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low self-start md:self-auto"
                >
                  <ArrowLeft size={13} className="text-accent" />
                  Back to Lesson
                </button>
              </div>
              {/* Progress Bar Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-normal text-muted">
                      Question {currentQuestionIndex + 1} / {totalQuestions}
                    </span>
                    <h3 className="text-xl font-serif font-medium">Current Trajectory</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-serif font-medium">{Math.round(progress)}</span>
                    <span className="text-sm font-mono text-muted uppercase tracking-normal">%</span>
                  </div>
                </div>
                <div className="h-[2px] w-full bg-ink/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-accent"
                  />
                </div>
              </div>

        {/* Question Area */}
        <div className="space-y-16">
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-px w-12 bg-accent"></div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-normal text-accent">Inquiry</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-serif font-medium leading-[1.1] text-ink">
              {currentQuestion.text}
            </h2>
          </div>

          <div className="grid gap-6">
            {currentQuestion.options?.map((option, i) => {
              const letter = String.fromCharCode(65 + i);
              const isSelected = selectedOption === option;
              
              return (
                <motion.button
                  key={i}
                  whileHover={{ x: 12 }}
                  onClick={() => handleOptionSelect(option)}
                  className={`w-full p-10 text-left rounded-4xl border transition-all duration-300 flex items-center justify-between group relative ${
                    isSelected
                      ? 'bg-paper border-accent shadow-md shadow-accent/5'
                      : 'bg-background border-ink/5 hover:border-ink/20'
                  }`}
                >
                  <div className="flex items-center gap-8">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-bold text-xs transition-all duration-300 ${
                      isSelected
                        ? 'bg-ink text-paper'
                        : 'bg-paper text-muted border border-ink/5'
                    }`}>
                      {letter}
                    </div>
                    <span className={`text-xl font-light tracking-tight transition-colors ${isSelected ? 'text-ink font-medium' : 'text-muted group-hover:text-ink'}`}>
                      {option}
                    </span>
                  </div>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-sm shadow-accent/20"
                      >
                        <CheckCircle2 className="w-4 h-4 text-paper" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Focus Tip */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-12 bg-paper rounded-4xl space-y-8 border border-ink/5 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Target className="w-24 h-24" />
            </div>
            <div className="flex items-center gap-3 text-muted">
              <Lightbulb className="w-4 h-4 text-accent" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-normal">Curator's Insight</span>
            </div>
            <p className="text-ink/80 italic font-serif text-2xl leading-relaxed relative z-10">
              "The whole is other than the sum of the parts." <br />
              <span className="text-sm font-mono uppercase tracking-normal not-italic opacity-40 mt-4 block">— Kurt Koffka</span>
            </p>
          </motion.section>

          {/* Action Button */}
          <div className="pt-8">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={!selectedOption}
              className="group w-full py-6 bg-ink text-paper rounded-full font-medium text-sm uppercase tracking-normal flex items-center justify-center gap-4 shadow-md shadow-ink/20 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed hover:bg-accent transition-all duration-300"
            >
              Submit Response
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>
        </div>
            </div>
          </div>

          {/* Column 3: Right Sidebar */}
          <div className="hidden lg:flex lg:w-[260px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-5">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6 pr-1">

              {/* Focus Timer */}
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

              {/* Quiz Tips */}
              <section className="space-y-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Quiz Tips</p>
                {[
                  { tip: 'Read all options before selecting your answer', icon: <Brain size={12} /> },
                  { tip: 'Eliminate obviously wrong answers first', icon: <Target size={12} /> },
                  { tip: 'Trust your first instinct if unsure', icon: <Zap size={12} /> },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5">
                    <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0 mt-0.5">{item.icon}</div>
                    <p className="text-[11px] text-slate-600 dark:text-ink-secondary leading-relaxed">{item.tip}</p>
                  </div>
                ))}
              </section>

              {/* Score Info */}
              <section className="p-4 bg-slate-50 dark:bg-surface-low/30 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Scoring</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Per Question</span>
                    <span className="font-bold text-slate-800 dark:text-ink">{mockQuiz.questions[0]?.points || 10} pts</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Total Questions</span>
                    <span className="font-bold text-slate-800 dark:text-ink">{totalQuestions}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Max Score</span>
                    <span className="font-bold text-accent">{(mockQuiz.questions[0]?.points || 10) * totalQuestions} pts</span>
                  </div>
                </div>
              </section>

            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
};
