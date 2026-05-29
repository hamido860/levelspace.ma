## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-05-29 - Fix XSS vulnerability in dangerouslySetInnerHTML
**Vulnerability:** The Wikipedia article excerpts in `src/pages/LevelUp.tsx` were rendered directly using React's `dangerouslySetInnerHTML` without any prior sanitization. This allowed any malicious HTML returned from the Wikipedia search API (or if intercepted) to be executed as Cross-Site Scripting (XSS).
**Learning:** Never trust external API payloads implicitly, even from reputable sources like Wikipedia. React's `dangerouslySetInnerHTML` will execute embedded scripts if unsanitized.
**Prevention:** Always use a dedicated HTML sanitizer library like `dompurify` to clean external content before passing it to `dangerouslySetInnerHTML`.
