const fs = require('fs');
const cp = require('child_process');
const token = process.env.GITHUB_TOKEN;
if(!token){ console.error('GITHUB_TOKEN missing; set env var to post issues'); process.exit(0); }
const repo = 'hamido860/levelspace.ma';
const conflicts = JSON.parse(fs.readFileSync('pr_conflict_report.json'))
  .filter(p=>p.status==='conflict')
  .map(p=>({number:p.number, branch:p.branch, details:p.mergeOutput}));
// Also include skipped merges recorded in merge_clean_report.json
let skipped = [];
try{ const mc = JSON.parse(fs.readFileSync('merge_clean_report.json')); if(mc && mc.overall && mc.overall.skipped) skipped = mc.overall.skipped.map(s=>({number:s.number, branch:s.branch, reason:s.reason})); }catch(e){}
const all = [...conflicts];
for(const s of skipped){ if(!all.find(a=>a.number===s.number)) all.push({number:s.number, branch:s.branch, details:s.reason}); }
const posted = [];
for(const pr of all){ const bodyFile = `pr_conflicts/pr-${pr.number}.md`; if(!fs.existsSync(bodyFile)){ console.warn('Missing body file for', pr.number); continue; }
 const title = `PR #${pr.number} has merge conflicts with main`;
 const body = fs.readFileSync(bodyFile,'utf8') + '\n\n---\nAutomated detection details:\n```
' + (pr.details||'') + '\n```\n';
 const cmd = `curl -s -X POST -H \"Authorization: token ${token}\" -H \"Accept: application/vnd.github+json\" https://api.github.com/repos/${repo}/issues -d ${JSON.stringify(JSON.stringify({title, body}))}`;
 try{ const out = cp.execSync(cmd, {encoding:'utf8'}); const j = JSON.parse(out); posted.push({number:pr.number, issueUrl:j.html_url}); console.log('Posted issue for PR', pr.number, j.html_url); }catch(e){ console.error('Failed to post for', pr.number, e.message || e); }
}
fs.writeFileSync('posted_issues.json', JSON.stringify(posted,null,2));
console.log('Done.');
