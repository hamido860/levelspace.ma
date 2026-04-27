const fs = require('fs');

let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// Add console.log when AI is called
content = content.replace(/const callGemini = async \([^)]*\) => \{/, `const callGemini = async (modelName: string, promptParts: any[], systemInstruction?: string, responseSchema?: any, endpointName: string = "unknown") => {
  console.log(\`[AI_CALL] Initiating AI call to endpoint: \${endpointName}\`);
`);

fs.writeFileSync('src/services/geminiService.ts', content);
