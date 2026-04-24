import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/hooks/useAppSettings.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace .channel('app_settings_changes') with .channel(`app_settings_changes_${crypto.randomUUID()}`)
content = content.replace(
  /\.channel\('app_settings_changes'\)/g,
  ".channel(`app_settings_changes_${crypto.randomUUID()}`)"
);

fs.writeFileSync(filePath, content);
console.log('Hook patched successfully.');
