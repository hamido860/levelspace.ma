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
