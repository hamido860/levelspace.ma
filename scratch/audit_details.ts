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
  const result: any = {};

  // Curricula
  const { data: curricula } = await supabase.from("curricula").select("*");
  result.curricula = curricula;

  // Cycles
  const { data: cycles } = await supabase.from("cycles").select("*");
  result.cycles = cycles;

  // Grades
  const { data: grades } = await supabase.from("grades").select("*");
  result.grades = grades;

  // Subjects
  const { data: subjects } = await supabase.from("subjects").select("*");
  result.subjects = subjects;

  // Grade Subjects
  const { data: gradeSubjects } = await supabase.from("grade_subjects").select("*");
  result.grade_subjects = gradeSubjects;

  // Find Grade 1 primary grade row(s)
  const g1Grades = grades ? grades.filter((g: any) => 
    /1/i.test(g.name) || /première/i.test(g.name) || /A\.?P\.?/i.test(g.name) || /primary/i.test(g.name)
  ) : [];
  result.g1_grades = g1Grades;

  // Topics for those Grade 1 entries
  const g1GradeIds = g1Grades.map((g: any) => g.id);
  const { data: g1Topics } = await supabase
    .from("topics")
    .select("*, subjects(name)")
    .in("grade_id", g1GradeIds);
  result.g1_topics = g1Topics;

  // Lessons matching Grade 1
  const { data: g1Lessons } = await supabase
    .from("lessons")
    .select("id, country, grade, subject, lesson_title, topic_id, is_ai_generated, status")
    .in("grade", g1Grades.map((g: any) => g.name));
  result.g1_lessons = g1Lessons;

  // Jobs matching Grade 1 grade IDs
  const { data: g1Jobs } = await supabase
    .from("lesson_generation_jobs")
    .select("*")
    .in("grade_id", g1GradeIds);
  result.g1_jobs = g1Jobs;

  // Write results to JSON
  fs.writeFileSync("scratch/audit_results.json", JSON.stringify(result, null, 2), "utf-8");
  console.log("Audit complete. Results saved to scratch/audit_results.json");
}

run().catch(console.error);
