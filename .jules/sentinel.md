## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-06-22 - Fix unauthenticated SSRF in AI Embed endpoint
**Vulnerability:** The Vercel serverless function `handleAIEmbed` exposed an endpoint that consumed the Gemini API for embeddings but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** All proxy routes that forward to billing-sensitive third-party APIs (like OpenAI, Gemini, NVIDIA) must always have identical authentication checks as internal RPC calls.
**Prevention:** Always ensure `await resolveCredentialContext(req, body)` or `await requireAuthenticatedUser(req)` is called before proceeding to process the request payload or secrets in AI handlers.
