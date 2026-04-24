## 2024-04-24 - [Express Error Message Leakage]
**Vulnerability:** The global error handler in `server.ts` exposes internal exception messages (`err.message`) directly to the client API response on HTTP 500. This could leak sensitive internal states, stack traces, database schema details, or file paths.
**Learning:** Returning `err.message` in production API error handlers is an information disclosure risk. Use generic messages like "Internal Server Error" for 5xx status codes instead.
**Prevention:** Avoid passing raw Error objects or messages to `res.json()` in global catch-all handlers.
