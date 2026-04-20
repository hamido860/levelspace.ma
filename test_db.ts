import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { data: eData, error: eError } = await supabase.from('exercises').insert({
    title: 'test', prompt: 'test', solution: 'test', difficulty: 'easy', type: 'practice'
  }).select();
  console.log("Exercises Insert:", eData, eError);
  
  const { data: qData, error: qError } = await supabase.from('quizzes').insert({
    title: 'test', difficulty: 'easy', questions: []
  }).select();
  console.log("Quizzes Insert:", qData, qError);
}
run();
