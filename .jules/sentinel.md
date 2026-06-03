## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-05-18 - Remove mock authentication backdoors in production
**Vulnerability:** The 'Demo Admin' login feature, intended to bypass authentication for local testing, was fully exposed in production builds. The UI buttons in `Login.tsx` and the local storage auto-login check in `AuthContext.tsx` lacked environment checks. This allowed anyone to access the admin pages without real server identity by clicking a button or setting a localStorage key.
**Learning:** Development-only auth bypasses or demo modes must always be strictly gated using `import.meta.env.DEV` at both the UI layer (to hide buttons) and the logic layer (to prevent programmatic exploitation) so they are removed from production builds.
**Prevention:** Always wrap any mock authentication, demo accounts, or dev-tooling logic with `import.meta.env.DEV` conditions during initial implementation to ensure Vite tree-shakes them out of production deployments.
