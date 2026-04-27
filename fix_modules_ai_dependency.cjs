const fs = require('fs');

let content = fs.readFileSync('src/pages/Modules.tsx', 'utf8');

// Remove aiAvailable checks blocking "Create My Classroom" and "Regenerate" buttons since we now use Supabase directly.
content = content.replace(/disabled=\{!aiAvailable\}/g, 'disabled={false}');
content = content.replace(/disabled=\{isLoading \|\| !aiAvailable\}/g, 'disabled={isLoading}');
content = content.replace(/title=\{!aiAvailable \? aiUnavailableMsg : undefined\}/g, 'title={undefined}');

// Hide the aiUnavailable warning box
content = content.replace(/\{!aiAvailable && \([\s\S]*?<\/div>\s*\)\}/, '{/* Removed AI Unavailable Warning */}');

fs.writeFileSync('src/pages/Modules.tsx', content);
