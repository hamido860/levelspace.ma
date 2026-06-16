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

async function findPlaceholders() {
  const fileContent = fs.readFileSync("scratch/islamic_lessons.json", "utf-8");
  const lessons: Lesson[] = JSON.parse(fileContent);

  const urlPlaceholders: Lesson[] = [];
  const AIPlaceholders: Lesson[] = [];
  const otherLessons: Lesson[] = [];

  for (const lesson of lessons) {
    const content = lesson.content || "";
    if (content.includes("Source :") || content.includes("Cours de")) {
      urlPlaceholders.push(lesson);
    } else if (content.includes("الهدف:") && content.includes("تربط المعرفة الشرعية بالسلوك العملي")) {
      AIPlaceholders.push(lesson);
    } else {
      otherLessons.push(lesson);
    }
  }

  console.log(`=== Analysis of Lesson Content Styles ===`);
  console.log(`Total Lessons: ${lessons.length}`);
  console.log(`URL Placeholders (9rayti link shells): ${urlPlaceholders.length}`);
  console.log(`AI-Generated Template Placeholders (generic short templates): ${AIPlaceholders.length}`);
  console.log(`Other content types: ${otherLessons.length}`);

  console.log("\n--- Sample URL Placeholders ---");
  urlPlaceholders.slice(0, 10).forEach(l => {
    console.log(`- [${l.grade}] ${l.lesson_title} (ID: ${l.id})`);
  });

  console.log("\n--- Sample AI-Generated Template Placeholders ---");
  AIPlaceholders.slice(0, 10).forEach(l => {
    console.log(`- [${l.grade}] ${l.lesson_title} (ID: ${l.id}, Len: ${l.content?.length})`);
  });

  if (otherLessons.length > 0) {
    console.log("\n--- Sample Other Lessons ---");
    otherLessons.slice(0, 10).forEach(l => {
      console.log(`- [${l.grade}] ${l.lesson_title} (ID: ${l.id}, Len: ${l.content?.length})`);
      console.log(`  Content snippet: ${l.content?.substring(0, 150)}...`);
    });
  }
}

findPlaceholders().catch(console.error);
