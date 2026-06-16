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
  // Total Counts
  const { count: totalTopics } = await supabase.from("topics").select("*", { count: 'exact', head: true });
  const { count: totalLessons } = await supabase.from("lessons").select("*", { count: 'exact', head: true });
  const { count: totalJobs } = await supabase.from("lesson_generation_jobs").select("*", { count: 'exact', head: true });
  
  console.log(`Total Topics: ${totalTopics}`);
  console.log(`Total Lessons: ${totalLessons}`);
  console.log(`Total Jobs: ${totalJobs}`);

  // Grade 1 Primary info
  const gradeId = "964f0003-537f-4409-a4f3-a667879b084e";
  const { count: g1Topics } = await supabase.from("topics").select("*", { count: 'exact', head: true }).eq("grade_id", gradeId);
  console.log(`Grade 1 Topics: ${g1Topics}`);

  // Check how many jobs exist for each grade
  const { data: allJobs } = await supabase.from("lesson_generation_jobs").select("grade_id");
  const jobGrades: Record<string, number> = {};
  allJobs?.forEach((j: any) => {
    jobGrades[j.grade_id] = (jobGrades[j.grade_id] || 0) + 1;
  });
  console.log("Jobs per Grade ID:", jobGrades);

  // Check how many topics exist for each grade
  const { data: allTopics } = await supabase.from("topics").select("grade_id");
  const topicGrades: Record<string, number> = {};
  allTopics?.forEach((t: any) => {
    topicGrades[t.grade_id] = (topicGrades[t.grade_id] || 0) + 1;
  });
  console.log("Topics per Grade ID:", topicGrades);
}

run().catch(console.error);
