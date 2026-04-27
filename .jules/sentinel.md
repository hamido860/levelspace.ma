
## 2024-05-01 - Hardcoded NVIDIA API Key and Exposed .env File
**Vulnerability:** A valid NVIDIA API key (`FALLBACK_NVIDIA_KEY`) was hardcoded directly into the serverless function `api/ai-analyst.ts` as a fallback. Furthermore, the `.env` file containing both the same NVIDIA API key and sensitive Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) was checked into source control because `.env` was missing from `.gitignore`.
**Learning:** Developers often hardcode credentials during prototyping ("Testing fallback") to speed up testing and then forget to remove them before deploying or pushing to version control. The lack of a comprehensive `.gitignore` from the start of a project easily leads to accidentally committing environment variable files. Even if the codebase is private, exposing keys in the repository creates a critical security risk (especially since `api-analyst.ts` could be run on a serverless provider like Vercel with billing attached).
**Prevention:**
1. Never commit API keys in code, even as fallbacks or test variables. Always use environment variables.
2. The very first step in initializing any Node.js/Vite project should be configuring `.gitignore` to explicitly ignore `.env` files.
3. If an API key is ever committed, it must be considered compromised and immediately rotated/revoked at the provider (NVIDIA in this case). Untracking the file does not remove it from Git history, so rotation is strictly required.
