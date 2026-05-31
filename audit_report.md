# Supabase Reality Found
The database contains the following tables holding the curriculum structure:
- `curricula`
- `cycles`
- `grades`
- `subjects`
- `grade_subjects`
- `bac_sections`
- `bac_tracks`
- `bac_international_options`

The real structure connects curricula -> cycles -> grades. Grades are connected to subjects via `grade_subjects`. Baccalaureate-specific information like sections, tracks, and options are stored in their respective tables (`bac_sections`, `bac_tracks`, `bac_international_options`) and only apply to the High School / Lycée cycle.

# Current Onboarding Behavior Found
The current onboarding logic exists in two main places:
1. `src/pages/Onboarding.tsx` - Uses a hardcoded array of grades ('Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'University / College', 'Post-Graduate Research') and directly saves string values without IDs.
2. `src/components/OnboardingModal.tsx` and `src/components/onboarding/*.tsx` - These files have conflicting implementations.
   - `OnboardingModal.tsx` attempts to query Supabase for cycles, grades, subjects, tracks, and options, but it stores both IDs and names inconsistently and manually determines whether to show tracks using `shouldShowTrackSelector` matching string names.
   - The files in `src/components/onboarding/` (e.g., `constants.ts`, `CycleStep.tsx`, `GradeStep.tsx`, `TrackStep.tsx`, `LanguageOptionStep.tsx`, `SummaryStep.tsx`) use completely hardcoded data from `constants.ts` for cycles (`primary`, `college`, `lycee`, `higher`), grades (mapped by cycle), tracks (mapped by grade), and options (hardcoded in `LanguageOptionStep.tsx`).

# Mismatches
1. **Cycles:**
   - App (`constants.ts`): Hardcoded 'Primary Education', 'Middle School', 'High School', 'Higher Education'.
   - Supabase: Uses actual cycle entries from the `cycles` table.
   - File: `src/components/onboarding/constants.ts`, `src/components/onboarding/CycleStep.tsx`
   - Fix: Query `cycles` from Supabase and use `cycle_id` and `name`.

2. **Grades:**
   - App (`constants.ts`, `Onboarding.tsx`): Hardcoded string arrays mapped to hardcoded cycles, or plain string arrays.
   - Supabase: Uses actual grade entries from the `grades` table, linked by `cycle_id`.
   - File: `src/components/onboarding/constants.ts`, `src/components/onboarding/GradeStep.tsx`, `src/pages/Onboarding.tsx`
   - Fix: Query `grades` based on selected `cycle_id`.

3. **Tracks / Specialties:**
   - App (`constants.ts`): Hardcoded tracks based on specific grade strings.
   - Supabase: Uses `bac_tracks` and `bac_sections` tables.
   - File: `src/components/onboarding/constants.ts`, `src/components/onboarding/TrackStep.tsx`
   - Fix: Only show if applicable (Lycée/Bac) and fetch from `bac_tracks`.

4. **Language Options (BIOF):**
   - App (`LanguageOptionStep.tsx`): Hardcoded options (Français (BIOF), Arabe (Général), Anglais (BIOF)).
   - Supabase: Uses `bac_international_options` table.
   - File: `src/components/onboarding/LanguageOptionStep.tsx`
   - Fix: Fetch from `bac_international_options` if applicable.

# Wrong files/queries
- `src/components/onboarding/constants.ts`: Contains hardcoded mappings that circumvent the database completely.
- `src/components/onboarding/*`: All step components rely on the hardcoded constants instead of props populated by Supabase queries.
- `src/pages/Onboarding.tsx`: Hardcoded grade list and completely detached from the multi-step flow or Supabase.
- `src/components/OnboardingModal.tsx`: Has queries but mixes up state with the detached `onboarding` directory components, or has duplicate UI logic (it implements its own UI rather than using `src/components/onboarding/*`). It also incorrectly assumes `bac_international_options` and `bac_tracks` are not connected to grades directly, and shows them based on hardcoded string matching.
- `src/server/api/aiCommandCenter.ts`: Assumes `lessons.track_id` (this doesn't exist).
- `src/server/api/aiCommandCenter.ts`: Assumes `lessons.title` rather than `lessons.lesson_title`.

# Recommended data-loading contract
- Cycles: `SELECT id, name, cycle_order FROM cycles ORDER BY cycle_order;`
- Grades (by cycle): `SELECT id, name, grade_order FROM grades WHERE cycle_id = ? ORDER BY grade_order;`
- Subjects (by grade): `SELECT s.id, s.name FROM subjects s JOIN grade_subjects gs ON gs.subject_id = s.id WHERE gs.grade_id = ? ORDER BY s.name;`
- Bac Tracks (if Lycée): `SELECT bt.id, bt.name, bt.track_order FROM bac_tracks bt ORDER BY bt.track_order;`
- Bac Options (if Lycée): `SELECT id, name FROM bac_international_options;`

# Exact files to edit next
- `src/components/onboarding/constants.ts` (Delete or heavily modify to remove hardcoded data)
- `src/components/onboarding/CycleStep.tsx` (Update to use Supabase props)
- `src/components/onboarding/GradeStep.tsx` (Update to use Supabase props)
- `src/components/onboarding/TrackStep.tsx` (Update to use Supabase props)
- `src/components/onboarding/LanguageOptionStep.tsx` (Update to use Supabase props)
- `src/components/onboarding/SummaryStep.tsx` (Update to display correct dynamic names)
- `src/components/OnboardingModal.tsx` (Fix queries, state management, and ensure it uses the refactored step components properly)
- `src/pages/Onboarding.tsx` (Refactor or remove if `OnboardingModal` is the primary entry point, or update to use the dynamic Supabase flow)
