const fs = require('fs');
let content = fs.readFileSync('src/pages/Modules.tsx', 'utf8');

// There might be a condition preventing the rendering of the button.
// `!isLoading` or similar? Let's check.
