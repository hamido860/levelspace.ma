import fs from 'fs';
const content = fs.readFileSync('src/pages/ClassroomView.tsx', 'utf8');
if (content.includes('AI-Curated')) {
    console.log("ClassroomView has issues");
}
