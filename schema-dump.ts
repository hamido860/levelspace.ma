import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pimojkivimygenhygsto.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpbW9qa2l2aW15Z2VuaHlnc3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzAzNDksImV4cCI6MjA5MDEwNjM0OX0.3PqRdyQMlz3aMaqSnm8_oD6iYJpN-CVilA6bk5G88wM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function dump() {
  const { data: cycles } = await supabase.from('cycles').select('*');
  console.log('CYCLES:', cycles);

  const { data: grades } = await supabase.from('grades').select('*');
  console.log('GRADES:', grades);

  const { data: subjects } = await supabase.from('subjects').select('*');
  console.log('SUBJECTS:', subjects);

  const { data: grade_subjects } = await supabase.from('grade_subjects').select('*');
  console.log('GRADE_SUBJECTS:', grade_subjects);

  const { data: bac_tracks } = await supabase.from('bac_tracks').select('*');
  console.log('BAC_TRACKS:', bac_tracks);

  const { data: bac_sections } = await supabase.from('bac_sections').select('*');
  console.log('BAC_SECTIONS:', bac_sections);

  const { data: options } = await supabase.from('bac_international_options').select('*');
  console.log('OPTIONS:', options);
}

dump();
