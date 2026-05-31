## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-05-18 - Fix fake admin access through localStorage
**Vulnerability:** The `Login.tsx` page exposed a "Continue as Demo Admin" button that set `demo_admin_logged_in` in `localStorage`, which bypassed real authentication and allowed client-accessible admin functionality on the `/admin` route in production.
**Learning:** Client-side admin bypasses using `localStorage` flags can easily leak into production environments.
**Prevention:** Always strictly gate debug/demo features (especially those granting elevated roles) behind environment checks like `import.meta.env.DEV` to ensure they are excluded from production builds via tree-shaking.
