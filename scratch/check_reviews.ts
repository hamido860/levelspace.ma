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
  validation_notes: string | null;
  review_notes: string | null;
}

async function checkReviews() {
  const fileContent = fs.readFileSync("scratch/islamic_lessons.json", "utf-8");
  const lessons: Lesson[] = JSON.parse(fileContent);

  const scoredLessons = lessons.filter(l => l.quality_score !== null);
  const notedLessons = lessons.filter(l => l.validation_notes !== null || l.review_notes !== null);

  console.log(`Lessons with non-null quality_score: ${scoredLessons.length}`);
  console.log(`Lessons with non-null validation_notes or review_notes: ${notedLessons.length}`);
}

checkReviews().catch(console.error);
