-- Fix Levelspace classroom lesson counts.
-- One curriculum topic should produce at most one active classroom lesson.

alter table public.lessons
add column if not exists is_active boolean not null default true;

with ranked as (
  select
    id,
    topic_id,
    row_number() over (
      partition by topic_id
      order by
        length(coalesce(content, '')) desc,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as rn
  from public.lessons
  where topic_id is not null
)
update public.lessons l
set is_active = (ranked.rn = 1)
from ranked
where l.id = ranked.id;

create unique index if not exists lessons_one_active_per_topic_idx
on public.lessons (topic_id)
where topic_id is not null and is_active = true;

create index if not exists lessons_topic_active_idx
on public.lessons (topic_id, is_active);

create or replace function public.get_grade_subject_coverage(
  p_grade_id uuid
)
returns table (
  grade text,
  subject_id uuid,
  subject text,
  expected_topics bigint,
  generated_topics bigint,
  raw_lesson_rows bigint,
  duplicate_or_extra_rows bigint,
  coverage_percent integer
)
language sql
stable
as $$
  select
    g.name as grade,
    s.id as subject_id,
    s.name as subject,
    count(distinct t.id) as expected_topics,
    count(distinct l_active.topic_id)
      filter (where l_active.id is not null) as generated_topics,
    count(l_all.id) as raw_lesson_rows,
    greatest(
      count(l_all.id)
      - count(distinct l_active.topic_id)
          filter (where l_active.id is not null),
      0
    ) as duplicate_or_extra_rows,
    coalesce(
      floor(
        100.0
        * count(distinct l_active.topic_id)
            filter (where l_active.id is not null)
        / nullif(count(distinct t.id), 0)
      )::int,
      0
    ) as coverage_percent
  from public.grades g
  join public.grade_subjects gs
    on gs.grade_id = g.id
  join public.subjects s
    on s.id = gs.subject_id
  left join public.topics t
    on t.grade_id = g.id
   and t.subject_id = s.id
  left join public.lessons l_active
    on l_active.topic_id = t.id
   and l_active.is_active = true
   and length(trim(coalesce(l_active.content, ''))) > 50
  left join public.lessons l_all
    on l_all.topic_id = t.id
   and length(trim(coalesce(l_all.content, ''))) > 50
  where g.id = p_grade_id
  group by g.name, s.id, s.name
  order by s.name;
$$;

comment on function public.get_grade_subject_coverage(uuid)
is 'Returns official topic coverage per subject for a grade. Use generated_topics for classroom lesson count and coverage_percent for lesson generation coverage.';

-- Remove inactive duplicate rows from existing country/grade/subject hydration queries while preserving their original scope.
alter table public.lessons
add column if not exists archived_original_grade text,
add column if not exists archived_original_subject text,
add column if not exists archived_original_country text;

update public.lessons
set archived_original_grade = coalesce(archived_original_grade, grade),
    archived_original_subject = coalesce(archived_original_subject, subject),
    archived_original_country = coalesce(archived_original_country, country),
    grade = '__archived_duplicate__',
    subject = '__archived_duplicate__',
    country = '__archived_duplicate__'
where is_active = false
  and archived_original_grade is null;

create index if not exists lessons_active_scope_idx
on public.lessons (country, grade, subject, topic_id)
where is_active = true;

create index if not exists lessons_archived_duplicate_scope_idx
on public.lessons (archived_original_grade, archived_original_subject, archived_original_country)
where is_active = false;
