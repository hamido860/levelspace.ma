import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const SUPABASE_URL = 'https://pimojkivimygenhygsto.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpbW9qa2l2aW15Z2VuaHlnc3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzAzNDksImV4cCI6MjA5MDEwNjM0OX0.3PqRdyQMlz3aMaqSnm8_oD6iYJpN-CVilA6bk5G88wM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  console.log("=== Fetching Islamic Education Lessons ===");
  
  // Let's first inspect a single row to see all available column names
  const { data: sampleData, error: sampleError } = await supabase
    .from("lessons")
    .select("*")
    .limit(1);

  if (sampleError) {
    console.error("Error fetching sample lesson:", sampleError);
    return;
  }
  
  if (sampleData && sampleData.length > 0) {
    console.log("Columns available in lessons table:", Object.keys(sampleData[0]));
  } else {
    console.log("No lessons found in the table.");
  }

  // Fetch all Islamic Education lessons
  // The subject might be in Arabic "التربية الإسلامية"
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("*")
    .or("subject.eq.التربية الإسلامية,subject.ilike.%islamic%");

  if (lessonsError) {
    console.error("Error fetching lessons:", lessonsError);
    return;
  }

  console.log(`Successfully fetched ${lessons.length} Islamic Education lessons.`);
  
  // Save results to json
  fs.writeFileSync(
    "scratch/islamic_lessons.json",
    JSON.stringify(lessons, null, 2),
    "utf-8"
  );
  console.log("Saved lessons to scratch/islamic_lessons.json");
}

run().catch(console.error);
