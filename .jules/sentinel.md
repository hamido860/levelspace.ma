## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-05-18 - Fix unauthenticated SSRF for platform credits in AI handlers
**Vulnerability:** The AI generation handlers in `src/server/api/aiHandlers.ts` (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) used `resolveCredentialContext` but failed to enforce authentication when falling back to platform credits. This allowed unauthenticated users to abuse the system's platform credits without passing a `userId`.
**Learning:** Checking credentials is not enough; server endpoints must actively reject requests that attempt to use platform resources without a valid authenticated user session unless specifically designed for public use.
**Prevention:** After calling `resolveCredentialContext`, explicitly check `if (credentials.credentialMode === "platform" && !credentials.userId)` and return a 401 Unauthorized to prevent resource exhaustion and SSRF.
