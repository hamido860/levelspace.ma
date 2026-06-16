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
  const { data: jobs, error } = await supabase
    .from("lesson_generation_jobs")
    .select("*")
    .limit(10);
  
  if (error) {
    console.error("Error fetching jobs:", error);
    return;
  }

  console.log("=== Job Columns and Sample Data ===");
  if (jobs && jobs.length > 0) {
    console.log("Keys available in job row:", Object.keys(jobs[0]));
    
    // Check unique statuses
    const { data: statuses } = await supabase.rpc('get_job_statuses');
    if (statuses) {
      console.log("Unique statuses (via RPC):", statuses);
    } else {
      // Manual check
      const { data: allJobs } = await supabase.from("lesson_generation_jobs").select("status, priority, generation_mode, pedagogical_style");
      const uniqStatuses = Array.from(new Set(allJobs?.map(j => j.status)));
      const uniqPriorities = Array.from(new Set(allJobs?.map(j => j.priority)));
      const uniqModes = Array.from(new Set(allJobs?.map(j => j.generation_mode)));
      const uniqStyles = Array.from(new Set(allJobs?.map(j => j.pedagogical_style)));
      
      console.log("Unique Statuses in DB:", uniqStatuses);
      console.log("Unique Priorities in DB:", uniqPriorities);
      console.log("Unique Generation Modes in DB:", uniqModes);
      console.log("Unique Pedagogical Styles in DB:", uniqStyles);
    }
  }
}

run().catch(console.error);
