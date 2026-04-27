const fs = require('fs');

let content = fs.readFileSync('src/pages/ClassroomView.tsx', 'utf8');

// Remove the AI seeding from useEffect
content = content.replace(/\/\/ Auto-seed from Supabase when local lessons are empty — no AI needed\s*useEffect\(\(\) => \{[\s\S]*?\}\)\(\);\s*\}, \[module\?\.id, allLessons\?\.length\]\);/, '');

// Fix handleSeedFromSupabase to use grade_subjects or properly query
const newSeedFunc = `  const handleSeedFromSupabase = async () => {
    if (!module) return;
    setIsSeeding(true);
    try {
      console.log('[ClassroomView] Seeding classroom from Supabase for module:', module.name);

      const { data: grades } = await supabase.from('grades').select('id').eq('name', selectedGrade).limit(1);
      const gradeId = grades?.[0]?.id;

      const { data: subjects } = await supabase.from('subjects').select('id').eq('name', module.name).limit(1);
      const subjectId = subjects?.[0]?.id;

      if (!gradeId || !subjectId) {
        toast.error("Could not find matching grade or subject in database.");
        setIsSeeding(false);
        return;
      }

      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('*')
        .eq('grade_id', gradeId)
        .eq('subject_id', subjectId);

      if (topicsError) throw topicsError;

      if (!topics || topics.length === 0) {
        toast.info("No lessons available in database for this subject.");
        setIsSeeding(false);
        return;
      }

      // Fetch lessons for these topics
      const topicIds = topics.map(t => t.id);

      let allDbLessons = [];
      if (topicIds.length > 0) {
        const { data: dbLessons, error: lessonsError } = await supabase
          .from('lessons')
          .select('*')
          .in('topic_id', topicIds);

        if (lessonsError) throw lessonsError;
        allDbLessons = dbLessons || [];
      } else {
        // Fallback to old subject mapping if topics don't have lessons
        const subjectTerms = getSubjectSearchTerms(module.name);
        const gradeTerms = getGradeSearchTerms(selectedGrade);
        const pairs = subjectTerms.flatMap(st =>
          gradeTerms.map(gt => \`and(subject.ilike.%\${st}%,grade.ilike.%\${gt}%)\`)
        ).join(',');

        const { data: fallbackLessons } = await supabase
          .from('lessons')
          .select('*')
          .or(pairs);

        allDbLessons = fallbackLessons || [];
      }

      if (!allDbLessons || allDbLessons.length === 0) {
        toast.info("No lessons available in database.");
        setIsSeeding(false);
        return;
      }

      const toAdd = [];
      for (const les of allDbLessons) {
        const existing = await db.lessons.where('title').equals(les.lesson_title).and(l => l.moduleId === module.id).first();
        if (!existing) {
          toAdd.push({
            id: les.id,
            moduleId: module.id,
            title: les.lesson_title,
            content: les.content || '',
            blocks: les.blocks,
            subtitle: les.subtitle,
            status: (les.status === 'published' || les.status === 'done') ? 'done' : 'pending',
            createdAt: Date.now()
          });
        }
      }

      if (toAdd.length > 0) {
        await db.lessons.bulkAdd(toAdd);
      }

      await db.modules.update(module.id, { strictRAG: true });

      toast.success(\`Loaded \${toAdd.length} new units from database.\`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load from database: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };`;

content = content.replace(/const handleSeedFromSupabase = async \(\) => \{[\s\S]*?toast\.error\('Failed to seed from Supabase: ' \+ err\.message\);\s*\} finally \{\s*setIsSeeding\(false\);\s*\}\s*\};/, newSeedFunc);

// Update Empty State UI to say "Lessons are being prepared" if AI is not available and no lessons
content = content.replace(/<p className="text-sm font-bold text-ink">No units curated yet<\/p>\s*<p className="text-xs text-muted max-w-xs">Load existing curriculum units from Supabase or generate new ones with AI\.<\/p>/, `{aiAvailable ? (
                      <>
                        <p className="text-sm font-bold text-ink">No units curated yet</p>
                        <p className="text-xs text-muted max-w-xs">Load existing curriculum units from Supabase or generate new ones with AI.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-ink">Lessons are being prepared</p>
                        <p className="text-xs text-muted max-w-xs">Our educators are preparing units for this classroom.</p>
                      </>
                    )}`);

// We need to trigger the new seed logic automatically on load if we have 0 lessons. Let's add a new simple effect for this.
const newEffect = `
  // Auto-seed from Supabase when local lessons are empty
  useEffect(() => {
    if (!module || !id || allLessons === undefined || isSeeding) return;
    if (allLessons.filter(l => l.status !== 'suggested').length > 0) return;

    // Check if we've already tried to seed this session to avoid infinite loops
    const hasTriedSeeding = sessionStorage.getItem(\`seeded_\${module.id}\`);
    if (!hasTriedSeeding) {
      sessionStorage.setItem(\`seeded_\${module.id}\`, 'true');
      console.log('[ClassroomView] Triggering automatic Supabase seed');
      handleSeedFromSupabase();
    }
  }, [module?.id, allLessons?.length]);
`;

// Insert the new effect after const lessons = ...
content = content.replace(/const lessons = allLessons\?\.filter\(l => l\.status !== 'suggested'\) \|\| \[\];/, `const lessons = allLessons?.filter(l => l.status !== 'suggested') || [];\n${newEffect}`);

fs.writeFileSync('src/pages/ClassroomView.tsx', content);
