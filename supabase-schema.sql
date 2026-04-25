-- Supabase Schema for LevelSpace App

-- 0. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT CHECK (plan IN ('free', 'pro')) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1. Modules Table
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  category TEXT,
  progress INTEGER DEFAULT 0,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  tags TEXT[]
);

-- 2. Lessons Table (Global RAG Database)
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  lesson_title TEXT NOT NULL,
  content TEXT NOT NULL,
  exercises JSONB DEFAULT '[]'::jsonb,
  quizzes JSONB DEFAULT '[]'::jsonb,
  mod JSONB DEFAULT '[]'::jsonb,
  exam JSONB,
  embedding vector(768),
  author_id UUID REFERENCES auth.users ON DELETE SET NULL,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  due_date TIMESTAMPTZ,
  type TEXT CHECK (type IN ('assignment', 'reading', 'quiz', 'general', 'exam', 'controle')) DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  tags TEXT[]
);

-- 4. Schedule Table
CREATE TABLE IF NOT EXISTS schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  month TEXT NOT NULL,
  title TEXT NOT NULL,
  time TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Settings Table (User Specific)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (key, user_id)
);

-- 7. Curriculum Metadata Table
CREATE TABLE IF NOT EXISTS curriculum_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('country', 'grade', 'subject')),
  name TEXT NOT NULL,
  parent_name TEXT, -- For grades belonging to a country
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(type, name, parent_name)
);

-- 8. App Settings Table (Global)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. LEVELS (Grade 1, 2, 3...)
CREATE TABLE IF NOT EXISTS levels (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(50) NOT NULL,        -- "Level 1", "Grade 2"
  order_num SMALLINT NOT NULL,           -- for sorting
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. SUBJECTS per level
CREATE TABLE IF NOT EXISTS subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id   UUID REFERENCES levels(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,      -- "Math", "Science"
  code       VARCHAR(20),               -- "MATH-L1"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. CONTENT with versioning
CREATE TABLE IF NOT EXISTS content (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID REFERENCES subjects(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  body         TEXT,
  version      VARCHAR(10) NOT NULL DEFAULT '1.0',  -- "1.0", "1.1", "2.0"
  is_active    BOOLEAN DEFAULT true,    -- only 1 active version at a time
  parent_id    UUID REFERENCES content(id),  -- links to previous version
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE bac_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bac_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bac_international_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE bac_track_international_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE bac_track_subjects ENABLE ROW LEVEL SECURITY;

-- Create Policies (Restrict by user_id)
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage their own modules" ON modules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own user_lessons" ON user_lessons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view lessons" ON lessons FOR SELECT USING (true);
CREATE POLICY "Admins can manage lessons" ON lessons FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.plan = 'pro'
  )
);

CREATE POLICY "Users can manage their own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own schedule" ON schedule FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own notes" ON notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own settings" ON settings FOR ALL USING (auth.uid() = user_id);

-- Metadata Policies
CREATE POLICY "Anyone can view metadata" ON curriculum_metadata FOR SELECT USING (true);
CREATE POLICY "Admins can manage metadata" ON curriculum_metadata FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.plan = 'pro'
  )
);

-- App Settings Policies
CREATE POLICY "Anyone can view app settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage app settings" ON app_settings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.plan = 'pro'
  )
);

-- Levels, Subjects, Content Policies
CREATE POLICY "Anyone can view levels" ON levels FOR SELECT USING (true);
CREATE POLICY "Admins can manage levels" ON levels FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro')
);

CREATE POLICY "Anyone can view subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Admins can manage subjects" ON subjects FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro')
);

CREATE POLICY "Anyone can view content" ON content FOR SELECT USING (true);
CREATE POLICY "Admins can manage content" ON content FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro')
);

-- Curriculum & Baccalaureate Policies
CREATE POLICY "Anyone can view curricula" ON curricula FOR SELECT USING (true);
CREATE POLICY "Admins can manage curricula" ON curricula FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view cycles" ON cycles FOR SELECT USING (true);
CREATE POLICY "Admins can manage cycles" ON cycles FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view grades" ON grades FOR SELECT USING (true);
CREATE POLICY "Admins can manage grades" ON grades FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view grade_subjects" ON grade_subjects FOR SELECT USING (true);
CREATE POLICY "Admins can manage grade_subjects" ON grade_subjects FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view topics" ON topics FOR SELECT USING (true);
CREATE POLICY "Admins can manage topics" ON topics FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view bac_sections" ON bac_sections FOR SELECT USING (true);
CREATE POLICY "Admins can manage bac_sections" ON bac_sections FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view bac_tracks" ON bac_tracks FOR SELECT USING (true);
CREATE POLICY "Admins can manage bac_tracks" ON bac_tracks FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view bac_international_options" ON bac_international_options FOR SELECT USING (true);
CREATE POLICY "Admins can manage bac_international_options" ON bac_international_options FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view bac_track_international_options" ON bac_track_international_options FOR SELECT USING (true);
CREATE POLICY "Admins can manage bac_track_international_options" ON bac_track_international_options FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

CREATE POLICY "Anyone can view bac_track_subjects" ON bac_track_subjects FOR SELECT USING (true);
CREATE POLICY "Admins can manage bac_track_subjects" ON bac_track_subjects FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

-- Enable pgvector extension for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- 12. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  time_limit INTEGER, -- in seconds
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. User Lessons Table (Personalized synced lessons)
CREATE TABLE IF NOT EXISTS user_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL,
  blocks JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Curricula Table
CREATE TABLE IF NOT EXISTS curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country)
);

-- 15. Cycles Table
CREATE TABLE IF NOT EXISTS cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id UUID REFERENCES curricula(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Grades Table
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Grade Subjects Table
CREATE TABLE IF NOT EXISTS grade_subjects (
  grade_id UUID REFERENCES grades(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (grade_id, subject_id)
);

-- 18. Topics Table
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID REFERENCES grades(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. Baccalaureate Tables
CREATE TABLE IF NOT EXISTS bac_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bac_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bac_international_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bac_track_international_options (
  track_id UUID REFERENCES bac_tracks(id) ON DELETE CASCADE,
  option_id UUID REFERENCES bac_international_options(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, option_id)
);

CREATE TABLE IF NOT EXISTS bac_track_subjects (
  track_id UUID REFERENCES bac_tracks(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, subject_id)
);

-- 21. Global AI Cache Table
CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  hit_count INTEGER DEFAULT 1
);

-- Enable RLS for ai_cache
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ai_cache" ON ai_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert into ai_cache" ON ai_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update hit_count" ON ai_cache FOR UPDATE USING (true);

-- Function to increment hit_count
CREATE OR REPLACE FUNCTION increment_ai_cache_hit(p_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_cache
  SET hit_count = hit_count + 1
  WHERE key = p_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 20. Quiz Results Table
CREATE TABLE IF NOT EXISTS quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Exercises Table
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  solution TEXT NOT NULL,
  hints TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Exercise Attempts Table
CREATE TABLE IF NOT EXISTS exercise_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  user_solution TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  feedback TEXT,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

-- 13. RAG Chunks Table
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for rag_chunks
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rag_chunks" ON rag_chunks FOR SELECT USING (true);
CREATE POLICY "Admins can manage rag_chunks" ON rag_chunks FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plan = 'pro'));

-- Create match_rag_chunks function
CREATE OR REPLACE FUNCTION match_rag_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rag_chunks.id,
    rag_chunks.source_id,
    rag_chunks.content,
    1 - (rag_chunks.embedding <=> query_embedding) AS similarity,
    rag_chunks.metadata
  FROM rag_chunks
  WHERE 1 - (rag_chunks.embedding <=> query_embedding) > match_threshold
    AND (p_user_id IS NULL OR (rag_chunks.metadata->>'user_id')::uuid = p_user_id)
  ORDER BY rag_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Create match_lessons function
CREATE OR REPLACE FUNCTION match_lessons (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  lesson_title text,
  content text,
  similarity float,
  country text,
  grade text,
  subject text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    lessons.id,
    lessons.lesson_title,
    lessons.content,
    1 - (lessons.embedding <=> query_embedding) AS similarity,
    lessons.country,
    lessons.grade,
    lessons.subject
  FROM lessons
  WHERE 1 - (lessons.embedding <=> query_embedding) > match_threshold
  ORDER BY lessons.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 14. Embeddings Table (for RAG)
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768), -- Assuming 768 dimensions for Gemini embeddings
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) for new tables
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Create Policies (Restrict by user_id)
CREATE POLICY "Users can manage their own quizzes" ON quizzes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own quiz results" ON quiz_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own exercises" ON exercises FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own exercise attempts" ON exercise_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own embeddings" ON embeddings FOR ALL USING (auth.uid() = user_id);

-- Create match_embeddings function for similarity search
CREATE OR REPLACE FUNCTION match_embeddings (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  lesson_id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    embeddings.id,
    embeddings.lesson_id,
    embeddings.content,
    1 - (embeddings.embedding <=> query_embedding) AS similarity
  FROM embeddings
  WHERE 1 - (embeddings.embedding <=> query_embedding) > match_threshold
    AND embeddings.user_id = p_user_id
  ORDER BY embeddings.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Trigger for creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
