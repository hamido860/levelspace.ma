import { supabase } from '../db/supabase';

export interface Exercise {
  id: string;
  topic_id?: string;
  lesson_id: string;
  title: string;
  prompt: string;
  solution: string;
  hints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  type: string;
  created_at: string;
  updated_at: string;
}

export interface ExerciseAttempt {
  id: string;
  user_id: string;
  exercise_id: string;
  user_solution: string;
  is_correct: boolean;
  score: number;
  xp_earned: number;
  feedback?: string;
  attempted_at: string;
}

export const createExercise = async (exercise: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('exercises')
    .insert([exercise])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getExercisesByLesson = async (lessonId: string) => {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('lesson_id', lessonId);
  
  if (error) throw error;
  return data;
};

export const getExerciseById = async (exerciseId: string) => {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', exerciseId)
    .single();
  
  if (error) throw error;
  return data;
};

export const submitExerciseAttempt = async (attempt: Omit<ExerciseAttempt, 'id' | 'attempted_at'>) => {
  const { data, error } = await supabase
    .from('exercise_attempts')
    .insert([attempt])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getExerciseAttemptsByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('exercise_attempts')
    .select('*, exercises(title)')
    .eq('user_id', userId)
    .order('attempted_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const getExerciseStats = async (userId: string) => {
  const { data, error } = await supabase
    .from('exercise_attempts')
    .select('is_correct, xp_earned')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  const totalAttempts = data.length;
  const correctAttempts = data.filter(a => a.is_correct).length;
  const totalXp = data.reduce((sum, a) => sum + (a.xp_earned || 0), 0);
  const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;
  
  return {
    totalAttempts,
    correctAttempts,
    accuracy,
    totalXp
  };
};
