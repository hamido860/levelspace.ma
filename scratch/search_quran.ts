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

async function searchQuran() {
  const fileContent = fs.readFileSync("scratch/islamic_lessons.json", "utf-8");
  const lessons: Lesson[] = JSON.parse(fileContent);

  const containsQuran = lessons.filter(l => 
    l.content?.includes("بسم الله") || 
    l.content?.includes("الحمد لله") || 
    l.content?.includes("قل هو الله") || 
    l.content?.includes("تبارك") ||
    l.content?.includes("أرأيت الذي") ||
    l.content?.includes("إنا أعطيناك") ||
    l.content?.includes("قل أعوذ")
  );

  console.log(`Lessons containing actual Quranic verses: ${containsQuran.length}`);
  containsQuran.forEach(l => {
    console.log(`- [${l.grade}] ${l.lesson_title} (ID: ${l.id})`);
    console.log(`  Content: ${l.content}`);
  });
}

searchQuran().catch(console.error);
