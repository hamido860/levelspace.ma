# AI Skill: Moroccan Curriculum Lesson Generation

## Objective
To autonomously and accurately generate high-quality educational lessons tailored to the official Moroccan curriculum. This skill defines the methodology, data sources, and constraints required for AI agents to transform "starter" or "stub" topics into comprehensive, localized lesson content.

## Data Sources & Context (Supabase)
The primary source of truth for the curriculum structure lies within the Supabase database. The AI must leverage these tables to understand the context of the lesson:

1.  **`curricula` & `cycles` & `grades`**: Defines the educational hierarchy.
    *   **Cycles:** Primary (الابتدائي), Middle School/College (الإعدادي), High School/Qualifying (التأهيلي).
    *   **Grades:** Ranging from 1st year primary to 2nd year Baccalaureate.
2.  **`subjects` & `grade_subjects`**: Links subjects (e.g., Mathematics, SVT, Physics-Chemistry) to specific grades.
3.  **`topics`**: The core syllabus items. Each topic represents a specific unit or lesson concept required by the curriculum for a given grade and subject.
4.  **`lessons`**: The global repository for generated content.
    *   **Target:** The agent targets rows where `status = 'draft'` and `tags` contains `'starter'` or `is_ai_generated = false`.
    *   **Reference:** Existing `content` in this table can be used as context (`existingContext`) to ensure consistency and avoid repetition.
5.  **`bac_tracks` & `bac_international_options`**: For high school, specifically defining standard tracks vs. International Baccalaureate (BIOF - French Option).

## Generation Methodology

### 1. Context Gathering (The Input)
Before generating content, the agent must gather:
*   **Topic:** The specific subject matter (e.g., "Théorème de Pythagore").
*   **Grade Level:** The exact year (e.g., "3ème Année Collège").
*   **Subject:** The discipline (e.g., "Mathématiques").
*   **Language/Option:** Determine if the lesson should be in Arabic (standard public school) or French (BIOF option for scientific subjects).

### 2. Prompt Engineering & Constraints
The AI prompt must enforce strict pedagogical rules specific to Morocco:
*   **Level Appropriateness:** Vocabulary, examples, and complexity must strictly match the Moroccan grade level. Do not provide high-school level explanations for a middle-school topic.
*   **Structure:**
    *   **Introduction/Situation Problème:** A real-world or theoretical hook relevant to a Moroccan student.
    *   **Core Concepts:** Clear definitions, rules, and theorems.
    *   **Examples:** Worked-out examples.
    *   **Exercises/Applications:** Practice problems.
*   **Language Consistency:** Math and Science (SVT, PC) for middle and high school are increasingly taught in French (BIOF). The prompt must enforce the correct language based on the grade/subject metadata.

### 3. Suggested Agent Workflow (Autonomous Generation)
1.  **Identify Target:** A scheduled job (e.g., `pg_cron`) queries the `lessons` table for a missing lesson (`status = 'draft'`).
2.  **Fetch Metadata:** The job retrieves the associated `topic`, `grade`, and `subject`.
3.  **Invoke AI:** The job calls the Supabase Edge Function (`generate-lessons`), passing the metadata.
4.  **AI Execution:** The Edge Function constructs the prompt (applying the constraints above) and calls the AI provider (Gemini/NVIDIA).
5.  **Validation & Insertion:** The generated JSON is validated against the required schema and updated in the `lessons` table, setting `status = 'published'` or `status = 'needs_review'`.

## Suggested Enhancements & Additional Resources
To improve the quality of AI-generated lessons, consider integrating the following into the agent's workflow:
*   **Official Pedagogical Guidelines (Les Orientations Pédagogiques):** Feed the AI with digitized excerpts of the official Moroccan Ministry of Education guidelines via RAG (Retrieval-Augmented Generation) using the `rag_chunks` table.
*   **Massar / Moutamadris Alignment:** Ensure the terminology aligns with the official portals.
*   **Regional Context:** Include examples that are culturally and geographically relevant to Morocco (e.g., using Dirhams, Moroccan cities, or local agricultural/geographical references in physics and biology examples).
