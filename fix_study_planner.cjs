const fs = require('fs');

if (fs.existsSync('src/pages/StudyPlanner.ts')) {
    fs.renameSync('src/pages/StudyPlanner.ts', 'src/pages/StudyPlanner.tsx');
    console.log("Renamed StudyPlanner.ts to StudyPlanner.tsx");
}
