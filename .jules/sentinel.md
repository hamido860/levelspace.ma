## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-02-28 - Fix Unauthenticated AI Endpoint SSRF and Credit Exhaustion
**Vulnerability:** The AI endpoints (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) using platform credits did not enforce authentication checks, relying solely on `resolveCredentialContext`. This allowed unauthenticated requests to exhaust AI credits and potentially cause SSRF.
**Learning:** `resolveCredentialContext` is a context resolver that returns unauthenticated state (e.g., `userId: undefined`) instead of throwing an error. Downstream route handlers must explicitly verify this state to enforce authorization.
**Prevention:** Explicitly check `if (credentials.credentialMode === 'platform' && !credentials.userId)` after resolving credentials and return a 401 Unauthorized response if the check fails.
