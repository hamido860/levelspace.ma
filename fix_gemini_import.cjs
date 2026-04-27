const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

content = content.replace(/import \{ aiCommandCenterService \} from "\.\/aiCommandCenterService";/, 'import aiCommandCenterService from "./aiCommandCenterService";');

fs.writeFileSync('src/services/geminiService.ts', content);
