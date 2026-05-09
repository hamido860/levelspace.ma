import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import { seedStarterLessonsFromTopics } from "../src/server/curriculum/starterLessons";

for (const path of [".env", ".env.local", ".env.production.local", ".vercel/.env.production.local"]) {
  if (fs.existsSync(path)) config({ path, override: false });
}

const args = new Set(process.argv.slice(2));
const commit = args.has("--commit");
const dryRun = args.has("--dry-run") || !commit;

if (commit && args.has("--dry-run")) {
  throw new Error("Use either --dry-run or --commit, not both.");
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = commit
  ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SR_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SR_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    commit
      ? "Missing SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SR_KEY for --commit."
      : "Missing Supabase URL/key for dry-run.",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const summary = await seedStarterLessonsFromTopics(supabase, { commit });

console.log(JSON.stringify({
  mode: dryRun ? "dry-run" : "commit",
  scanned_topics: summary.scannedTopics,
  existing_lessons: summary.existingLessons,
  would_insert_lessons: dryRun ? summary.inserted.length : undefined,
  inserted_lessons: summary.insertedLessons,
  skipped_lessons: summary.skippedLessons,
  sample_insertions: summary.inserted.slice(0, 10),
  sample_skipped: summary.skipped.slice(0, 10),
}, null, 2));
