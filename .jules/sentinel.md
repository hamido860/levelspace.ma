## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-05-19 - Fix unauthenticated platform AI resource exhaustion
**Vulnerability:** The Vercel serverless functions for handling AI proxy requests (e.g., `handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) correctly resolved the credential context, but failed to actually verify authorization if the request was made using `credentialMode: "platform"` and the user was not authenticated (`!credentials.userId`).
**Learning:** Serverless routes that consume platform resources or perform operations on behalf of the platform must enforce strict authorization checks, checking the resolved credentials and explicitly throwing HTTP 401 Unauthorized errors if the context dictates it.
**Prevention:** Always verify authentication for sensitive contexts explicitly after calling resolution utilities like `resolveCredentialContext`.
