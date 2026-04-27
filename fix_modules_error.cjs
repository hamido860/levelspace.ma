const fs = require('fs');
let content = fs.readFileSync('src/pages/Modules.tsx', 'utf8');

// The issue might be that the local variable \`grade\` is empty or undefined,
// causing the supabase query to return nothing, thus 'Grade not found in database'.
const newFetchCurriculum = `  const fetchCurriculum = async (bypassCache = false) => {
    setIsLoading(true);
    try {
      // 1. Check if grade is UUID or Name
      let gradeId = grade;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(grade);

      if (!isUUID && grade) {
        const { data: gradesData } = await supabase.from('grades').select('id').eq('name', grade).limit(1);
        gradeId = gradesData?.[0]?.id;
      }

      if (!gradeId) {
        console.warn('Grade ID not found or empty, clearing modules.');
        await db.modules.clear();
        setIsLoading(false);
        return;
      }

      // 2. Fetch all subjects for this grade
      const { data: gradeSubjects, error: gsError } = await supabase
        .from('grade_subjects')
        .select('subject_id, subjects(*)')
        .eq('grade_id', gradeId);

      if (gsError) throw gsError;

      if (gradeSubjects && gradeSubjects.length > 0) {
        const formattedModules = gradeSubjects.map(gs => {
          const s = gs.subjects;
          return {
            id: s.id,
            name: s.name,
            code: s.code || s.name.substring(0, 3).toUpperCase(),
            description: s.description || \`Course for \${s.name}\`,
            category: s.category || 'General',
            progress: 0,
            selected: false,
            createdAt: Date.now()
          };
        });

        await db.modules.clear();
        await db.modules.bulkPut(formattedModules);
      } else {
        await db.modules.clear();
      }
    } catch (error) {
      console.error("Failed to fetch curriculum from Supabase:", error);
    } finally {
      setIsLoading(false);
    }
  };`;

content = content.replace(/const fetchCurriculum = async \([^)]*\) => \{[\s\S]*?finally \{\s*setIsLoading\(false\);\s*\}\s*\};/, newFetchCurriculum);

fs.writeFileSync('src/pages/Modules.tsx', content);
