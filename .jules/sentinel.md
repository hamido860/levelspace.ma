## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-02-27 - Unauthenticated Platform AI Credits Usage
**Vulnerability:** The AI generation endpoints (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) failed to enforce an authentication check when utilizing "platform" credentials, despite evaluating user tokens.
**Learning:** Returning `undefined` for `userId` inside `resolveCredentialContext` acts merely as state evaluation. Authorization enforcement must explicitly happen in the downstream route handlers to prevent Server-Side Request Forgery (SSRF) and resource exhaustion by unauthenticated actors when defaulting to platform-funded API keys.
**Prevention:** Always verify `if (credentials.credentialMode === 'platform' && !credentials.userId)` explicitly in serverless API routes before forwarding requests to external LLM providers.
