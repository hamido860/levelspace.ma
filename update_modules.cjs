const fs = require('fs');

let content = fs.readFileSync('src/pages/Modules.tsx', 'utf8');

const newFetchCurriculum = `  const fetchCurriculum = async (bypassCache = false) => {
    setIsLoading(true);
    try {
      // 1. Fetch Grade ID
      const { data: gradesData } = await supabase.from('grades').select('id').eq('name', grade).limit(1);
      const gradeId = gradesData?.[0]?.id;

      if (!gradeId) {
        throw new Error('Grade not found in database');
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
