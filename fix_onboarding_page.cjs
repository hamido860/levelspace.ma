const fs = require('fs');
let content = fs.readFileSync('src/pages/Onboarding.tsx', 'utf8');

const newHandleContinue = `  const handleContinue = async () => {
    if (selectedGrade) {
      let dbGradeId = selectedGrade;
      try {
        const { data } = await supabase.from('grades').select('id').eq('name', selectedGrade).limit(1);
        if (data?.[0]?.id) dbGradeId = data[0].id;
      } catch (err) {
        console.error('Failed to get grade UUID:', err);
      }
      localStorage.setItem('selected_grade', dbGradeId);
      await db.settings.put({ key: 'selected_grade', value: dbGradeId });
      navigate('/modules');
    }
  };`;

content = content.replace(/const handleContinue = async \(\) => \{[\s\S]*?navigate\('\/modules'\);\s*\}\s*\};/, newHandleContinue);

if (!content.includes('import { supabase } from')) {
  content = content.replace(/import \{ db \} from '\.\.\/db\/db';/, `import { db } from '../db/db';\nimport { supabase } from '../db/supabase';`);
}

fs.writeFileSync('src/pages/Onboarding.tsx', content);
