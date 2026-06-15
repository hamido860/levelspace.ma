## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-05-18 - Fix unauthenticated SSRF for platform AI credits
**Vulnerability:** The Vercel serverless functions `handleAIGenerate`, `handleAIExplain`, and `handleAILessonBlocks` in `src/server/api/aiHandlers.ts` failed to check if `userId` existed when `credentialMode` was `"platform"` after calling `resolveCredentialContext`. This could allow unauthenticated users to consume the application's native AI credits via SSRF / missing endpoint authorization.
**Learning:** `resolveCredentialContext` is a state-resolver that returns credentials (or undefined `userId`s). It doesn't automatically throw or return 401. Handlers must explicitly check the returned state.
**Prevention:** After calling credential/context resolvers in API routes, explicitly check the returned authentication state (e.g., `if (credentials.credentialMode === "platform" && !credentials.userId)`) and return a `401 Unauthorized` if conditions are unmet.
