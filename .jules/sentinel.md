## 2024-05-24 - [Nvidia API Proxy Open to SSRF]
**Vulnerability:** The `/api/nvidia-proxy` endpoint in `api/[...slug].ts` lacks authentication, allowing unauthenticated attackers to hit the proxy endpoint and use our `NVIDIA_API_KEY`.
**Learning:** We need to explicitly check authentication for any serverless endpoints that proxy requests to external APIs that use internal API keys to prevent abuse (Server-Side Request Forgery / resource exhaustion).
**Prevention:** Make sure `requireAuthenticatedUser(req)` is called before proceeding in the proxy endpoint.
