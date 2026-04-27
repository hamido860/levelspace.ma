const fs = require('fs');

let content = fs.readFileSync('src/pages/Modules.tsx', 'utf8');

// We need to fix fetchCurriculum to handle grade possibly being a UUID
const newFetchCurriculum = `  const fetchCurriculum = async (bypassCache = false) => {
    setIsLoading(true);
    try {
      // 1. Check if grade is UUID or Name
      let gradeId = grade;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(grade);

      if (!isUUID) {
        const { data: gradesData } = await supabase.from('grades').select('id').eq('name', grade).limit(1);
        gradeId = gradesData?.[0]?.id;
      }

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

// We should also set gradeName to show correctly in UI
// Add state for gradeName if not present
if (!content.includes('const [gradeName, setGradeName]')) {
    content = content.replace(/const \[bacIntOptionName, setBacIntOptionName\] = useState<string>\(''\);/, `const [bacIntOptionName, setBacIntOptionName] = useState<string>('');\n  const [gradeName, setGradeName] = useState<string>('');`);
}

// Update fetchBacDetails to also fetch grade name
const newFetchBacDetails = `  useEffect(() => {
    const fetchBacDetails = async () => {
      // Grade
      if (grade) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(grade);
        if (isUUID) {
          const { data } = await supabase.from('grades').select('name').eq('id', grade).single();
          if (data) setGradeName(data.name);
        } else {
          setGradeName(grade);
        }
      }

      // Track
      if (selectedBacTrackId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacTrackId);
        if (isUUID) {
          const { data } = await supabase.from('bac_tracks').select('name').eq('id', selectedBacTrackId).single();
          if (data) setBacTrackName(data.name);
        } else {
          setBacTrackName(selectedBacTrackId);
        }
      } else {
        setBacTrackName("");
      }

      // Option
      if (selectedBacIntOptionId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacIntOptionId);
        if (isUUID) {
          const { data } = await supabase.from('bac_international_options').select('name').eq('id', selectedBacIntOptionId).single();
          if (data) setBacIntOptionName(data.name);
        } else {
          setBacIntOptionName(selectedBacIntOptionId);
        }
      } else {
        setBacIntOptionName("");
      }
    };
    fetchBacDetails();
  }, [selectedBacTrackId, selectedBacIntOptionId, grade]);`;

content = content.replace(/useEffect\(\(\) => \{[\s\S]*?fetchBacDetails\(\);\s*\}, \[selectedBacTrackId, selectedBacIntOptionId, grade\]\);/, newFetchBacDetails);

// Replace {grade} with {gradeName} in the UI rendering
content = content.replace(/\{grade\}\{bacTrackName \? \` - \$\{bacTrackName\}\` : ''\}/g, '{gradeName}{bacTrackName ? ` - ${bacTrackName}` : \'\'}');

fs.writeFileSync('src/pages/Modules.tsx', content);
