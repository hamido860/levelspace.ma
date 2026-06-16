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
  const gradeId = "964f0003-537f-4409-a4f3-a667879b084e"; // 1ère année primaire
  
  console.log("=== Target Grade 1 Audit ===");

  // 1. Get subjects mapped to Grade 1
  const { data: gradeSubjs } = await supabase
    .from("grade_subjects")
    .select("*, subjects(*)")
    .eq("grade_id", gradeId);
  
  console.log("Grade 1 Subjects:");
  gradeSubjs?.forEach((gs: any) => {
    console.log(`- ${gs.subjects?.name} (Code: ${gs.subjects?.code}, ID: ${gs.subjects?.id})`);
  });

  // 2. Get topics for Grade 1
  const { data: topics } = await supabase
    .from("topics")
    .select("*, subjects(name)")
    .eq("grade_id", gradeId);
  
  console.log(`\nTopics Count: ${topics?.length}`);
  const topicsBySubj: Record<string, any[]> = {};
  topics?.forEach((t: any) => {
    const sName = t.subjects?.name || "Unknown";
    if (!topicsBySubj[sName]) topicsBySubj[sName] = [];
    topicsBySubj[sName].push({ id: t.id, title: t.title });
  });

  for (const [subj, list] of Object.entries(topicsBySubj)) {
    console.log(`\n--- Subject: ${subj} (${list.length} topics) ---`);
    list.forEach((t: any) => {
      console.log(`  * [${t.id}] ${t.title}`);
    });
  }

  // 3. Get lessons for Grade 1
  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("grade", "1ère année primaire");
  
  console.log(`\nLessons Count in 'lessons' table matching grade "1ère année primaire": ${lessons?.length}`);
  lessons?.forEach((l: any) => {
    console.log(`- [${l.id}] Title: "${l.lesson_title}", Subject: "${l.subject}", Country: "${l.country}", Topic ID: ${l.topic_id}, AI: ${l.is_ai_generated}, Status: ${l.status}`);
  });

  // 4. Get jobs for Grade 1
  const { data: jobs } = await supabase
    .from("lesson_generation_jobs")
    .select("*, topics(title), subjects(name)")
    .eq("grade_id", gradeId);
  
  console.log(`\nGeneration Jobs Count for Grade 1: ${jobs?.length}`);
  const jobsByStatus: Record<string, number> = {};
  jobs?.forEach((j: any) => {
    jobsByStatus[j.status] = (jobsByStatus[j.status] || 0) + 1;
  });
  console.log("Jobs by status:", jobsByStatus);
  if (jobs && jobs.length > 0) {
    console.log("Sample Jobs (first 5):");
    jobs.slice(0, 5).forEach((j: any) => {
      console.log(`- Job [${j.id}]: Topic: "${j.topics?.title}", Subject: "${j.subjects?.name}", Status: "${j.status}", attempts: ${j.attempts}`);
    });
  }
}

run().catch(console.error);
