import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/pages/LessonView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const lucideImportMatch = content.match(/import\s+{([^}]*)}\s+from\s+['"]lucide-react['"]/);
if (lucideImportMatch) {
    const importedIcons = lucideImportMatch[1];
    if (!importedIcons.includes('ListMusic')) {
        const newImportedIcons = importedIcons + ', ListMusic';
        content = content.replace(lucideImportMatch[0], "import { " + newImportedIcons + " } from 'lucide-react'");
        fs.writeFileSync(filePath, content);
        console.log('Added ListMusic to lucide-react imports');
    }
}
