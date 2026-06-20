-- ============================================================
-- Fix: RLS policies blocking admin dashboard data fetch
-- ============================================================
-- Problem 1: curricula, cycles, grades, subjects, topics,
--   lessons, rag_chunks, lesson_gen_queue, profiles and other
--   tables had RLS enabled but no SELECT policies for
--   authenticated users → checkSupabaseConnection() returned
--   false and all KPIs showed 0.
-- Problem 2: profiles table was missing a `role` column, so
--   requireAdminUser() always returned 403.
-- ============================================================

-- ── 1. Add `role` column to profiles if missing ─────────────
alter table public.profiles
  add column if not exists role text default 'user'
    check (role in ('user', 'admin', 'moderator'));

-- ── 2. curricula: open read for everyone (public curriculum data)
alter table public.curricula enable row level security;

drop policy if exists "Anyone can read curricula" on public.curricula;
create policy "Anyone can read curricula"
  on public.curricula for select
  using (true);

-- ── 3. cycles
alter table public.cycles enable row level security;

drop policy if exists "Anyone can read cycles" on public.cycles;
create policy "Anyone can read cycles"
  on public.cycles for select
  using (true);

-- ── 4. grades
alter table public.grades enable row level security;

drop policy if exists "Anyone can read grades" on public.grades;
create policy "Anyone can read grades"
  on public.grades for select
  using (true);

-- ── 5. subjects
alter table public.subjects enable row level security;

drop policy if exists "Anyone can read subjects" on public.subjects;
create policy "Anyone can read subjects"
  on public.subjects for select
  using (true);

-- ── 6. topics
alter table public.topics enable row level security;

drop policy if exists "Anyone can read topics" on public.topics;
create policy "Anyone can read topics"
  on public.topics for select
  using (true);

-- ── 7. lessons: authenticated users can read all lessons
alter table public.lessons enable row level security;

drop policy if exists "Authenticated users can read lessons" on public.lessons;
create policy "Authenticated users can read lessons"
  on public.lessons for select
  to authenticated
  using (true);

-- ── 8. rag_chunks: authenticated users can read
alter table public.rag_chunks enable row level security;

drop policy if exists "Authenticated users can read rag_chunks" on public.rag_chunks;
create policy "Authenticated users can read rag_chunks"
  on public.rag_chunks for select
  to authenticated
  using (true);

-- ── 9. lesson_gen_queue: authenticated users can read
alter table public.lesson_gen_queue enable row level security;

drop policy if exists "Authenticated users can read lesson_gen_queue" on public.lesson_gen_queue;
create policy "Authenticated users can read lesson_gen_queue"
  on public.lesson_gen_queue for select
  to authenticated
  using (true);

-- ── 10. profiles: users can read their own profile; admins can read all
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- ── 11. app_settings: any authenticated user can read
alter table public.app_settings enable row level security;

drop policy if exists "Authenticated users can read app_settings" on public.app_settings;
create policy "Authenticated users can read app_settings"
  on public.app_settings for select
  to authenticated
  using (true);

-- ── 12. bac_sections / bac_tracks / bac_track_subjects: public read
alter table public.bac_sections enable row level security;
drop policy if exists "Anyone can read bac_sections" on public.bac_sections;
create policy "Anyone can read bac_sections"
  on public.bac_sections for select using (true);

alter table public.bac_tracks enable row level security;
drop policy if exists "Anyone can read bac_tracks" on public.bac_tracks;
create policy "Anyone can read bac_tracks"
  on public.bac_tracks for select using (true);

alter table public.bac_track_subjects enable row level security;
drop policy if exists "Anyone can read bac_track_subjects" on public.bac_track_subjects;
create policy "Anyone can read bac_track_subjects"
  on public.bac_track_subjects for select using (true);

alter table public.grade_subjects enable row level security;
drop policy if exists "Anyone can read grade_subjects" on public.grade_subjects;
create policy "Anyone can read grade_subjects"
  on public.grade_subjects for select using (true);

-- ── 13. subject_domains: public read
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'subject_domains'
  ) then
    execute 'alter table public.subject_domains enable row level security';
    execute 'drop policy if exists "Anyone can read subject_domains" on public.subject_domains';
    execute $policy$
      create policy "Anyone can read subject_domains"
        on public.subject_domains for select using (true)
    $policy$;
  end if;
end;
$$;
