import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";

// Load environment variables
for (const path of [".env", ".env.local", ".env.production.local", ".vercel/.env.production.local"]) {
  if (fs.existsSync(path)) dotenv.config({ path, override: true });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SR_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function audit() {
  console.log("=== Auditing Supabase Database ===");
  console.log("URL:", supabaseUrl);
  
  // 1. Get all table names in public schema
  console.log("\n--- Checking available tables in database ---");
  const { data: tables, error: tablesError } = await supabase.rpc('get_tables');
  if (tablesError) {
    // If RPC doesn't exist, we'll try a raw sql query if possible, or just query known tables
    console.log("Could not run RPC get_tables:", tablesError.message);
  } else {
    console.log("Tables:", tables);
  }

  // Let's query a list of tables directly or test querying known tables
  const knownTables = [
    "curricula", "cycles", "levels", "grades", "subjects", "grade_subjects",
    "topics", "lessons", "lesson_generation_jobs", "lesson_jobs", "jobs"
  ];

  for (const table of knownTables) {
    try {
      const { count, error } = await supabase.from(table).select("*", { count: 'exact', head: true });
      if (error) {
        console.log(`Table '${table}': Not available or error -`, error.message);
      } else {
        console.log(`Table '${table}': exists, row count = ${count}`);
      }
    } catch (e: any) {
      console.log(`Table '${table}': throws exception -`, e.message);
    }
  }

  // 2. Fetch all curricula
  console.log("\n--- Curricula ---");
  const { data: curricula, error: currErr } = await supabase.from("curricula").select("*");
  console.log("Curricula:", currErr ? currErr.message : curricula);

  // 3. Fetch all cycles
  console.log("\n--- Cycles ---");
  const { data: cycles, error: cycErr } = await supabase.from("cycles").select("*");
  console.log("Cycles:", cycErr ? cycErr.message : cycles);

  // 4. Fetch all grades
  console.log("\n--- Grades ---");
  const { data: grades, error: gradeErr } = await supabase.from("grades").select("*");
  console.log("Grades:", gradeErr ? gradeErr.message : grades);

  // 5. Fetch all subjects
  console.log("\n--- Subjects ---");
  const { data: subjects, error: subjErr } = await supabase.from("subjects").select("*");
  console.log("Subjects count:", subjects?.length);
  if (subjects) {
    console.log("Subjects list:", subjects.map(s => ({ id: s.id, name: s.name, code: s.code })));
  }

  // 6. Fetch Grade 1 Primary (1 A.P. / 1ère année primaire) specific items
  console.log("\n--- Grade 1 Primary Specific Audit ---");
  // Let's find any grade that matches Grade 1 Primary in name
  const g1Grades = grades ? grades.filter((g: any) => 
    /1/i.test(g.name) || /première/i.test(g.name) || /A\.?P\.?/i.test(g.name) || /primary/i.test(g.name)
  ) : [];
  console.log("Potential Grade 1 entries:", g1Grades);

  for (const g of g1Grades) {
    console.log(`\nAuditing for Grade ID: ${g.id} (${g.name})`);
    
    // Topics for this grade
    const { data: topics, error: topErr } = await supabase
      .from("topics")
      .select("*, subjects(name)")
      .eq("grade_id", g.id);
    
    console.log(`  Topics count for ${g.name}:`, topics?.length);
    if (topics) {
      const topicsBySubject: Record<string, any[]> = {};
      topics.forEach((t: any) => {
        const subjName = t.subjects?.name || "Unknown Subject";
        if (!topicsBySubject[subjName]) topicsBySubject[subjName] = [];
        topicsBySubject[subjName].push(t.title);
      });
      console.log("  Topics grouped by subject:", JSON.stringify(topicsBySubject, null, 2));
    }

    // Lessons for this grade in the global lessons table
    const { data: lessons, error: lessErr } = await supabase
      .from("lessons")
      .select("id, country, grade, subject, lesson_title, is_ai_generated, status")
      .eq("grade", g.name);
    console.log(`  Lessons count matching grade string "${g.name}":`, lessons?.length);
    if (lessons && lessons.length > 0) {
      console.log("  Sample lessons:", lessons.slice(0, 10));
    }
  }

  // Let's check general lessons counts by grade and subject to identify inconsistencies
  console.log("\n--- General Lessons Table Audit ---");
  const { data: allLessons, error: allLessErr } = await supabase
    .from("lessons")
    .select("id, country, grade, subject, lesson_title, topic_id");
  
  if (allLessons) {
    console.log("Total lessons in DB:", allLessons.length);
    const lessonStats: Record<string, Record<string, number>> = {};
    allLessons.forEach((l: any) => {
      if (!lessonStats[l.grade]) lessonStats[l.grade] = {};
      if (!lessonStats[l.grade][l.subject]) lessonStats[l.grade][l.subject] = 0;
      lessonStats[l.grade][l.subject]++;
    });
    console.log("Lessons counts by grade and subject:", JSON.stringify(lessonStats, null, 2));
  } else {
    console.log("Error fetching lessons:", allLessErr?.message);
  }

  // Let's also check for job queues / lesson generation jobs
  console.log("\n--- Checking for Job Queues ---");
  // Let's search for table names matching jobs or look inside profiles or settings
  const { data: allJobs, error: jobsErr } = await supabase
    .from("lesson_generation_jobs")
    .select("*");
  if (jobsErr) {
    console.log("Could not query 'lesson_generation_jobs':", jobsErr.message);
  } else {
    console.log("lesson_generation_jobs found! Row count:", allJobs?.length);
    console.log("Sample jobs:", allJobs?.slice(0, 5));
  }
}

audit();
