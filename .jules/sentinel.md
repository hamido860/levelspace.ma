## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-02-21 - Command Injection via Word Splitting in `package.json` Scripts
**Vulnerability:** Environment variables within `package.json` scripts (e.g., `fn:secrets`) were used unquoted (`$VAR`), creating a medium-severity shell command injection risk if these variables contained shell metacharacters or whitespace, leading to unintended command execution.
**Learning:** Command injection can occur indirectly through script execution if variables passed to shell scripts via npm/yarn/pnpm scripts are not appropriately escaped or quoted. This is particularly prevalent in deploy/secret injection scripts.
**Prevention:** In `package.json` scripts, always wrap environment variables in escaped double quotes (`\"$VAR\"`) to prevent word splitting and command injection vulnerabilities.
