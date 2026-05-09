do $$
declare
  target_grade_id uuid;
  target_subject_id uuid;
begin
  select id
  into target_grade_id
  from public.grades
  where name = 'Tronc Commun'
  order by created_at asc
  limit 1;

  select id
  into target_subject_id
  from public.subjects
  where name = 'Mathématiques'
  order by created_at asc
  limit 1;

  if target_grade_id is null or target_subject_id is null then
    raise notice 'Skipping Tronc Commun Scientifique math seed because grade or subject is missing.';
    return;
  end if;

  insert into public.topics (grade_id, subject_id, title)
  select target_grade_id, target_subject_id, seed.title
  from (
    values
      ('Ensembles et raisonnement'),
      ('Fonctions affines et quadratiques'),
      ('Géométrie plane'),
      ('Statistiques'),
      ('Calcul numérique')
  ) as seed(title)
  where not exists (
    select 1
    from public.topics existing
    where existing.grade_id = target_grade_id
      and existing.subject_id = target_subject_id
      and lower(trim(existing.title)) = lower(trim(seed.title))
  );

  insert into public.lessons (
    country,
    cycle,
    grade,
    subject,
    lesson_title,
    content,
    topic_id,
    is_ai_generated
  )
  select
    'Morocco',
    'Lycée',
    'Tronc Commun',
    'Mathématiques',
    topic_seed.title,
    concat(
      'Repère de programme validé pour : ',
      topic_seed.title,
      '. Cette fiche confirme uniquement que ce thème appartient au Tronc Commun Scientifique au Maroc. ',
      'Le contenu pédagogique détaillé reste en attente de validation et de relecture avant diffusion finale.'
    ),
    topic_row.id,
    false
  from (
    values
      ('Ensembles et raisonnement'),
      ('Fonctions affines et quadratiques'),
      ('Géométrie plane'),
      ('Statistiques'),
      ('Calcul numérique')
  ) as topic_seed(title)
  join public.topics topic_row
    on topic_row.grade_id = target_grade_id
   and topic_row.subject_id = target_subject_id
   and lower(trim(topic_row.title)) = lower(trim(topic_seed.title))
  where not exists (
    select 1
    from public.lessons existing
    where existing.topic_id = topic_row.id
      and lower(trim(existing.lesson_title)) = lower(trim(topic_seed.title))
  );

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'curriculum_source_refs'
  ) then
    insert into public.curriculum_source_refs (
      country,
      cycle,
      grade,
      track,
      subject,
      topic_title,
      source_name,
      source_url,
      source_type,
      confidence_weight
    )
    select
      'Morocco',
      'Lycée',
      'Tronc Commun',
      'Tronc Commun Scientifique',
      'Mathématiques',
      seed.title,
      'MEN Maroc — Programme Tronc Commun',
      null,
      'official',
      0.9
    from (
      values
        ('Ensembles et raisonnement'),
        ('Fonctions affines et quadratiques'),
        ('Géométrie plane'),
        ('Statistiques'),
        ('Calcul numérique')
    ) as seed(title)
    where not exists (
      select 1
      from public.curriculum_source_refs existing
      where coalesce(existing.country, '') = 'Morocco'
        and coalesce(existing.grade, '') = 'Tronc Commun'
        and coalesce(existing.track, '') = 'Tronc Commun Scientifique'
        and coalesce(existing.subject, '') = 'Mathématiques'
        and lower(trim(coalesce(existing.topic_title, ''))) = lower(trim(seed.title))
    );
  end if;
end
$$;
