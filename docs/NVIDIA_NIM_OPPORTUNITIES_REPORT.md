# NVIDIA API / NIM Opportunities for Levelspace

Date: 2026-04-26

Scope:
- No implementation changes in this report
- Focused on Levelspace use cases:
  - lesson generation
  - `rag_chunks` embeddings
  - reranking for retrieval
  - OCR / image handling for scanned curriculum PDFs
  - safety / topic control for the student AI Assistant

Current Levelspace baseline from the repo:
- NVIDIA is already used for chat generation via `https://integrate.api.nvidia.com/v1/chat/completions`
- Current key names in code:
  - `NVIDIA_API_KEY`
  - `VITE_NVIDIA_API_KEY`
- Current main NVIDIA model in code:
  - `google/gemma-3-27b-it`
- Embeddings are currently generated with Gemini, not NVIDIA
- `rag_chunks` already has a vector column and admin-facing fields for embedding workflow

## Executive Summary

NVIDIA is a strong fit for Levelspace in five areas:

1. Lesson generation:
   - Best near-term fit: keep `google/gemma-3-27b-it` as a managed NVIDIA fallback or shared primary generation path.
   - Best higher-quality self-host candidate: `meta/llama-3.3-70b-instruct`.

2. Embeddings:
   - Best production fit for multilingual school content: `nvidia/llama-nemotron-embed-1b-v2`.
   - Strong older alternative: `nvidia/llama-3.2-nv-embedqa-1b-v2`.
   - `nvidia/nv-embed-v1` is interesting but not ideal for production because the Build catalog page says non-commercial use only.

3. Reranking:
   - Best text rerank fit: `nvidia/llama-nemotron-rerank-1b-v2`.
   - Best multimodal rerank fit for scanned pages: `nvidia/llama-nemotron-rerank-vl-1b-v2`.

4. OCR / scanned curriculum PDFs:
   - Direct OCR option: `nvidia/nemoretriever-ocr-v1`.
   - Important caveat: NVIDIA marks it as nearing deprecation, so it is useful for evaluation, but risky as the long-term core ingestion path.
   - Better long-term multimodal retrieval path: store page images plus OCR text, then use `llama-nemotron-embed-vl-1b-v2` and `llama-nemotron-rerank-vl-1b-v2`.

5. Student AI Assistant safety:
   - Best standard moderation model: `nvidia/nemotron-3-content-safety`.
   - Best text-only moderation option: `nvidia/llama-3.1-nemotron-safety-guard-8b-v3`.
   - Best school-policy / curriculum-boundary option: `nvidia/llama-3.1-nemoguard-8b-topic-control`.
   - Best custom-policy option: `nvidia/nemotron-content-safety-reasoning-4b`.

## Arabic Support Status

Arabic support should be treated as a hard requirement for Levelspace.

- Explicitly supported in the official NVIDIA materials:
  - `google/gemma-3-27b-it` for generation:
    - NVIDIA documents multilingual support in over 140 languages.
  - `nvidia/llama-nemotron-embed-1b-v2` for embeddings:
    - NVIDIA says it was evaluated across 26 languages including Arabic.
  - `nvidia/llama-nemotron-rerank-1b-v2` for reranking:
    - NVIDIA says it was evaluated across 26 languages including Arabic.
  - `nvidia/llama-3.1-nemotron-safety-guard-8b-v3` for moderation:
    - NVIDIA explicitly lists Arabic among the supported languages.
  - `nvidia/nemotron-3-content-safety` for multimodal moderation:
    - NVIDIA explicitly lists Arabic among the supported languages.

- Not explicit enough in the official materials:
  - `nvidia/nemoretriever-ocr-v1` OCR docs describe the API and deployment path, but the reviewed pages do not clearly publish an Arabic language support matrix.
  - `nvidia/llama-3.1-nemoguard-8b-topic-control` is built on a multilingual base model, but the reviewed API page does not separately enumerate supported languages.

- Practical Levelspace implication:
  - generation, embeddings, reranking, and safety can move forward with Arabic as a supported target language.
  - OCR and topic-control should be validated with a real Arabic benchmark set before production rollout.

## 1. LLM Generation Models for Lesson Generation

### Option A: `google/gemma-3-27b-it`
- Availability:
  - Managed NVIDIA API Catalog endpoint
  - Build page labels it as a free endpoint
- Possible use in Levelspace:
  - generate full lessons
  - generate quizzes and exercises
  - analyze curriculum snippets or page images
  - good fit where one model should cover both text generation and image understanding
- Why it fits:
  - 128K context
  - multilingual support in over 140 languages
  - text plus image input
  - already used in the repo
  - good candidate for Arabic lesson generation and Arabic/French mixed prompts
- Required environment variables:
  - existing:
    - `NVIDIA_API_KEY`
    - `VITE_NVIDIA_API_KEY`
  - useful optional config names:
    - `NVIDIA_LLM_MODEL=google/gemma-3-27b-it`
    - `NVIDIA_LLM_BASE_URL=https://integrate.api.nvidia.com/v1`
- API endpoint style:
  - managed API:
    - `POST https://integrate.api.nvidia.com/v1/chat/completions`
  - body shape:
    - `model`
    - `messages`
    - `temperature`
    - `max_tokens`
    - optional `response_format`
- Expected schema changes:
  - none required
  - optional later:
    - store `generation_model`
    - store `generation_provider`
    - store `generation_latency_ms`
    - store `generation_token_usage`
- Risks / cost / limits:
  - free/trial endpoint may be rate-limited
  - not ideal for strict JSON every time without validation/repair
  - if used for scanned PDFs directly, extraction quality can vary versus dedicated OCR

### Option B: `meta/llama-3.3-70b-instruct`
- Availability:
  - downloadable NIM / self-host path
- Possible use in Levelspace:
  - high-quality lesson generation
  - admin-only curriculum analysis
  - long-form explanation generation
- Why it fits:
  - strong reasoning and math benchmarks
  - multilingual support
  - very strong candidate for premium generation quality
- Required environment variables:
  - self-host example:
    - `NGC_API_KEY`
    - `NVIDIA_LLM_SELFHOSTED_URL=http://<host>:8000/v1`
    - `NVIDIA_LLM_MODEL=meta/llama-3.3-70b-instruct`
- API endpoint style:
  - self-hosted NIM:
    - `POST http://<host>:8000/v1/chat/completions`
- Expected schema changes:
  - none required
  - optional model provenance columns same as Option A
- Risks / cost / limits:
  - high GPU memory requirement for self-hosting
  - operational complexity is much higher than the managed API Catalog path
  - likely overkill for every student request

### Option C: `nvidia/nemotron-mini-4b-instruct`
- Availability:
  - managed free endpoint
- Possible use in Levelspace:
  - quick classroom suggestions
  - lightweight student assistant
  - fallback for cheap low-latency admin helper tasks
- Why it fits:
  - optimized for RAG and function calling
  - smaller/faster than large generation models
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_SMALL_MODEL=nvidia/nemotron-mini-4b-instruct`
- API endpoint style:
  - `POST https://integrate.api.nvidia.com/v1/chat/completions`
- Expected schema changes:
  - none
- Risks / cost / limits:
  - not the best primary lesson writer
  - more suitable as a secondary assistant model than a curriculum authoring model

### Recommendation for Levelspace
- Near-term:
  - keep `google/gemma-3-27b-it` as the main NVIDIA lesson-generation option
- Mid-term:
  - separate model roles:
    - large model for lesson authoring
    - smaller model for student chat and admin helper flows

## 2. Embedding Models for `rag_chunks`

### Option A: `nvidia/llama-nemotron-embed-1b-v2`
- Availability:
  - official NVIDIA API reference
  - downloadable NIM / self-host path
- Possible use in Levelspace:
  - replace Gemini embeddings for `rag_chunks`
  - index lesson chunks, OCR text, topic summaries, and admin-curated curriculum fragments
- Why it fits:
  - multilingual and cross-lingual retrieval
  - up to 8192 tokens
  - Matryoshka embedding support
  - output dimensions can be `384`, `512`, `768`, `1024`, or `2048`
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_EMBED_MODEL=nvidia/llama-nemotron-embed-1b-v2`
  - `NVIDIA_EMBED_DIM=1024` or `2048`
  - optional:
    - `NVIDIA_EMBED_BASE_URL=https://integrate.api.nvidia.com/v1`
- API endpoint style:
  - managed API:
    - `POST https://integrate.api.nvidia.com/v1/embeddings`
  - typical body:
    - `model`
    - `input`
    - `input_type` such as `query` or `passage`
    - `encoding_format`
    - optional dimension/truncation parameters depending on deployment
- Expected schema changes:
  - likely yes if you use dimensions other than current 768
  - current repo schema shows:
    - `embedding vector(768)`
  - if you pick 1024 or 2048:
    - add a new vector column or migrate to a larger vector size
  - recommended additive path:
    - keep legacy `embedding` as deprecated if needed
    - add `embedding_v2 vector(1024)` or `embedding_v2 vector(2048)`
    - add `embedding_model text`
    - add `embedding_dim integer`
- Risks / cost / limits:
  - dimension migration is the main technical risk
  - must re-embed existing data if switching retrieval space
  - longer chunks still need good chunking strategy

### Option B: `nvidia/llama-3.2-nv-embedqa-1b-v2`
- Availability:
  - official NVIDIA API reference
- Possible use in Levelspace:
  - same role as Option A
  - easier conceptual replacement for current QA-style retrieval
- Why it fits:
  - multilingual and cross-lingual
  - supports dynamic output dimensions
  - NVIDIA notes large storage reduction potential through Matryoshka embeddings
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_EMBED_MODEL=nvidia/llama-3.2-nv-embedqa-1b-v2`
  - `NVIDIA_EMBED_DIM=768|1024|2048`
- API endpoint style:
  - `POST https://integrate.api.nvidia.com/v1/embeddings`
- Expected schema changes:
  - same as Option A
- Risks / cost / limits:
  - good candidate, but the newer `llama-nemotron-embed-1b-v2` is the cleaner forward-looking choice

### Option C: `nvidia/nv-embed-v1`
- Availability:
  - managed API Catalog model
- Possible use in Levelspace:
  - semantic search and clustering
- Why it is less attractive here:
  - the Build page explicitly says non-commercial use only
  - 4096-dimensional embeddings are heavy for pgvector storage
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_EMBED_MODEL=nvidia/nv-embed-v1`
- API endpoint style:
  - `POST https://integrate.api.nvidia.com/v1/embeddings`
- Expected schema changes:
  - large vector dimension change if adopted
- Risks / cost / limits:
  - licensing limitation is the main blocker for production Levelspace

### Recommendation for Levelspace
- Best production candidate:
  - `nvidia/llama-nemotron-embed-1b-v2`
- Best migration strategy:
  - do not overwrite old vectors immediately
  - add a new embedding column and dual-read during evaluation
- Arabic note:
  - this is the cleanest embedding option in the report for Arabic, French, and mixed-language curriculum retrieval because NVIDIA explicitly evaluated it on Arabic

## 3. Reranking Models for Better Context Retrieval

### Option A: `nvidia/llama-nemotron-rerank-1b-v2`
- Availability:
  - official NVIDIA API reference
  - downloadable NIM / self-host path
- Possible use in Levelspace:
  - rerank top 20-50 chunks after pgvector retrieval
  - improve lesson generation grounding
  - improve student AI Assistant answer relevance
  - especially useful for mixed Arabic/French/English curriculum content
- Why it fits:
  - multilingual and cross-lingual
  - long-document support up to 8192 tokens
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_RERANK_MODEL=nvidia/llama-nemotron-rerank-1b-v2`
  - optional:
    - `NVIDIA_RERANK_BASE_URL=https://ai.api.nvidia.com`
- API endpoint style:
  - managed API:
    - `POST https://ai.api.nvidia.com/v1/retrieval/nvidia/llama-nemotron-rerank-1b-v2/reranking`
  - self-hosted NIM:
    - `POST http://<host>:8000/v1/ranking`
  - body shape:
    - `model`
    - `query`
    - `passages`
- Expected schema changes:
  - none required
  - optional:
    - cache rerank scores in transient logs or analytics tables
- Risks / cost / limits:
  - adds another network hop
  - increases request latency
  - should only rerank top-K candidates, not the whole corpus

### Option B: `nvidia/llama-nemotron-rerank-vl-1b-v2`
- Availability:
  - official NVIDIA API reference
- Possible use in Levelspace:
  - rerank scanned PDF pages stored as images
  - improve curriculum retrieval when page layout, tables, and charts matter
- Why it fits:
  - designed for multimodal question-answer retrieval
  - works on image, text, or image+text documents
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_RERANK_VL_MODEL=nvidia/llama-nemotron-rerank-vl-1b-v2`
- API endpoint style:
  - multimodal retrieval/reranking style endpoint depending on deployment
  - practically this is a second-stage page reranker after image/text retrieval
- Expected schema changes:
  - optional only
  - if adopted, helpful columns include:
    - `rag_chunks.page_number`
    - `rag_chunks.page_image_url`
    - `rag_chunks.ocr_text`
- Risks / cost / limits:
  - more storage and ingest complexity
  - strongest value only if Levelspace stores page images, not just extracted text

### Recommendation for Levelspace
- Best first reranker:
  - `nvidia/llama-nemotron-rerank-1b-v2`
- Best multimodal extension:
  - `nvidia/llama-nemotron-rerank-vl-1b-v2` for scanned page workflows
- Arabic note:
  - `llama-nemotron-rerank-1b-v2` is a strong fit for Arabic retrieval because NVIDIA explicitly evaluated it on Arabic

## 4. OCR / Image Models for Scanned Curriculum PDFs

### Option A: `nvidia/nemoretriever-ocr-v1`
- Availability:
  - downloadable NIM
  - official OCR API docs
- Possible use in Levelspace:
  - extract text from scanned curriculum pages
  - preserve bounding boxes and confidence scores
  - ingest raw textbook/curriculum scans before chunking
- Why it fits:
  - purpose-built OCR
  - supports text detection and recognition
  - good fit for curriculum ingestion pipelines
- Required environment variables:
  - self-hosted service:
    - `NGC_API_KEY`
    - `OCR_HTTP_ENDPOINT=http://<host>:8000/v1/infer`
    - `OCR_GRPC_ENDPOINT=<host>:8001`
    - `OCR_INFER_PROTOCOL=grpc|http`
    - `OCR_MODEL_NAME=scene_text_ensemble`
  - app-level optional:
    - `NVIDIA_OCR_ENABLED=true`
- API endpoint style:
  - self-hosted OCR NIM:
    - `POST http://<host>:8000/v1/infer`
  - body shape:
    - `input: [{ type: "image_url", url: "data:image/png;base64,..." }]`
- Expected schema changes:
  - likely yes if OCR becomes first-class
  - possible additive columns on `rag_chunks`:
    - `ocr_text text`
    - `ocr_confidence numeric`
    - `page_number integer`
    - `bbox jsonb`
    - `page_image_url text`
    - `ingest_source_type text`
  - or create a separate table:
    - `pdf_pages`
    - `pdf_page_ocr_blocks`
- Risks / cost / limits:
  - NVIDIA marks this model as nearing deprecation
  - that makes it risky as the long-term default
  - scanned math formulas and dense tables may still need secondary cleanup
  - Arabic OCR quality is not clearly guaranteed by the reviewed docs, so Arabic scanned-PDF accuracy must be tested directly

### Option B: `google/gemma-3-27b-it` for page understanding
- Availability:
  - managed chat completion API
- Possible use in Levelspace:
  - page-level "explain this page" or "extract syllabus items from this page"
  - visual QA over scans
- Why it fits:
  - already in use
  - can accept image plus prompt
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_LLM_MODEL=google/gemma-3-27b-it`
- API endpoint style:
  - `POST https://integrate.api.nvidia.com/v1/chat/completions`
- Expected schema changes:
  - none required for experimentation
  - optional artifact storage:
    - `extracted_structured_json jsonb`
- Risks / cost / limits:
  - not a dedicated OCR system
  - output can be less deterministic than OCR APIs

### Option C: multimodal retrieval pair
- Models:
  - `nvidia/llama-nemotron-embed-vl-1b-v2`
  - `nvidia/llama-nemotron-rerank-vl-1b-v2`
- Possible use in Levelspace:
  - store curriculum page images and OCR text
  - retrieve by user question even when layout matters
  - useful for tables, diagrams, charts, and mixed text/image pages
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_VL_EMBED_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2`
  - `NVIDIA_VL_RERANK_MODEL=nvidia/llama-nemotron-rerank-vl-1b-v2`
- API endpoint style:
  - multimodal embedding and multimodal reranking endpoints depending on deployment
- Expected schema changes:
  - yes, if page images become first-class retrieval artifacts
  - recommended additive fields:
    - `page_image_url`
    - `page_number`
    - `ocr_text`
    - `modality text`
- Risks / cost / limits:
  - more storage
  - more ingestion complexity
  - stronger retrieval quality for scanned documents than text-only RAG

### Recommendation for Levelspace
- Short-term:
  - evaluate `nemoretriever-ocr-v1` only as a pilot because of deprecation risk
- Better long-term direction:
  - page image + OCR text + multimodal embedding/rerank

## 5. Safety / Topic-Control Models for Student AI Assistant

### Option A: `nvidia/nemotron-3-content-safety`
- Availability:
  - managed free endpoint
- Possible use in Levelspace:
  - pre-check student prompts
  - post-check assistant responses
  - moderate multimodal prompts if image input is later added
- Why it fits:
  - multilingual
  - multimodal
  - can classify both prompt and response
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_SAFETY_MODEL=nvidia/nemotron-3-content-safety`
- API endpoint style:
  - model-specific NVIDIA inference endpoint
  - practically used like a classification chat call with structured prompt/output
- Expected schema changes:
  - none required
  - optional audit table or columns:
    - `safety_status`
    - `safety_categories`
    - `blocked_reason`
- Risks / cost / limits:
  - moderation quality still needs policy tuning and evaluation on school-specific cases
  - should not be the only protection layer

### Option B: `nvidia/llama-3.1-nemotron-safety-guard-8b-v3`
- Availability:
  - official API reference
- Possible use in Levelspace:
  - text-only moderation for chat input/output
  - detect unsafe categories such as violence, sexual content, PII, harassment
- Why it fits:
  - 23 safety categories
  - multilingual
  - more mature text-only guard pattern
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_SAFETY_MODEL=nvidia/llama-3.1-nemotron-safety-guard-8b-v3`
- API endpoint style:
  - prompt/classifier style LLM call
- Expected schema changes:
  - optional logging columns only
- Risks / cost / limits:
  - text-only
  - does not solve topic-boundary control by itself

### Option C: `nvidia/llama-3.1-nemoguard-8b-topic-control`
- Availability:
  - official API reference
- Possible use in Levelspace:
  - keep student assistant on-topic:
    - learning help
    - lesson explanation
    - study planning
  - reject distractor or out-of-scope prompts
  - enforce "education-only" behavior
- Why it fits:
  - explicitly designed for topical moderation
  - good match for student assistant boundaries
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_TOPIC_CONTROL_MODEL=nvidia/llama-3.1-nemoguard-8b-topic-control`
- API endpoint style:
  - prompt/classifier style LLM call
  - or via NeMo Guardrails configuration
- Expected schema changes:
  - none required
  - optional log fields:
    - `topic_control_status`
    - `topic_policy_version`
- Risks / cost / limits:
  - policy prompt design matters a lot
  - false positives can hurt UX if rules are too strict

### Option D: `nvidia/nemotron-content-safety-reasoning-4b`
- Availability:
  - official API reference
- Possible use in Levelspace:
  - enforce custom school policies
  - nuanced moderation:
    - allow age-appropriate biology
    - block harmful self-harm guidance
    - allow math/chemistry problem solving while blocking dangerous procedural misuse
- Why it fits:
  - bring-your-own-policy model
  - reasoning-on and reasoning-off modes
- Required environment variables:
  - `NVIDIA_API_KEY`
  - `NVIDIA_POLICY_MODEL=nvidia/nemotron-content-safety-reasoning-4b`
- API endpoint style:
  - classification / guardrail-style inference call
- Expected schema changes:
  - optional:
    - `policy_name`
    - `policy_decision`
    - `policy_explanation`
- Risks / cost / limits:
  - more prompt/policy design work
  - may add latency compared with simpler safety guards

### Guardrails service option
- NVIDIA also documents NeMo Guardrails as an orchestration layer around safety/topic-control models.
- Possible use in Levelspace:
  - one guarded endpoint for the student assistant
  - combine:
    - content safety
    - topic control
    - jailbreak protection
    - retrieval grounding
- Required environment variables:
  - likely self-hosted/service config variables rather than simple per-model keys
  - app-level examples:
    - `NVIDIA_GUARDRAILS_URL=http://<host>:8000/v1`
    - `NVIDIA_GUARDRAILS_CONFIG=content-safety` or custom config
- API endpoint style:
  - `POST /v1/chat/completions` on the NeMo Guardrails server
- Expected schema changes:
  - none required
  - optional guardrail audit logs table
- Risks / cost / limits:
  - more moving parts
  - best when Levelspace is ready to formalize safety policy and observability

## Suggested Environment Variable Plan

These are not implementation instructions yet. They are a clean naming proposal for later:

- `NVIDIA_API_KEY`
- `NVIDIA_LLM_BASE_URL`
- `NVIDIA_LLM_MODEL`
- `NVIDIA_SMALL_MODEL`
- `NVIDIA_EMBED_BASE_URL`
- `NVIDIA_EMBED_MODEL`
- `NVIDIA_EMBED_DIM`
- `NVIDIA_RERANK_BASE_URL`
- `NVIDIA_RERANK_MODEL`
- `NVIDIA_VL_EMBED_MODEL`
- `NVIDIA_VL_RERANK_MODEL`
- `NVIDIA_SAFETY_MODEL`
- `NVIDIA_TOPIC_CONTROL_MODEL`
- `NVIDIA_POLICY_MODEL`
- `NVIDIA_GUARDRAILS_URL`
- `NVIDIA_OCR_ENABLED`
- `OCR_HTTP_ENDPOINT`
- `OCR_GRPC_ENDPOINT`
- `OCR_INFER_PROTOCOL`
- `OCR_MODEL_NAME`

## Expected Schema Change Summary

No schema changes are required just to evaluate managed NVIDIA generation models.

Schema changes become likely in these cases:

### If Levelspace switches embeddings from Gemini to NVIDIA
- current vector size in repo schema is `768`
- NVIDIA production candidate embeddings are better suited to `1024` or `2048`
- safest path:
  - add a new vector column
  - preserve the old one as legacy
  - add metadata columns:
    - `embedding_model`
    - `embedding_dim`
    - `embedded_at`

### If Levelspace adds OCR/page-aware retrieval
- likely additive fields for `rag_chunks` or a new page table:
  - `page_number`
  - `page_image_url`
  - `ocr_text`
  - `ocr_confidence`
  - `bbox`
  - `modality`

### If Levelspace logs guardrail decisions
- add an audit table rather than mutating core lesson tables:
  - `assistant_guardrail_events`
  - fields:
    - `user_id`
    - `prompt_hash`
    - `model_name`
    - `guardrail_type`
    - `decision`
    - `categories`
    - `created_at`

## Recommended Next Evaluation Order

1. Generation:
   - validate `google/gemma-3-27b-it` against current lesson prompts
   - include Arabic-only and Arabic/French mixed prompt sets

2. Embeddings:
   - pilot `nvidia/llama-nemotron-embed-1b-v2`
   - compare retrieval quality versus current Gemini embeddings on a fixed sample set
   - use Arabic, French, and mixed Arabic/French chunk-query pairs

3. Reranking:
   - add `nvidia/llama-nemotron-rerank-1b-v2` after vector retrieval
   - measure answer grounding lift before changing storage
   - specifically score Arabic query to Arabic chunk relevance and mixed-language queries

4. Safety:
   - pilot `nvidia/llama-3.1-nemoguard-8b-topic-control`
   - then combine with `nvidia/nemotron-3-content-safety`
   - include Arabic student prompts in the moderation test set

5. OCR:
   - treat `nvidia/nemoretriever-ocr-v1` as a short pilot only
   - evaluate a longer-term page-image retrieval architecture instead of anchoring on a deprecated OCR service
   - require a dedicated Arabic scanned-PDF benchmark before any production use

## Source Links

Generation:
- Gemma 3 27B IT model card: https://build.nvidia.com/google/gemma-3-27b-it/modelcard
- Gemma 3 27B API reference: https://docs.api.nvidia.com/nim/reference/google-gemma-3-27b-it
- Chat completions endpoint: https://docs.api.nvidia.com/nim/reference/google-gemma-3-27b-it-infer
- Llama 3.3 70B model card: https://build.nvidia.com/meta/llama-3_3-70b-instruct/modelcard

Embeddings:
- Llama Nemotron Embed 1B v2 model/API reference: https://docs.api.nvidia.com/nim/reference/nvidia-llama-nemotron-embed-1b-v2
- Embeddings endpoint example: https://docs.api.nvidia.com/nim/reference/nvidia-llama-nemotron-embed-1b-v2-infer
- Llama 3.2 NV EmbedQA 1B v2: https://docs.api.nvidia.com/nim/reference/nvidia-llama-3_2-nv-embedqa-1b-v2
- NV-Embed v1: https://docs.api.nvidia.com/nim/reference/nvidia-nv-embed-v1

Reranking:
- Llama Nemotron Rerank 1B v2: https://docs.api.nvidia.com/nim/reference/nvidia-llama-nemotron-rerank-1b-v2
- Managed reranking endpoint example: https://docs.api.nvidia.com/nim/reference/nvidia-llama-nemotron-rerank-1b-v2-infer
- Self-hosted reranking API docs: https://docs.nvidia.com/nim/nemo-retriever/text-reranking/latest/reference.html
- Reranking usage examples: https://docs.nvidia.com/nim/nemo-retriever/text-reranking/latest/using-reranking.html
- Multimodal rerank: https://docs.api.nvidia.com/nim/reference/nvidia-llama-nemotron-rerank-vl-1b-v2

OCR / multimodal ingestion:
- NeMo Retriever OCR deploy page: https://build.nvidia.com/nvidia/nemoretriever-ocr-v1/deploy
- OCR API docs: https://docs.nvidia.com/nim/ingestion/image-ocr/latest/api-reference.html
- OCR config guide in NVIDIA RAG blueprint: https://docs.nvidia.com/rag/latest/nemoretriever-ocr.html
- Multimodal embed model: https://docs.api.nvidia.com/nim/reference/nvidia-llama-nemotron-embed-vl-1b-v2

Safety / topic control / guardrails:
- Nemotron 3 Content Safety: https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-content-safety
- Llama 3.1 Nemotron Safety Guard 8B v3: https://docs.api.nvidia.com/nim/reference/nvidia-llama-3_1-nemotron-safety-guard-8b-v3
- Llama 3.1 Nemotron Safety Guard Multilingual 8B v1: https://docs.api.nvidia.com/nim/reference/nvidia-llama-3_1-nemotron-safety-guard-multilingual-8b-v1
- Llama 3.1 NemoGuard Topic Control: https://docs.api.nvidia.com/nim/reference/nvidia-llama-3_1-nemoguard-8b-topic-control
- Nemotron Content Safety Reasoning 4B: https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-content-safety-reasoning-4b
- NeMo Guardrails content safety guide: https://docs.nvidia.com/nemo/guardrails/latest/configure-rails/guardrail-catalog/content-safety.html
- NeMo Guardrails topic control guide: https://docs.nvidia.com/nemo/guardrails/latest/configure-rails/guardrail-catalog/topic-control.html
- NeMo Guardrails API server endpoints: https://docs.nvidia.com/nemo/guardrails/latest/reference/api-server-endpoints/index.html

