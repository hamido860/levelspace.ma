## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-05-26 - Missing Authentication on Sensitive AI Generation Endpoints
**Vulnerability:** The AI API handlers (`/api/ai/generate`, `/api/ai/explain`, `/api/ai/lesson-blocks`, `/api/ai/embed`) allowed unauthenticated clients to consume server-side platform API keys because the default fallback in `resolveCredentialContext` returned an anonymous profile, and the endpoints did not verify `userId`.
**Learning:** In the backend API architecture, context resolvers (like `resolveCredentialContext`) must strictly evaluate and return state. They should not enforce logic. It is the responsibility of specific downstream route handlers to enforce authorization by checking the resolved credentials and returning explicit 401s.
**Prevention:** Always verify `credentials.userId` immediately after context resolution inside protected route handlers to prevent unauthorized resource consumption.
