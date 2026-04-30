## 2024-05-01 - [Hardcoded NVIDIA API Key Vulnerability]
**Vulnerability:** Found a hardcoded fallback API key for NVIDIA API in `api/ai-analyst.ts` (`FALLBACK_NVIDIA_KEY = "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";`).
**Learning:** Hardcoded secrets in code pose a massive security risk. They bypass environment configuration, get exposed when the repository is shared, and can lead to unauthorized service usage and billing implications.
**Prevention:** Always use environment variables for sensitive keys and explicitly check for their presence. Do not include fallback keys in the code repository.
