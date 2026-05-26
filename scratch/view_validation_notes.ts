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
  validation_notes: any;
}

async function viewNotes() {
  const fileContent = fs.readFileSync("scratch/islamic_lessons.json", "utf-8");
  const lessons: Lesson[] = JSON.parse(fileContent);

  console.log("=== Validation Notes Examples ===");

  // Find a lesson with score 0
  const zeroScore = lessons.find(l => l.quality_score === 0);
  if (zeroScore) {
    console.log(`\nSample with Quality Score = 0: [${zeroScore.grade}] ${zeroScore.lesson_title}`);
    console.log(`Validation Notes:`, JSON.stringify(zeroScore.validation_notes, null, 2));
  }

  // Find a lesson with score 0.7 or 0.62
  const nonZero = lessons.find(l => l.quality_score !== 0);
  if (nonZero) {
    console.log(`\nSample with Quality Score = ${nonZero.quality_score}: [${nonZero.grade}] ${nonZero.lesson_title}`);
    console.log(`Validation Notes:`, JSON.stringify(nonZero.validation_notes, null, 2));
  }

  // Let's also group lessons by quality score
  const scoreGroups: Record<number, number> = {};
  lessons.forEach(l => {
    const s = l.quality_score || 0;
    scoreGroups[s] = (scoreGroups[s] || 0) + 1;
  });
  console.log("\nScore groups count:", scoreGroups);
}

viewNotes().catch(console.error);
