# Levelspace Product Dictionary & Agent Rules

Levelspace is a full learning operating system. It is not just a content website or a diagnostic app.

## Core Modules & Vocabulary

Always strictly adhere to these definitions. Do not merge, rename, or delete these core modules.

1. **MyLevel**: Learner brain / diagnosis / roadmap.
2. **Classroom**: Learning environment / group and teacher space. (This is where subjects/topics appear, e.g., Math, French).
3. **Lesson View**: Focused content and practice experience. Do not delete Lesson View.
4. **Staff/Admin**: Teacher/admin/content-review/support layer. Do not delete Staff/Admin.
5. **Support Zone**: Adaptive help when learner struggles.
6. **LevelUp**: Daily recommended action.
7. **Library**: Content collection / learning resources / lessons / documents / exercises / RAG-backed materials.

## Strict Rules

- **DO NOT** merge Library with Classroom.
- **DO NOT** rename Library to Support Classroom.
- **DO NOT** use "Support Classroom" as a main navigation item.
- **DO NOT** delete Lesson View.
- **DO NOT** delete Classroom.
- **DO NOT** delete Staff/Admin.
- **DO NOT** replace the app with only MyLevel.

## Database Guidelines

The current database already has useful learner/content structures. Use these existing structures when possible before creating new ones:
- grades
- subjects
- topics
- skills
- lessons
- lesson_blocks
- exercises
- quizzes
- rag_chunks
- rag_questions
- student_answers
- student_progress
- user_skills
- ghost_interventions
- profiles with role field
