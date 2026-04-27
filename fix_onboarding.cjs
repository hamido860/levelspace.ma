const fs = require('fs');

let content = fs.readFileSync('src/components/OnboardingModal.tsx', 'utf8');

const newHandleComplete = `  const handleComplete = async () => {
    localStorage.setItem('selected_country', 'Morocco');
    localStorage.setItem('selected_cycle', selectedCycle);

    let dbGradeId = selectedGrade;
    let dbTrackId = selectedTrack;

    // Fetch the actual UUIDs from Supabase for this grade/track combination
    try {
      const { data: gradeData } = await supabase.from('grades').select('id').eq('name', selectedGrade).limit(1);
      if (gradeData?.[0]?.id) dbGradeId = gradeData[0].id;

      if (selectedTrack) {
        const { data: trackData } = await supabase.from('bac_tracks').select('id').eq('name', selectedTrack).limit(1);
        if (trackData?.[0]?.id) dbTrackId = trackData[0].id;
      }
    } catch(e) {
      console.error("Failed fetching ids in onboarding:", e);
    }

    localStorage.setItem('selected_grade', dbGradeId || selectedGrade);
    if (dbTrackId) localStorage.setItem('selected_bac_track', dbTrackId);
    if (selectedOption) localStorage.setItem('selected_option', selectedOption);
    localStorage.setItem('has_completed_onboarding', 'true');

    await db.settings.put({ key: 'selected_country', value: 'Morocco' });
    await db.settings.put({ key: 'selected_cycle', value: selectedCycle });
    await db.settings.put({ key: 'selected_grade', value: dbGradeId || selectedGrade });
    if (dbTrackId) await db.settings.put({ key: 'selected_bac_track', value: dbTrackId });
    if (selectedOption) await db.settings.put({ key: 'selected_option', value: selectedOption });
    await db.settings.put({ key: 'has_completed_onboarding', value: 'true' });

    // Persist academic profile to Supabase for backend enforcement
    if (user) {
      try {
        await updateProfile(user.id, {
          onboarding_completed: true,
          selected_grade: dbGradeId || selectedGrade,
          selected_bac_track: dbTrackId || null,
        });
      } catch (err: any) {
        console.error('Failed to persist onboarding to database:', err.message);
      }
    }

    onComplete();
  };`;

content = content.replace(/const handleComplete = async \(\) => \{[\s\S]*?onComplete\(\);\s*\};/, newHandleComplete);

if (!content.includes('import { supabase } from')) {
    content = content.replace(/import \{ db \} from '\.\.\/db\/db';/, `import { db } from '../db/db';\nimport { supabase } from '../db/supabase';`);
}

fs.writeFileSync('src/components/OnboardingModal.tsx', content);
