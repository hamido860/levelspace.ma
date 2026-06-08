## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-02-27 - Unauthenticated AI Resource Exhaustion (SSRF)
**Vulnerability:** Core AI generation handlers (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`, `handleAIEmbed`) in `src/server/api/aiHandlers.ts` did not strictly enforce that platform credential contexts included an authenticated user ID.
**Learning:** `resolveCredentialContext` correctly resolved `platform` mode but didn't throw on unauthenticated requests. Downstream handlers blindly executed generation using server credentials, allowing unauthenticated users to exhaust AI resources or potentially trigger SSRF if arbitrary requests were permitted. Context resolvers should evaluate state; endpoints must enforce it.
**Prevention:** Always verify `if (credentials.credentialMode === 'platform' && !credentials.userId)` explicitly within the route handler logic before consuming external provider resources, returning HTTP 401 Unauthorized.
