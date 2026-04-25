## 2025-02-18 - Missing redirectTo in Supabase OAuth
**Vulnerability:** Missing `redirectTo` parameter in `signInWithOAuth` calls.
**Learning:** When using OAuth login without a `redirectTo` parameter, the redirect behavior can be inconsistent across environments (e.g. localhost vs Vercel). The auth flow might redirect to the wrong origin.
**Prevention:** Always explicitly set the `redirectTo` option in `signInWithOAuth` using `window.location.origin`.
