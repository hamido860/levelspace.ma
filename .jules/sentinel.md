## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-02-28 - [Fix shell command injection risk in package.json scripts]
**Vulnerability:** Shell Command Injection in `package.json` scripts
**Learning:** Found environment variables being interpolated into an npm shell script command without quotes (e.g., `GEMINI_API_KEY=$GEMINI_API_KEY`). Unquoted environment variable expansion in shell scripts makes them vulnerable to word splitting and globbing, potentially allowing argument injection or partial secret storage if the secret contains spaces or special characters.
**Prevention:** Always wrap shell environment variable substitutions in escaped double quotes (e.g., `"\"$VAR\""`) when they are part of a JSON string representing a shell command to ensure they are treated as a single literal argument.
