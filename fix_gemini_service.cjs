const fs = require('fs');

let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

content = content.replace(/import \{ GoogleGenAI, Type \} from "@google\/genai";/, `import { GoogleGenAI, Type } from "@google/genai";
import { aiCommandCenterService } from "./aiCommandCenterService";`);

content = content.replace(/const response = await ai\.models\.generateContent\(\{/g, `console.log("[AI_CALL] Initiating ai.models.generateContent");\n    const response = await ai.models.generateContent({`);

content = content.replace(/const result = await ai\.models\.generateContent\(\{/g, `console.log("[AI_CALL] Initiating ai.models.generateContent");\n    const result = await ai.models.generateContent({`);

fs.writeFileSync('src/services/geminiService.ts', content);
