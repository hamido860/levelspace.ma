import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";

for (const path of [".env", ".env.local", ".env.production.local", ".vercel/.env.production.local"]) {
  if (fs.existsSync(path)) dotenv.config({ path, override: true });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SR_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, lesson_title, topic_id, subject, grade")
    .eq("grade", "1ère année primaire");

  console.log("=== Checking Grade 1 Lessons and their Topic ID associations ===");
  if (!lessons || lessons.length === 0) {
    console.log("No lessons found.");
    return;
  }

  const topicIds = Array.from(new Set(lessons.map((l: any) => l.topic_id).filter(Boolean)));
  console.log("Unique Topic IDs referenced by Grade 1 lessons:", topicIds);

  const { data: topics, error } = await supabase
    .from("topics")
    .select("*, subjects(name), grades(name)")
    .in("id", topicIds);

  if (error) {
    console.error("Error fetching topics:", error);
    return;
  }

  console.log("\nTopics matched in DB:");
  topics?.forEach((t: any) => {
    console.log(`- Topic ID: ${t.id}`);
    console.log(`  Title: "${t.title}"`);
    console.log(`  Grade in Topics table: "${t.grades?.name}" (ID: ${t.grade_id})`);
    console.log(`  Subject in Topics table: "${t.subjects?.name}" (ID: ${t.subject_id})`);
  });

  const matchedIds = new Set(topics?.map((t: any) => t.id));
  const missingIds = topicIds.filter(id => !matchedIds.has(id));
  console.log("\nReferenced topic IDs that do NOT exist in the topics table:", missingIds);
}

run().catch(console.error);
