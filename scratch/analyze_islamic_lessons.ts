import fs from "node:fs";

interface Lesson {
  id: string;
  grade: string;
  lesson_title: string;
  subject: string;
  content: string;
  blocks: any;
  validation_status: string;
  status: string;
  quality_score: number | null;
  exercises: any;
  quizzes: any;
}

async function analyze() {
  const fileContent = fs.readFileSync("scratch/islamic_lessons.json", "utf-8");
  const lessons: Lesson[] = JSON.parse(fileContent);

  console.log(`=== Analyzing ${lessons.length} Islamic Education Lessons ===`);

  // Group by grade
  const gradeCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const validationCounts: Record<string, number> = {};
  
  const emptyShells: Lesson[] = [];
  const richLessons: Lesson[] = [];

  for (const lesson of lessons) {
    gradeCounts[lesson.grade] = (gradeCounts[lesson.grade] || 0) + 1;
    statusCounts[lesson.status] = (statusCounts[lesson.status] || 0) + 1;
    validationCounts[lesson.validation_status] = (validationCounts[lesson.validation_status] || 0) + 1;

    // Check if empty shell
    // A shell is empty if content is very short (e.g. < 200 chars) or contains placeholders,
    // or status/validation_status indicate pending, or content is just the title.
    const cleanContent = lesson.content ? lesson.content.trim() : "";
    const isPlaceholder = 
      cleanContent.length < 300 || 
      cleanContent.includes("TBD") || 
      cleanContent.includes("placeholder") || 
      cleanContent.toLowerCase().includes("comming soon") ||
      (lesson.blocks && Array.isArray(lesson.blocks) && lesson.blocks.length <= 1) ||
      cleanContent === lesson.lesson_title;

    if (isPlaceholder) {
      emptyShells.push(lesson);
    } else {
      richLessons.push(lesson);
    }
  }

  console.log("\n--- Grade Distribution ---");
  console.log(JSON.stringify(gradeCounts, null, 2));

  console.log("\n--- Status Distribution ---");
  console.log(JSON.stringify(statusCounts, null, 2));

  console.log("\n--- Validation Status Distribution ---");
  console.log(JSON.stringify(validationCounts, null, 2));

  console.log(`\nEmpty Shells Count: ${emptyShells.length}`);
  console.log(`Rich Lessons Count: ${richLessons.length}`);

  // Sample empty shells
  console.log("\n--- Sample Empty Shells (First 5) ---");
  emptyShells.slice(0, 5).forEach(s => {
    console.log(`- [${s.grade}] ${s.lesson_title} (ID: ${s.id}, Status: ${s.status}, Content Length: ${s.content?.length || 0})`);
  });

  // Sample rich lessons
  console.log("\n--- Sample Rich Lessons (First 5) ---");
  richLessons.slice(0, 5).forEach(r => {
    console.log(`- [${r.grade}] ${r.lesson_title} (ID: ${r.id}, Content Length: ${r.content?.length || 0})`);
  });

  // Let's write the results summary to a JSON file for deeper inspector inspection
  const summary = {
    total: lessons.length,
    gradeCounts,
    statusCounts,
    validationCounts,
    emptyCount: emptyShells.length,
    richCount: richLessons.length,
    emptyShells: emptyShells.map(s => ({ id: s.id, grade: s.grade, title: s.lesson_title, status: s.status, len: s.content?.length || 0 })),
    richLessons: richLessons.map(r => ({ id: r.id, grade: r.grade, title: r.lesson_title, len: r.content?.length || 0 }))
  };

  fs.writeFileSync("scratch/analysis_summary.json", JSON.stringify(summary, null, 2), "utf-8");
  console.log("\nSaved summary stats to scratch/analysis_summary.json");
}

analyze().catch(console.error);
