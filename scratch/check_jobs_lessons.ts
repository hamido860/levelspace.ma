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
  // Get topics that have lessons
  const { data: lessons } = await supabase
    .from("lessons")
    .select("topic_id")
    .not("topic_id", "is", null);

  const lessonTopicIds = Array.from(new Set(lessons?.map((l: any) => l.topic_id).filter(Boolean)));
  console.log(`Total topics with lessons in DB: ${lessonTopicIds.length}`);

  // Fetch jobs for these topic ids
  const { data: jobs, error } = await supabase
    .from("lesson_generation_jobs")
    .select("topic_id, status")
    .in("topic_id", lessonTopicIds.slice(0, 100)); // Sample first 100

  if (error) {
    console.error("Error fetching jobs:", error);
    return;
  }

  console.log(`Of the sampled topics with lessons, how many have jobs: ${jobs?.length}`);
  if (jobs && jobs.length > 0) {
    console.log("Sample jobs for topics that already have lessons:", jobs.slice(0, 10));
  }
}

run().catch(console.error);
