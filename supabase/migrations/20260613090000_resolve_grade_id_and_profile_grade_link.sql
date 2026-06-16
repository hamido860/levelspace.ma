create extension if not exists unaccent;

alter table public.profiles
  add column if not exists grade_id uuid references public.grades(id) on delete set null,
  add column if not exists selected_grade_id uuid references public.grades(id) on delete set null,
  add column if not exists instruction_option_id uuid references public.bac_international_options(id) on delete set null,
  add column if not exists track_id uuid references public.bac_tracks(id) on delete set null,
  add column if not exists selected_option text;

alter table public.topics
  add column if not exists topic_order integer,
  add column if not exists instruction_option_id uuid references public.bac_international_options(id) on delete set null;

create index if not exists topics_grade_subject_instruction_option_order_idx
  on public.topics (grade_id, subject_id, instruction_option_id, topic_order);

create or replace function public.resolve_grade_id(raw_grade text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cleaned_grade text := nullif(btrim(raw_grade), '');
  resolved_grade_id uuid;
begin
  if cleaned_grade is null then
    return null;
  end if;

  if cleaned_grade ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id
      into resolved_grade_id
      from public.grades
      where id = cleaned_grade::uuid
      limit 1;

    if resolved_grade_id is not null then
      return resolved_grade_id;
    end if;
  end if;

  select id
    into resolved_grade_id
    from public.grades
    where lower(unaccent(name)) = lower(unaccent(cleaned_grade))
    order by created_at asc
    limit 1;

  return resolved_grade_id;
end;
$$;

revoke all on function public.resolve_grade_id(text) from public;
grant execute on function public.resolve_grade_id(text) to anon, authenticated, service_role;

create or replace function enforce_academic_lock()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.onboarding_completed = true and new.onboarding_completed = false and old.role != 'admin' then
    raise exception 'Cannot undo onboarding_completed.';
  end if;

  if old.onboarding_completed = true and old.role != 'admin' then
    if (new.selected_grade is distinct from old.selected_grade) or
       (new.grade_id is distinct from old.grade_id) or
       (new.selected_grade_id is distinct from old.selected_grade_id) or
       (new.instruction_option_id is distinct from old.instruction_option_id) or
       (new.track_id is distinct from old.track_id) or
       (new.selected_option is distinct from old.selected_option) or
       (new.selected_bac_track is distinct from old.selected_bac_track) then
      raise exception 'Academic identity is locked after onboarding.';
    end if;
  end if;

  return new;
end;
$$;
