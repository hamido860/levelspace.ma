create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  plan text check (plan in ('free', 'pro')) default 'free',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  code text not null,
  description text,
  category text,
  progress integer default 0,
  selected boolean default false,
  tags text[],
  strict_rag boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  grade text not null,
  subject text not null,
  lesson_title text not null,
  title text,
  subtitle text,
  content text not null default '',
  blocks jsonb default '[]'::jsonb,
  exercises jsonb default '[]'::jsonb,
  quizzes jsonb default '[]'::jsonb,
  mod jsonb default '[]'::jsonb,
  exam jsonb,
  tags text[],
  embedding vector(768),
  author_id uuid references auth.users on delete set null,
  is_ai_generated boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  completed boolean default false,
  due_date timestamptz,
  type text check (type in ('assignment', 'reading', 'quiz', 'general', 'exam', 'controle')) default 'general',
  tags text[],
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  month text not null,
  title text not null,
  time text,
  location text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  lesson_id uuid references public.lessons on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.settings (
  key text not null,
  user_id uuid references auth.users on delete cascade not null,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (key, user_id)
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) not null,
  order_num smallint not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  level_id uuid references public.levels on delete cascade,
  name varchar(100) not null,
  code varchar(20),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects on delete cascade,
  title varchar(200) not null,
  body text,
  version varchar(10) not null default '1.0',
  is_active boolean default true,
  parent_id uuid references public.content(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  lesson_id uuid references public.lessons on delete cascade,
  module_id uuid references public.modules on delete cascade,
  title text not null,
  subtitle text,
  content text default '',
  blocks jsonb default '[]'::jsonb,
  status text default 'done',
  tags text[],
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.curricula (
  id uuid primary key default gen_random_uuid(),
  country text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid references public.curricula on delete cascade not null,
  name text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.cycles on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.grade_subjects (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid references public.grades on delete cascade not null,
  subject_id uuid references public.subjects on delete cascade not null
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid references public.grades on delete cascade not null,
  subject_id uuid references public.subjects on delete cascade not null,
  title text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.bac_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.bac_tracks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.bac_sections on delete cascade,
  name text not null unique
);

create table if not exists public.bac_international_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.bac_track_international_options (
  track_id uuid references public.bac_tracks on delete cascade,
  option_id uuid references public.bac_international_options on delete cascade,
  primary key (track_id, option_id)
);

create table if not exists public.bac_track_subjects (
  track_id uuid references public.bac_tracks on delete cascade,
  subject_id uuid references public.subjects on delete cascade,
  primary key (track_id, subject_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  lesson_id uuid references public.lessons on delete cascade,
  title text not null,
  description text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')) default 'medium',
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  quiz_id uuid references public.quizzes on delete cascade not null,
  score integer not null default 0,
  total_questions integer not null default 0,
  xp_earned integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.topics on delete set null,
  lesson_id uuid references public.lessons on delete cascade,
  title text not null,
  prompt text not null,
  solution text,
  hints jsonb default '[]'::jsonb,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')) default 'medium',
  type text default 'practice',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  exercise_id uuid references public.exercises on delete cascade not null,
  user_solution text,
  is_correct boolean default false,
  score integer not null default 0,
  xp_earned integer not null default 0,
  feedback text,
  attempted_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid,
  source_type text,
  content text not null,
  embedding vector(768),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists lessons_embedding_idx
  on public.lessons using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists rag_chunks_embedding_idx
  on public.rag_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
