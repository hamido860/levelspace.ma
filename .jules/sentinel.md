## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2024-05-28 - Platform AI Credits SSRF via Missing Auth Gate
**Vulnerability:** Server-Side Request Forgery (SSRF) allowing unauthenticated consumption of platform AI credits. `handleAIGenerate`, `handleAIExplain`, and `handleAILessonBlocks` in `src/server/api/aiHandlers.ts` did not verify authentication when users requested `credentialMode: "platform"`.
**Learning:** `resolveCredentialContext` correctly sets `userId` to `undefined` for unauthenticated requests, but it delegates the actual HTTP 401 response enforcement to downstream handlers. The handlers failed to explicitly reject `platform` requests lacking a `userId`, trusting the parsed context implicitly.
**Prevention:** Always verify authentication explicitly (`!credentials.userId`) in specific API route handlers after resolving context when restricting access to platform/paid resources. Do not assume context resolvers throw HTTP errors.
