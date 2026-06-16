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

async function viewReviews() {
  const fileContent = fs.readFileSync("scratch/islamic_lessons.json", "utf-8");
  const lessons: Lesson[] = JSON.parse(fileContent);

  console.log("=== Review Data for Samples ===");
  lessons.slice(0, 10).forEach(l => {
    console.log(`- [${l.grade}] ${l.lesson_title}`);
    console.log(`  Quality Score: ${l.quality_score}`);
    console.log(`  Validation Notes: ${l.validation_notes}`);
    console.log(`  Review Notes: ${l.review_notes}`);
  });

  // Check unique quality scores in DB
  const scores = lessons.map(l => l.quality_score);
  const uniqueScores = [...new Set(scores)];
  console.log("\nUnique Quality Scores in DB:", uniqueScores);
  
  // Calculate average quality score
  const totalScore = scores.reduce((sum, s) => sum + (s || 0), 0);
  console.log("Average Quality Score:", totalScore / lessons.length);
}

viewReviews().catch(console.error);
