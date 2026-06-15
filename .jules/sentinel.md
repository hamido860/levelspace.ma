## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-05-18 - Fix missing authorization on AI generation endpoints
**Vulnerability:** The Vercel serverless AI endpoints (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) used `resolveCredentialContext` which returns a default unauthenticated state for platform credentials (`userId: undefined`). The handlers failed to explicitly check this state, allowing unauthenticated requests to consume backend platform AI API credits (SSRF risk).
**Learning:** Context resolvers are designed to strictly return state and not throw HTTP errors. Downstream route handlers are responsible for evaluating the resolved context and enforcing authorization before proceeding.
**Prevention:** When utilizing platform AI credits, explicitly verify authentication by checking `if (credentials.credentialMode === 'platform' && !credentials.userId)` after calling `resolveCredentialContext`, and return a 401 Unauthorized if the check fails.
