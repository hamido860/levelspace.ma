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

  // Query jobs directly without relationships
  const { data: jobs, error } = await supabase
    .from("lesson_generation_jobs")
    .select("*")
    .eq("grade_id", gradeId);
  
  if (error) {
    console.error("Error fetching jobs:", error);
    return;
  }

  console.log(`\nJobs count for Grade 1: ${jobs?.length}`);
  if (jobs && jobs.length > 0) {
    const jobsByStatus: Record<string, number> = {};
    jobs.forEach((j: any) => {
      jobsByStatus[j.status] = (jobsByStatus[j.status] || 0) + 1;
    });
    console.log("Jobs by status:", jobsByStatus);
    console.log("Sample Jobs:", jobs.slice(0, 5));
  } else {
    console.log("No jobs found for Grade 1.");
  }
}

run().catch(console.error);
