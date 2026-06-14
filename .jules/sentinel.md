## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2024-06-14 - Fix unauthenticated platform credit usage
**Vulnerability:** Unauthenticated users could exhaust platform AI credits because `resolveCredentialContext` defaulted to a platform mode with `userId: undefined` when no auth token was provided, and the downstream AI handlers (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) did not explicitly reject this state before hitting the external provider APIs. This is a form of Server-Side Request Forgery (SSRF) and resource exhaustion.
**Learning:** Context resolvers like `resolveCredentialContext` evaluate state but don't strictly enforce authorization (they don't throw 401s). It is the responsibility of the specific downstream route handlers to verify that the returned credential state is permissible for the requested action.
**Prevention:** Always verify authentication explicitly in the route handler after resolving context. If a resource requires authentication (like platform AI credits), explicitly check `if (mode === 'platform' && !userId)` and return a 401 response early.
