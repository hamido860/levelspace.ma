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

// Check command line arguments
const commit = process.argv.includes("--commit");
const dryRun = !commit;

async function run() {
  console.log("==========================================");
  console.log("     SUPABASE DATABASE REPAIR SCRIPT      ");
  console.log("==========================================");
  console.log(`MODE: ${dryRun ? "DRY-RUN (Safe, no database modifications)" : "COMMIT (Modifying live Supabase database)"}`);
  console.log("URL:", supabaseUrl);
  console.log("------------------------------------------");

  const grade1Id = "964f0003-537f-4409-a4f3-a667879b084e"; // 1ère année primaire

  // ==========================================
  // PART 1: Query Current State
  // ==========================================
  
  // Fetch Grade 1 Topics
  const { data: g1Topics, error: tErr } = await supabase
    .from("topics")
    .select("*, subjects(name, code)")
    .eq("grade_id", grade1Id);
  
  if (tErr || !g1Topics) {
    console.error("Failed to fetch Grade 1 topics:", tErr?.message);
    return;
  }
  console.log(`Fetched ${g1Topics.length} official Grade 1 topics from database.`);

  // Find target topic IDs for our Grade 1 lessons mapping
  const quranTopic = g1Topics.find((t: any) => t.title === "القرآن الكريم");
  const propagationTopic = g1Topics.find((t: any) => t.title === "مدخل الاقتداء");
  const movementsTopic = g1Topics.find((t: any) => t.title === "الحركات");
  const nutritionTopic = g1Topics.find((t: any) => t.title === "التغذية عند الحيوانات");
  const numbersTopic = g1Topics.find((t: any) => t.title === "متتالية الأعداد إلى 10");

  console.log("\nTarget Topics for Mapping Alignment:");
  console.log(`- القرآن الكريم: ${quranTopic?.id || "NOT FOUND"}`);
  console.log(`- مدخل الاقتداء: ${propagationTopic?.id || "NOT FOUND"}`);
  console.log(`- الحركات: ${movementsTopic?.id || "NOT FOUND"}`);
  console.log(`- التغذية عند الحيوانات: ${nutritionTopic?.id || "NOT FOUND"}`);
  console.log(`- متتالية الأعداد إلى 10: ${numbersTopic?.id || "NOT FOUND"}`);

  // Fetch all Grade 1 lessons in lessons table
  const { data: g1Lessons, error: lErr } = await supabase
    .from("lessons")
    .select("*")
    .eq("grade", "1ère année primaire");
  
  if (lErr || !g1Lessons) {
    console.error("Failed to fetch Grade 1 lessons:", lErr?.message);
    return;
  }
  console.log(`\nFetched ${g1Lessons.length} Grade 1 lessons currently in 'lessons' table.`);

  // ==========================================
  // PART 2: Plan Subject / Grade / Country Normalization
  // ==========================================
  console.log("\n--- Planning Global Lessons Normalization ---");
  
  // We'll inspect ALL lessons in the DB for misspelled country 'Maroc'
  const { data: allLessons, error: allLessErr } = await supabase
    .from("lessons")
    .select("id, lesson_title, country, grade, subject");
  
  if (allLessErr || !allLessons) {
    console.error("Failed to fetch all lessons for global audit:", allLessErr?.message);
    return;
  }

  const countryUpdates: any[] = [];
  const subjectUpdates: any[] = [];
  const lessonMappingUpdates: any[] = [];

  allLessons.forEach((l: any) => {
    // 1. Country spelling check
    if (l.country === "Maroc") {
      countryUpdates.push({
        id: l.id,
        lesson_title: l.lesson_title,
        old_country: l.country,
        new_country: "Morocco"
      });
    }

    // 2. Global Islamic Ed spelling check
    if (l.subject === "التربية الاسلامية") {
      subjectUpdates.push({
        id: l.id,
        lesson_title: l.lesson_title,
        old_subject: l.subject,
        new_subject: "التربية الإسلامية"
      });
    }

    // 3. Grade 1 specific math subject spelling check
    if (l.grade === "1ère année primaire" && l.subject === "الرياضيات") {
      subjectUpdates.push({
        id: l.id,
        lesson_title: l.lesson_title,
        old_subject: l.subject,
        new_subject: "Mathématiques"
      });
    }
  });

  console.log(`* Planned country normalizations (Maroc -> Morocco): ${countryUpdates.length}`);
  console.log(`* Planned subject normalizations (التربية الاسلامية -> التربية الإسلامية / الرياضيات -> Mathématiques): ${subjectUpdates.length}`);

  // ==========================================
  // PART 3: Plan Topic ID Alignment for Grade 1 Lessons
  // ==========================================
  console.log("\n--- Planning Grade 1 Topic ID Realignment ---");

  g1Lessons.forEach((l: any) => {
    let targetTopicId: string | null = null;
    let targetSubjectName: string | null = null;

    const title = l.lesson_title;
    
    // Check subject
    const isIslamicEd = l.subject === "التربية الإسلامية" || l.subject === "التربية الاسلامية";
    const isScience = l.subject === "النشاط العلمي";
    const isMath = l.subject === "الرياضيات" || l.subject === "Mathématiques";

    if (isIslamicEd) {
      targetSubjectName = "التربية الإسلامية";
      if (title.includes("سورة")) {
        targetTopicId = quranTopic?.id || null;
      } else if (title.includes("الرسول") || title.includes("مولد") || title.includes("يتيم") || title.includes("یتم") || title.includes("كفالته")) {
        targetTopicId = propagationTopic?.id || null;
      }
    } else if (isScience) {
      targetSubjectName = "النشاط العلمي";
      if (title.includes("الحركات")) {
        targetTopicId = movementsTopic?.id || null;
      } else if (title.includes("التغذية") || title.includes("الحيوان")) {
        targetTopicId = nutritionTopic?.id || null;
      }
    } else if (isMath) {
      targetSubjectName = "Mathématiques";
      if (title.includes("الأعداد") || title.includes("1 الى 5")) {
        targetTopicId = numbersTopic?.id || null;
      }
    }

    if (targetTopicId && (l.topic_id !== targetTopicId || l.subject !== targetSubjectName)) {
      lessonMappingUpdates.push({
        id: l.id,
        lesson_title: title,
        old_topic_id: l.topic_id,
        new_topic_id: targetTopicId,
        old_subject: l.subject,
        new_subject: targetSubjectName
      });
    }
  });

  console.log(`* Planned Grade 1 lesson topic ID realignments: ${lessonMappingUpdates.length}`);
  lessonMappingUpdates.forEach((u: any) => {
    console.log(`  - "${u.lesson_title}": topic_id ${u.old_topic_id} -> ${u.new_topic_id}, subject "${u.old_subject}" -> "${u.new_subject}"`);
  });

  // ==========================================
  // PART 4: Plan Missing Job Entry Sync
  // ==========================================
  console.log("\n--- Planning Grade 1 Generation Jobs Sync ---");

  // Query one existing job to replicate metadata standard
  const { data: sampleJobs, error: sjErr } = await supabase
    .from("lesson_generation_jobs")
    .select("*")
    .limit(1);
  
  if (sjErr || !sampleJobs || sampleJobs.length === 0) {
    console.error("Failed to query sample job for metadata template:", sjErr?.message);
    return;
  }
  
  const templateJob = sampleJobs[0];
  console.log("Queried Job Metadata Template:");
  console.log(`- priority: ${templateJob.priority}`);
  console.log(`- generation_mode: ${templateJob.generation_mode}`);
  console.log(`- pedagogical_style: ${templateJob.pedagogical_style}`);
  console.log(`- instructions length: ${templateJob.instructions?.length || 0} characters`);

  // Check if any jobs already exist for Grade 1
  const { data: existingG1Jobs } = await supabase
    .from("lesson_generation_jobs")
    .select("topic_id")
    .eq("grade_id", grade1Id);
  
  const existingJobTopicIds = new Set(existingG1Jobs?.map((j: any) => j.topic_id) || []);
  console.log(`Already existing jobs for Grade 1 in DB: ${existingJobTopicIds.size}`);

  const jobsToInsert: any[] = [];
  
  g1Topics.forEach((t: any) => {
    if (!existingJobTopicIds.has(t.id)) {
      jobsToInsert.push({
        topic_id: t.id,
        grade_id: grade1Id,
        subject_id: t.subject_id,
        status: "pending",
        priority: templateJob.priority || 2,
        generation_mode: templateJob.generation_mode || "chatgpt_manual",
        pedagogical_style: templateJob.pedagogical_style || "modern_minor_grade",
        instructions: templateJob.instructions || "Generate a simple, age-appropriate lesson using the topic title and ordered topic_outlines. Use short explanations, examples, activities, mini quiz, and summary. Save as needs_review. Do not publish directly.",
        attempts: 0,
        max_attempts: templateJob.max_attempts || 3
      });
    }
  });

  console.log(`* Planned job entries to insert: ${jobsToInsert.length} (out of ${g1Topics.length} total Grade 1 topics)`);

  // ==========================================
  // PART 5: Execute Database Modifications
  // ==========================================
  if (dryRun) {
    console.log("\n==========================================");
    console.log("   DRY RUN COMPLETE - NO DATABASE CHANGES   ");
    console.log("==========================================");
    console.log("To apply these changes, run the script with the --commit flag:");
    console.log("  npx tsx scratch/repair.ts --commit");
    console.log("==========================================");
    return;
  }

  console.log("\n--- EXECUTING DATABASE REPAIRS ---");

  // 1. Country Normalizations
  if (countryUpdates.length > 0) {
    console.log(`\nApplying ${countryUpdates.length} country normalizations...`);
    for (const update of countryUpdates) {
      const { error } = await supabase
        .from("lessons")
        .update({ country: update.new_country })
        .eq("id", update.id);
      
      if (error) {
        console.error(`  [ERROR] Failed to normalize country for "${update.lesson_title}":`, error.message);
      } else {
        console.log(`  [OK] "${update.lesson_title}": country normalized to "${update.new_country}".`);
      }
    }
  }

  // 2. Subject Spelling Normalizations
  if (subjectUpdates.length > 0) {
    console.log(`\nApplying ${subjectUpdates.length} subject normalizations...`);
    for (const update of subjectUpdates) {
      const { error } = await supabase
        .from("lessons")
        .update({ subject: update.new_subject })
        .eq("id", update.id);
      
      if (error) {
        console.error(`  [ERROR] Failed to normalize subject for "${update.lesson_title}":`, error.message);
      } else {
        console.log(`  [OK] "${update.lesson_title}": subject normalized to "${update.new_subject}".`);
      }
    }
  }

  // 3. Lesson Mappings Alignment
  if (lessonMappingUpdates.length > 0) {
    console.log(`\nApplying ${lessonMappingUpdates.length} topic ID realignments...`);
    for (const update of lessonMappingUpdates) {
      const { error } = await supabase
        .from("lessons")
        .update({ topic_id: update.new_topic_id, subject: update.new_subject })
        .eq("id", update.id);
      
      if (error) {
        console.error(`  [ERROR] Failed to realign topic ID for "${update.lesson_title}":`, error.message);
      } else {
        console.log(`  [OK] "${update.lesson_title}": topic_id set to ${update.new_topic_id}, subject to "${update.new_subject}".`);
      }
    }
  }

  // 4. Job Seeding
  if (jobsToInsert.length > 0) {
    console.log(`\nInserting ${jobsToInsert.length} missing generation jobs...`);
    // Insert jobs in batches of 50 to avoid any database payload limits
    const batchSize = 50;
    for (let i = 0; i < jobsToInsert.length; i += batchSize) {
      const batch = jobsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from("lesson_generation_jobs")
        .insert(batch);
      
      if (error) {
        console.error(`  [ERROR] Failed to insert job batch starting at index ${i}:`, error.message);
      } else {
        console.log(`  [OK] Inserted job batch starting at index ${i} (${batch.length} jobs).`);
      }
    }
  }

  console.log("\n==========================================");
  console.log("       DATABASE REPAIRS COMPLETED!        ");
  console.log("==========================================");
}

run().catch(console.error);
