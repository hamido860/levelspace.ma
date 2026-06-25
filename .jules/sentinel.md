## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-06-25 - Fix unauthenticated resource exhaustion in AI endpoints
**Vulnerability:** The AI generation endpoints (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) allowed unauthenticated usage of platform AI credits because `resolveCredentialContext` could return a 'platform' mode without a `userId`. This allowed unauthenticated attackers to exhaust AI credits and perform Server-Side Request Forgery.
**Learning:** Context resolvers evaluate and return state but do not enforce authorization. Upstream route handlers must explicitly verify the resolved state (e.g., checking for `userId`) and return HTTP 401 if unauthorized.
**Prevention:** Always verify that a valid user identity exists in the resolved context when consuming billing-sensitive resources on behalf of the platform.
