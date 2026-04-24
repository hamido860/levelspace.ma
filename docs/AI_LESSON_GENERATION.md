# AI Lesson Generation Logic

This document outlines how the AI lesson generation and background processing queue works within the application.

## 1. Lesson Generation Pipeline (`lessonService.ts`)

The AI lesson generation logic acts as a multi-tier pipeline that prioritizes caching and existing resources before falling back to heavy AI generation.

The entry point is `lessonService.fetchOrGenerate`, which takes parameters like `title`, `grade`, `country`, and `moduleId`.

### Tier 1: Local IndexedDB Cache
Before making any network requests, the system queries the local browser database (IndexedDB via Dexie) to see if the lesson is already cached locally.
- **Hit**: Returns immediately.
- **Miss**: Proceeds to the next tier.

### Tier 2: RAG (Retrieval-Augmented Generation) Search
If the lesson isn't local, it queries the global Supabase database using Vector Search.
- It looks for existing lessons across the platform that match the topic.
- **Hit**: If it finds a lesson with a very high similarity score (`> 0.9`), it retrieves it. This prevents regenerating the same lesson repeatedly and saves AI costs.
- **Miss**: Proceeds to AI Generation.

### Tier 3: AI Generation (`geminiService.ts`)
If the lesson truly doesn't exist, the system triggers Google's Gemini AI to generate it from scratch.

It constructs a highly specific prompt with strict rules:
*   **Search Forced**: The AI is explicitly instructed to use the Google Search tool to find official, up-to-date national curriculum and syllabus info.
*   **Language Strictness**: It must output 100% of the lesson in the native language of instruction for that country.
*   **Pedagogical Structure**: Forced structure: Definition -> Intuitive Example -> Rules -> Method Template -> Example with a clear conclusion. No "walls of text".
*   **Formatting Constraints**: LaTeX math, Markdown images, and strict length limits.
*   **Required Components**: Main lesson markdown, 2-3 step-by-step exercises, 2-3 multiple-choice quizzes, and 1 national-style exam question.

### Persistence & Parsing
Once the AI successfully returns the JSON lesson:
1.  **Save to RAG**: The new lesson is saved to the Supabase vector database so the next student hits Tier 2 instead of Tier 3.
2.  **Format for UI**: Raw JSON is transformed into UI blocks (Content, Examples, Quiz, Exam) and presented to the user.

---

## 2. Background Task Queue (`aiCrewService.ts`)

To prevent the app from freezing while waiting 10-30 seconds for Gemini to generate complex content, the app uses a **Task Queue** system.

### The Queue Manager
When a generation is requested, the app creates a "Task" and hands it to the `AICrewService`.
*   A task has a Type (e.g., `lesson_generation`), a Payload, and a Status (`pending`, `running`, `completed`, `failed`).
*   Tasks are added to an internal list and saved to `localStorage` to survive page refreshes.

### The Worker Loop
The service has a `processQueue` function acting as a background worker.
*   If busy, new requests wait in the queue.
*   If free, it takes the first `pending` task, marks it `running`, and calls the API (e.g., `generateFullLesson`).

### Execution & UI Updates
*   **Async Processing**: You can navigate the app while the task runs in the background.
*   **Completion**: Once Gemini finishes, the worker marks the task as `completed`.
*   **Notification**: A toast notification pops up indicating completion.
*   **Events**: A custom browser event (`ai-crew-update`) is dispatched. UI components listen to this event to fetch the new data instantly.
