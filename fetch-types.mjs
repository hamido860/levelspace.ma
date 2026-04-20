import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Try loading various env files
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const projectId = 'pimojkivimygenhygsto';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error('VITE_SUPABASE_ANON_KEY not found in environment');
  process.exit(1);
}

const url = `https://${projectId}.supabase.co/rest/v1/?apikey=${anonKey}`;

console.log('Fetching OpenAPI spec...');
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const spec = await response.text();
  fs.writeFileSync('openapi.json', spec);
  console.log('Saved openapi.json');
  
  console.log('Generating types...');
  execSync('npx openapi-typescript openapi.json -o src/types/supabase.ts', { stdio: 'inherit' });
  console.log('Types generated successfully!');
} catch (e) {
  console.error('Error:', e.message);
}
