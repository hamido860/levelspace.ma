const fs = require('fs');

let content = fs.readFileSync('src/pages/ClassroomView.tsx', 'utf8');

const handleSeedDef = `    const handleSeedFromSupabase = async () => {
    if (!module) return;
    setIsSeeding(true);
    try {
      console.log('[ClassroomView] Seeding classroom from Supabase for module:', module.name);

      let gradeId = selectedGrade;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedGrade);
      if (!isUUID && selectedGrade) {
        const { data: grades } = await supabase.from('grades').select('id').eq('name', selectedGrade).limit(1);
        gradeId = grades?.[0]?.id;
      }

      const { data: subjects } = await supabase.from('subjects').select('id').eq('name', module.name).limit(1);
      const subjectId = subjects?.[0]?.id;

      if (!gradeId || !subjectId) {
        toast.error("Could not find matching grade or subject in database.");
        setIsSeeding(false);
        return;
      }`;

content = content.replace(/const handleSeedFromSupabase = async \(\) => \{[\s\S]*?toast\.error\("Could not find matching grade or subject in database\."\);\s*setIsSeeding\(false\);\s*return;\s*\}/, handleSeedDef);

fs.writeFileSync('src/pages/ClassroomView.tsx', content);
