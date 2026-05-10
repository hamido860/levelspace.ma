-- Canonical curriculum hierarchy:
-- Grade -> Subject -> Subject Domain -> Topic -> Lesson -> Blocks / Exercises / Skills.
--
-- French learning strands such as Grammaire and Conjugaison are domains of
-- Français. They must not be represented as independent classroom subjects.

create table if not exists public.subject_domains (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  domain_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists subject_domains_subject_code_uidx
  on public.subject_domains (subject_id, code);

alter table public.topics
  add column if not exists domain_id uuid references public.subject_domains(id) on delete set null;

create index if not exists topics_domain_id_idx
  on public.topics (domain_id);

do $$
declare
  french_subject_id uuid;
begin
  select id
  into french_subject_id
  from public.subjects
  where lower(name) = lower('Français')
  order by created_at nulls last
  limit 1;

  if french_subject_id is null then
    insert into public.subjects (name, code)
    values ('Français', 'FR')
    returning id into french_subject_id;
  end if;

  insert into public.subject_domains (subject_id, code, name, domain_order)
  values
    (french_subject_id, 'GRAMMAIRE', 'Grammaire', 10),
    (french_subject_id, 'CONJUGAISON', 'Conjugaison', 20),
    (french_subject_id, 'ORTHOGRAPHE', 'Orthographe', 30),
    (french_subject_id, 'LEXIQUE', 'Lexique', 40),
    (french_subject_id, 'LECTURE', 'Lecture', 50),
    (french_subject_id, 'EXPRESSION_ECRITE', 'Expression écrite', 60),
    (french_subject_id, 'COMMUNICATION_ORALE', 'Communication orale', 70)
  on conflict (subject_id, code) do update
    set name = excluded.name,
        domain_order = excluded.domain_order;

  update public.grade_subjects gs
  set subject_id = french_subject_id
  from public.subjects alias_subject
  where gs.subject_id = alias_subject.id
    and lower(alias_subject.name) = lower('Langue Française')
    and not exists (
      select 1
      from public.grade_subjects existing
      where existing.grade_id = gs.grade_id
        and existing.subject_id = french_subject_id
    );

  update public.topics topic
  set subject_id = french_subject_id
  from public.subjects alias_subject
  where topic.subject_id = alias_subject.id
    and lower(alias_subject.name) = lower('Langue Française');

  update public.skills skill
  set subject_id = french_subject_id
  from public.subjects alias_subject
  where skill.subject_id = alias_subject.id
    and lower(alias_subject.name) = lower('Langue Française');

  update public.topics topic
  set domain_id = domain.id
  from public.subject_domains domain
  where topic.subject_id = french_subject_id
    and domain.subject_id = french_subject_id
    and domain.code = case
      when topic.title ilike 'Grammaire:%' then 'GRAMMAIRE'
      when topic.title ilike 'Langue:%' then 'GRAMMAIRE'
      when topic.title ilike 'Conjugaison:%' then 'CONJUGAISON'
      when topic.title ilike 'Orthographe:%' then 'ORTHOGRAPHE'
      when topic.title ilike 'Lexique:%' then 'LEXIQUE'
      when topic.title ilike 'Production écrite:%' then 'EXPRESSION_ECRITE'
      when topic.title ilike 'La production écrite%' then 'EXPRESSION_ECRITE'
      when topic.title ilike '%expression écrite%' then 'EXPRESSION_ECRITE'
      when topic.title ilike '%communication orale%' then 'COMMUNICATION_ORALE'
      when topic.title ilike '%oral%' then 'COMMUNICATION_ORALE'
      else 'LECTURE'
    end;
end $$;
