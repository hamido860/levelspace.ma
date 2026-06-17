## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2024-05-28 - [CRITICAL] Fix missing authentication check for platform AI endpoints
**Vulnerability:** The AI endpoint handlers (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) in `src/server/api/aiHandlers.ts` lacked proper authentication checks when the user requested platform credits (`credentialMode === 'platform'`).
**Learning:** This allowed unauthenticated users to make requests using the platform's AI credits, leading to resource exhaustion and potential Server-Side Request Forgery (SSRF) since the context resolver returned undefined `userId` without explicitly throwing an error.
**Prevention:** Always verify authentication explicitly in endpoint handlers when evaluating context resolver state for platform-credential requests. Do not rely solely on the context resolver to enforce HTTP 401 errors.
