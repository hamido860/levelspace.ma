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

  const { data: topics, error } = await supabase
    .from("topics")
    .select("*, subjects(name, code)")
    .eq("grade_id", gradeId);

  if (error) {
    console.error("Error fetching topics:", error);
    return;
  }

  const formatted = topics.map((t: any) => ({
    id: t.id,
    title: t.title,
    subject: t.subjects?.name,
    subject_code: t.subjects?.code,
  }));

  fs.writeFileSync("scratch/all_g1_topics.json", JSON.stringify(formatted, null, 2), "utf-8");
  console.log(`Saved ${formatted.length} topics to scratch/all_g1_topics.json`);
}

run().catch(console.error);
