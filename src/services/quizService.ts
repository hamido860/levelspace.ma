import { supabase } from '../db/supabase.ts';

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'matching';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface Quiz {
  id: string;
  user_id: string;
  lesson_id: string;
  title: string;
  description?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  time_limit?: number;
  questions: QuizQuestion[];
  created_at: string;
}

export interface QuizResult {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  xp_earned: number;
  answers: Record<string, string>;
  completed_at: string;
}

export const createQuiz = async (quiz: Omit<Quiz, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('quizzes')
    .insert([quiz])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getQuizzesByLesson = async (lessonId: string) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('lesson_id', lessonId);
  
  if (error) throw error;
  return data;
};

export const getQuizById = async (quizId: string) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();
  
  if (error) throw error;
  return data;
};

export const submitQuizResult = async (result: Omit<QuizResult, 'id' | 'completed_at'>) => {
  const { data, error } = await supabase
    .from('quiz_results')
    .insert([result])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getQuizResultsByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('quiz_results')
    .select('*, quizzes(title)')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });
  
  if (error) throw error;
  return data;
};
