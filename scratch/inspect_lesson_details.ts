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

async function inspect() {
  const fileContent = fs.readFileSync("scratch/islamic_lessons.json", "utf-8");
  const lessons: Lesson[] = JSON.parse(fileContent);

  // Sort by content length descending
  const sortedLessons = [...lessons].sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0));

  console.log("=== Top 5 Longest Lessons ===");
  sortedLessons.slice(0, 5).forEach(l => {
    console.log(`- [${l.grade}] ${l.lesson_title} (ID: ${l.id}, Content Length: ${l.content?.length || 0})`);
  });

  console.log("\n=== Top 5 Shortest Lessons ===");
  sortedLessons.slice(-5).forEach(l => {
    console.log(`- [${l.grade}] ${l.lesson_title} (ID: ${l.id}, Content Length: ${l.content?.length || 0})`);
  });

  // Let's print out the full details of the longest lesson
  const longest = sortedLessons[0];
  console.log(`\n=== Longest Lesson Details ===`);
  console.log(`Title: ${longest.lesson_title}`);
  console.log(`Grade: ${longest.grade}`);
  console.log(`Content:\n${longest.content}`);
  console.log(`Blocks:`, JSON.stringify(longest.blocks, null, 2));
  console.log(`Quizzes:`, JSON.stringify(longest.quizzes, null, 2));
  console.log(`Exercises:`, JSON.stringify(longest.exercises, null, 2));

  // Let's print out the details of a sample "Surah" lesson if we can find one.
  const surahLesson = lessons.find(l => l.lesson_title.includes("سورة"));
  if (surahLesson) {
    console.log(`\n=== Sample Surah Lesson Details ===`);
    console.log(`Title: ${surahLesson.lesson_title}`);
    console.log(`Grade: ${surahLesson.grade}`);
    console.log(`Content:\n${surahLesson.content}`);
    console.log(`Blocks:`, JSON.stringify(surahLesson.blocks, null, 2));
  }
}

inspect().catch(console.error);
