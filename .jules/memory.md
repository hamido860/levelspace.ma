## 2026-04-23 - App Settings & Supabase ID vs Name Resolution

**Issue:**
- 401 Unauthorized errors when fetching/inserting `app_settings` on mount because the code didn't check for an active user session before acting.
- 400 Bad Request errors when querying Supabase for `bac_tracks` due to passing the track name (string) into a UUID lookup via `.eq('id', ...)`. The Onboarding Modal occasionally sets the name instead of the ID.

**Learning:**
- **UUID Validation:** When dealing with fields that might sometimes store names and sometimes UUIDs, validate with regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)` before querying by ID.
- **Silent Failures for Roles:** If a component runs an `initSettings` function with an `upsert/insert` that expects `admin` permissions via Row-Level Security, first verify there is a valid session and specifically catch and ignore `PGRST116` (Results contain zero rows) errors without crashing.

**Prevention:**
- Always check `sessionData.session` before running operations that require authentication on mount.
- Add UUID format validation in components when local storage variables are prone to storing mixed data types (name or UUID).

## 2026-04-27 - [MEDIUM] Removed dead API endpoints in Admin view

**Issue:**
- Operations in the Admin Dashboard (retry job, delete row, edit task) were failing with a `405 Method Not Allowed` because `src/pages/Admin.tsx` was calling `adminPost('/api/admin/...')`. These backend Express routes or Vercel serverless functions never existed.

**Learning:**
- **Serverless Migration:** During a migration to Vercel Serverless Functions, some local frontend API wrapper functions (`adminPost`) were left pointing to non-existent custom backend routes instead of directly executing client-side Supabase operations.
- **Frontend Fallbacks:** For administrative dashboard panels, prefer using the authenticated Supabase client (`supabase.from(..).update(...)`) directly rather than building pass-through serverless functions for standard CRUD operations.

**Prevention:**
- Rely on Supabase's built-in Row Level Security (RLS) and the Javascript client for basic CRUD and admin operations rather than maintaining redundant API proxy endpoints.
