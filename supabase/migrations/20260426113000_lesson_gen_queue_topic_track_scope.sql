create table if not exists public.lesson_gen_queue (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  track_id uuid references public.bac_tracks(id) on delete set null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  claimed_at timestamptz,
  validation_status text,
  quality_score numeric(5,2),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.lesson_gen_queue
  add column if not exists topic_id uuid,
  add column if not exists track_id uuid,
  add column if not exists status text,
  add column if not exists attempts integer,
  add column if not exists last_error text,
  add column if not exists claimed_at timestamptz,
  add column if not exists validation_status text,
  add column if not exists quality_score numeric(5,2),
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.lesson_gen_queue
  alter column status set default 'pending',
  alter column attempts set default 0,
  alter column created_at set default timezone('utc'::text, now()),
  alter column updated_at set default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1
    from public.lesson_gen_queue
    where topic_id is null
  ) then
    alter table public.lesson_gen_queue
      alter column topic_id set not null;
  end if;

  if not exists (
    select 1
    from public.lesson_gen_queue
    where status is null
  ) then
    alter table public.lesson_gen_queue
      alter column status set not null;
  end if;

  if not exists (
    select 1
    from public.lesson_gen_queue
    where attempts is null
  ) then
    alter table public.lesson_gen_queue
      alter column attempts set not null;
  end if;

  if not exists (
    select 1
    from public.lesson_gen_queue
    where created_at is null
  ) then
    alter table public.lesson_gen_queue
      alter column created_at set not null;
  end if;

  if not exists (
    select 1
    from public.lesson_gen_queue
    where updated_at is null
  ) then
    alter table public.lesson_gen_queue
      alter column updated_at set not null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lesson_gen_queue_topic_id_fkey'
  ) then
    alter table public.lesson_gen_queue
      add constraint lesson_gen_queue_topic_id_fkey
      foreign key (topic_id) references public.topics(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lesson_gen_queue_track_id_fkey'
  ) then
    alter table public.lesson_gen_queue
      add constraint lesson_gen_queue_track_id_fkey
      foreign key (track_id) references public.bac_tracks(id) on delete set null;
  end if;
end
$$;

create index if not exists lesson_gen_queue_topic_id_idx
  on public.lesson_gen_queue (topic_id);

create index if not exists lesson_gen_queue_track_id_idx
  on public.lesson_gen_queue (track_id);

create unique index if not exists lesson_gen_queue_topic_without_track_udx
  on public.lesson_gen_queue (topic_id)
  where track_id is null;

create unique index if not exists lesson_gen_queue_topic_with_track_udx
  on public.lesson_gen_queue (topic_id, track_id)
  where track_id is not null;

comment on column public.lesson_gen_queue.track_id is
  'Optional academic track scope for queue jobs. Null means legacy or grade-wide generation request.';

comment on column public.lesson_gen_queue.validation_status is
  'Admin-facing validation result for generated lesson quality checks.';

comment on column public.lesson_gen_queue.quality_score is
  'Admin-facing numeric quality score for generated lesson review.';
