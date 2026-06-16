create table if not exists learner_mylevel_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  grade_id uuid not null,
  subject_id uuid not null,
  language text,
  self_rating text not null check (self_rating in ('A', 'B', 'C', 'D')),
  final_level text not null check (final_level in ('A', 'B', 'C', 'D')),
  score integer not null check (score >= 0 and score <= 100),
  total_questions integer not null default 20,
  correct_answers integer not null default 0,
  skill_scores jsonb not null default '{}'::jsonb,
  wrong_answer_categories jsonb not null default '[]'::jsonb,
  insights jsonb not null default '[]'::jsonb,
  recommended_mode text not null,
  roadmap jsonb not null default '{}'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table learner_mylevel_assessments enable row level security;

create policy "Users can view their own assessments" on learner_mylevel_assessments
  for select using (auth.uid() = user_id);

create policy "Users can insert their own assessments" on learner_mylevel_assessments
  for insert with check (auth.uid() = user_id);
