-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store the lesson templates
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  grade text not null,
  subject text not null,
  lesson_title text not null,
  content text not null,
  exercises jsonb default '[]'::jsonb,
  quizzes jsonb default '[]'::jsonb,
  mod text,
  exam jsonb,
  embedding vector(768), -- Gemini embeddings are 768 dimensions
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an index for faster similarity searches
create index if not exists lessons_embedding_idx on public.lessons using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create a function to search for lessons
create or replace function match_lessons (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  country text,
  grade text,
  subject text,
  lesson_title text,
  content text,
  exercises jsonb,
  quizzes jsonb,
  mod text,
  exam jsonb,
  similarity float
)
language sql stable
as $$
  select
    lessons.id,
    lessons.country,
    lessons.grade,
    lessons.subject,
    lessons.lesson_title,
    lessons.content,
    lessons.exercises,
    lessons.quizzes,
    lessons.mod,
    lessons.exam,
    1 - (lessons.embedding <=> query_embedding) as similarity
  from lessons
  where 1 - (lessons.embedding <=> query_embedding) > match_threshold
  order by lessons.embedding <=> query_embedding
  limit match_count;
$$;

-- Set up Row Level Security (RLS)
alter table public.lessons enable row level security;

-- Allow public read access to lessons (or restrict to authenticated users if needed)
create policy "Allow public read access"
  on public.lessons
  for select
  using (true);

-- Allow authenticated users to insert lessons
create policy "Allow authenticated insert"
  on public.lessons
  for insert
  with check (auth.role() = 'authenticated');
