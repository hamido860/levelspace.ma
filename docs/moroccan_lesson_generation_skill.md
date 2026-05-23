# AI Skill: Moroccan Curriculum Lesson Generation for Levelspace.ma

## Objective

Generate high-quality, curriculum-aligned Moroccan lessons for Levelspace.ma using Supabase as the source of truth. This skill defines how AI agents should transform curriculum topics into validated lesson records while respecting grade level, subject, language option, skills, RAG evidence, and review workflow.

The agent must not generate generic lessons. Every generated lesson must be grounded in the app database and aligned with the Moroccan curriculum structure.

---

## Non-Negotiable Rules

### 1. Supabase Is the Source of Truth

The agent must read curriculum structure from Supabase. It must not use hardcoded grade, subject, track, or language choices unless they already exist in the database.

Use these tables as the main source of truth:

```text
curricula
cycles
grades
subjects
grade_subjects
topics
topic_outlines
lessons
instruction_options
rag_chunks
skills
topic_skills
exercise_skills
lesson_generation_jobs
lesson_gen_queue
mcp_profiles
mcp_generation_runs
mcp_quality_checks
```

### 2. Do Not Confuse Academic Tracks With Instruction Options

The database separates academic tracks from language/instruction options.

| Concept | Correct table / column |
|---|---|
| Academic track | `bac_tracks.id` |
| Topic-to-academic-track relation | `topic_tracks.track_id -> bac_tracks.id` |
| Lesson-to-academic-track relation | `lesson_tracks.track_id -> bac_tracks.id` |
| Language / instruction option | `instruction_options.id` |
| Lesson language option | `lessons.instruction_option_id -> instruction_options.id` |
| RAG language option | `rag_chunks.instruction_option_id -> instruction_options.id` |
| User language option | `profiles.instruction_option_id -> instruction_options.id` |

Never insert an `instruction_options.id` into `topic_tracks.track_id` or `lesson_tracks.track_id`.

### 3. Lesson Coverage Is Variant-Based

Lesson coverage must be counted by:

```sql
topic_id + instruction_option_id
```

A topic can have multiple valid lesson variants.

Example:

| Grade | Subject | Topic | Instruction option |
|---|---|---|---|
| Tronc Commun | Physique-Chimie | Le courant électrique continu | `FR_BIOF` |
| Tronc Commun | Physique-Chimie | Le courant électrique continu | `AR` |

A French lesson does not cover the Arabic variant. An Arabic lesson does not cover the French/BIOF variant.

### 4. Do Not Infer Language From Subject Alone

The agent must not assume that a subject is always Arabic or always French.

Correct language source order:

```text
1. lessons.instruction_option_id
2. profiles.instruction_option_id
3. rag_chunks.instruction_option_id
4. instruction_options.language_code
```

Known instruction options:

| option_code | Meaning | language_code |
|---|---|---|
| `AR` | Arabic / standard Moroccan path | `ar` |
| `FR_BIOF` | French / BIOF option | `fr` |

Subjects such as Mathématiques and Physique-Chimie can exist in both Arabic and French depending on the instruction option.

### 5. No Auto-Publish

Generated lessons must not be automatically published.

Default generated lesson state:

```text
status = 'draft'
validation_status = 'needs_review'
quality_score = estimated score
source_confidence = estimated source confidence
```

Only admin review or a trusted validation workflow may set:

```text
status = 'published'
validation_status = 'passed'
```

---

## Target Detection

The agent should not only look for `lessons.status = 'draft'` or `tags` containing `starter`.

The correct missing-lesson query is variant-aware:

```sql
select
  t.id as topic_id,
  t.title,
  io.id as instruction_option_id,
  io.option_code
from public.topics t
join public.grades g on g.id = t.grade_id
join public.subjects s on s.id = t.subject_id
cross join public.instruction_options io
where g.name = :grade_name
  and s.name = :subject_name
  and io.option_code = :option_code
  and not exists (
    select 1
    from public.lessons l
    where l.topic_id = t.id
      and l.instruction_option_id = io.id
  );
```

Use this to identify missing lesson variants.

---

## Input Requirements

Before generating a lesson, the agent must gather:

| Input | Required | Source |
|---|---:|---|
| `topic_id` | Yes | `topics.id` |
| Topic title | Yes | `topics.title` |
| Grade | Yes | `grades.name` |
| Subject | Yes | `subjects.name` |
| Instruction option | Yes | `instruction_options.option_code` |
| Language code | Yes | `instruction_options.language_code` |
| Topic outline | Strongly preferred | `topic_outlines` |
| RAG evidence | Strongly preferred | `rag_chunks` |
| Skill mapping | Preferred | `topic_skills`, `skills` |
| Existing lesson context | Optional | `lessons` |

If critical metadata is missing, the agent must create a `needs_review` output rather than guessing.

---

## Skill Layer

Levelspace should support skill-aware lesson generation.

Skill tables:

| Table | Purpose |
|---|---|
| `skills` | Defines reusable learning skills by subject |
| `topic_skills` | Maps curriculum topics to skills |
| `exercise_skills` | Maps exercises to skills |
| `user_skills` | Tracks learner progress per skill |

If `skills` and `topic_skills` are empty for a subject, the agent should recommend or generate a skill taxonomy before advanced lesson generation.

Example skill taxonomy for Mathématiques:

```text
Number sense
Algebraic manipulation
Equation solving
Inequality reasoning
Vector reasoning
Geometric proof
Function interpretation
Trigonometric calculation
Statistical interpretation
```

Example skill taxonomy for Physique-Chimie:

```text
Scientific observation
Model interpretation
Formula use
Unit conversion
Diagram reading
Experimental reasoning
Electric circuit analysis
Chemical species identification
```

Generated exercises should be linked to skills whenever possible.

---

## RAG-First Generation Rule

For high-quality curriculum lessons, the agent should prefer RAG-grounded generation.

Use `rag_chunks` filtered by:

```text
grade_id
subject_id
topic_id
instruction_option_id
language
quality_status
review_status
is_active = true
```

Preferred chunks:

```sql
review_status in ('approved', 'embedded', 'clean', 'auto_repaired')
quality_status in ('good', 'needs_review')
```

Avoid chunks where:

```sql
review_status = 'rejected'
is_duplicate = true
is_active = false
quality_status = 'bad'
```

If no RAG evidence exists, the lesson may be generated as a starter lesson, but it must be marked:

```json
{
  "needs_rag_enrichment": true,
  "source_confidence": 0.45
}
```

---

## Lesson Output Schema

The generated lesson should fit the `lessons` table.

| Column | Rule |
|---|---|
| `country` | `Maroc` |
| `grade` | Use DB grade name |
| `cycle` | Use related cycle name when available |
| `subject` | Use DB subject name |
| `lesson_title` | Required. Never use `title` for official lessons |
| `subtitle` | Short objective or summary |
| `content` | Full lesson body |
| `blocks` | Structured JSON blocks |
| `exercises` | JSON exercises |
| `quizzes` | JSON quiz items |
| `is_ai_generated` | `true` |
| `topic_id` | Required |
| `tags` | Include grade, subject, language, variant |
| `teaching_contract` | JSON metadata |
| `instruction_option_id` | Required for variant-aware generation |
| `status` | Default `draft` |
| `validation_status` | Default `needs_review` |
| `quality_score` | Estimated score |
| `source_name` | Source or generation label |
| `source_confidence` | Evidence confidence |
| `generation_pipeline` | e.g. `admin_heavy` |

Important schema rule:

```text
Official curriculum lessons use lessons.lesson_title.
Do not query or insert lessons.title.
```

---

## Lesson Structure

Every generated lesson should include:

```text
1. Clear title
2. Learning objective
3. Situation problem or introductory hook
4. Core concepts and definitions
5. Rules, formulas, or theorems where relevant
6. Worked examples
7. Common mistakes
8. Practice exercises
9. Short quiz
10. Summary
11. Skill tags or concept tags
12. Source/evidence metadata
```

Recommended `blocks` format:

```json
[
  {
    "type": "text",
    "title": "Objectif",
    "content": "..."
  },
  {
    "type": "text",
    "title": "Cours",
    "content": "..."
  },
  {
    "type": "example",
    "title": "Exemple corrigé",
    "content": "..."
  },
  {
    "type": "summary",
    "title": "À retenir",
    "content": "..."
  }
]
```

Allowed `lesson_blocks.type` values:

```text
text
example
formula
summary
```

Do not insert unsupported block types unless the schema is updated first.

---

## Language Rules

### Arabic Variant

When `instruction_options.language_code = 'ar'`:

```text
Generate Arabic content.
Use Moroccan curriculum terminology.
Use right-to-left rendering in frontend.
```

Set metadata:

```json
{
  "language": "ar",
  "instruction_option": "AR",
  "variant": "arabic"
}
```

Recommended frontend rendering:

```html
<div lang="ar" dir="rtl"></div>
```

### French / BIOF Variant

When `instruction_options.option_code = 'FR_BIOF'`:

```text
Generate French content.
Use French scientific and mathematical terminology.
Keep Moroccan curriculum progression.
```

Set metadata:

```json
{
  "language": "fr",
  "instruction_option": "FR_BIOF",
  "variant": "french"
}
```

Recommended frontend rendering:

```html
<div lang="fr" dir="ltr"></div>
```

---

## Moroccan Curriculum Constraints

The lesson must respect:

```text
Moroccan grade level
Moroccan subject naming
Moroccan academic progression
Moroccan examples and context
Official terminology where available
Appropriate difficulty for the learner
```

Avoid:

```text
Foreign curriculum assumptions
University-level explanations for school topics
Generic AI filler
Mixing French and Arabic unless intentionally defining bilingual terminology
Generating advanced concepts before prerequisites
```

---

## Quality Gates

### Schema Validation

Validate that:

```text
lesson_title exists
topic_id exists
instruction_option_id exists
blocks is valid JSON
exercises is valid JSON
quizzes is valid JSON
block types are allowed
```

### Curriculum Validation

Validate that:

```text
Lesson topic matches topics.title
Subject matches the topic subject
Grade matches the topic grade
Language matches instruction_options.language_code
Difficulty is appropriate
```

### RAG Validation

Validate that:

```text
Sources match grade, subject, topic, and language
No rejected chunks are used
No duplicate or inactive chunks are used
Source confidence is recorded
```

### Pedagogical Validation

Validate that:

```text
Objective is clear
Definitions are correct
Examples are solved step by step
Exercises match the lesson objective
Common mistakes are realistic
Summary is concise
```

---

## Status Rules

Default output:

```text
status = 'draft'
validation_status = 'needs_review'
```

Use `validation_status = 'passed'` only after validation.

Use `status = 'published'` only after admin/human approval or trusted automated review.

Recommended status flow:

```text
draft -> review -> published
```

Recommended validation flow:

```text
unchecked -> needs_review -> passed
```

---

## Agent Workflow

### Step 1: Select Missing Variant

Find missing lesson by:

```text
grade + subject + topic + instruction_option
```

Do not select by topic alone.

### Step 2: Fetch Context

Fetch:

```text
Grade
Cycle
Subject
Topic
Topic outline
Instruction option
Existing related lessons
RAG chunks
Skills if available
```

### Step 3: Build Prompt

The prompt must include:

```text
Grade
Subject
Topic
Language option
Moroccan curriculum constraints
RAG evidence excerpts
Required JSON output schema
Quality rules
```

### Step 4: Generate Lesson

Generate a structured lesson with:

```text
content
blocks
exercises
quizzes
teaching_contract
skill tags
source metadata
```

### Step 5: Validate

Run schema, curriculum, language, RAG, and pedagogical checks.

### Step 6: Insert or Update

If no lesson exists for the variant, insert a new row.

If a lesson already exists for the same `topic_id + instruction_option_id`, update only if the new content is better or if the current lesson is a starter/stub.

### Step 7: Review Queue

Mark the lesson as:

```text
status = 'draft'
validation_status = 'needs_review'
```

Then surface it in the admin lesson review UI.

---

## Safe Insert Pattern

Use this uniqueness logic:

```sql
where not exists (
  select 1
  from public.lessons l
  where l.topic_id = :topic_id
    and l.instruction_option_id = :instruction_option_id
)
```

Do not insert duplicate lessons for the same topic and instruction option.

---

## Verification Queries

### Coverage by Subject and Instruction Option

```sql
select
  g.name as grade,
  s.name as subject,
  io.option_code,
  io.language_code,
  count(distinct t.id) as total_topics,
  count(distinct l.topic_id) as covered_topics,
  count(distinct t.id) - count(distinct l.topic_id) as missing_topics
from public.topics t
join public.grades g on g.id = t.grade_id
join public.subjects s on s.id = t.subject_id
cross join public.instruction_options io
left join public.lessons l
  on l.topic_id = t.id
 and l.instruction_option_id = io.id
where g.name = :grade_name
  and s.name = :subject_name
  and io.option_code = :option_code
group by g.name, s.name, io.option_code, io.language_code;
```

### Detect Lessons Missing Instruction Option

```sql
select
  l.id,
  l.lesson_title,
  l.grade,
  l.subject,
  t.title as topic_title
from public.lessons l
join public.topics t on t.id = l.topic_id
where l.instruction_option_id is null;
```

### Detect Duplicate Variant Lessons

```sql
select
  topic_id,
  instruction_option_id,
  count(*) as duplicates
from public.lessons
group by topic_id, instruction_option_id
having count(*) > 1;
```

---

## Security and Review Notes

Some content-support tables may be public-facing through Supabase. Do not enable or modify RLS policies blindly inside this skill.

If RLS is disabled on source, material, MCP, or quality tables, report it as a security issue and recommend a policy plan.

Do not auto-apply RLS migrations unless explicitly approved.

---

## What This Skill Must Prevent

The agent must prevent:

```text
Using lessons.title instead of lessons.lesson_title
Counting topic-level coverage only
Treating French lessons as covering Arabic variants
Treating Arabic lessons as covering BIOF variants
Writing instruction_options.id into topic_tracks.track_id
Writing instruction_options.id into lesson_tracks.track_id
Hardcoding BIOF for primary school
Letting onboarding show invalid grade/track/option combinations
Publishing generated lessons without review
Generating lessons without grade, subject, topic, and language metadata
```

---

## Recommended Next Improvements

```text
1. Seed skills for each subject
2. Map topic_skills for each topic
3. Generate exercises linked to exercise_skills
4. Add lesson review UI grouped by instruction option
5. Add coverage dashboard by grade + subject + instruction_option
6. Add RAG health score per lesson
7. Add official source evidence via lesson_source_evidence
8. Add duplicate detection for topic_id + instruction_option_id
9. Add frontend RTL/LTR rendering based on instruction_options.language_code
10. Add onboarding constraints driven only by Supabase tables
```

---

## Summary

A valid Levelspace lesson is not just a topic converted into text.

It is a curriculum-aware, language-aware, skill-aware, RAG-supported, reviewable learning object.

The correct generation identity is:

```text
grade + subject + topic + instruction_option
```

The most important database rule is:

```text
Use lessons.instruction_option_id for Arabic/French variants.
Use topic_tracks and lesson_tracks only for real bac_tracks.
```
