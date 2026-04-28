## 2026-04-28 - Removed hardcoded API key and added .env to .gitignore
**Vulnerability:** A hardcoded API key (`FALLBACK_NVIDIA_KEY`) was present in `api/ai-analyst.ts` and the `.env` file was committed to the repository, exposing secrets.
**Learning:** Hardcoded secrets and committing `.env` files expose sensitive information to anyone with access to the codebase, which can lead to unauthorized access and abuse.
**Prevention:** Use environment variables for sensitive information, ensure `.env` is added to `.gitignore`, and remove any hardcoded secrets from the source code.
