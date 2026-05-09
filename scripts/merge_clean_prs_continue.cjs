const fs = require('fs');
const cp = require('child_process');
function run(cmd){ try{ return {code:0, out: cp.execSync(cmd, {encoding:'utf8', stdio:['pipe','pipe','pipe']})}; }catch(e){ return {code:e.status || 1, out: e.stdout ? e.stdout.toString() : (e.message||''), err: e.stderr ? e.stderr.toString() : ''}; }}
const report = JSON.parse(fs.readFileSync('pr_conflict_report.json'));
const prs = JSON.parse(fs.readFileSync('pr_list.json'));
const clean = report.filter(r=>r.status==='clean');
if(clean.length===0){ console.log('No clean PRs to merge.'); process.exit(0); }
const original = (run('git rev-parse --abbrev-ref HEAD').out||'main').trim();
console.log('Original branch:', original);
run('git fetch origin --prune');
let overall = {merged:[], skipped:[]};
let r = run('git checkout main'); if(r.code!==0){ console.error('Failed to checkout main:', r.out, r.err); process.exit(1); }
r = run('git reset --hard origin/main'); if(r.code!==0){ console.error('Failed to reset main:', r.out, r.err); process.exit(1); }
for(const c of clean){ const num = c.number; const branch = c.branch; const pr = prs.find(p=>p.number===num); const title = pr ? pr.title : branch; console.log(`Attempting merge PR #${num} -> ${branch}`);
 const msg = `Merge PR #${num}: ${title.replace(/"/g,'\\"')}`;
 const tryMerge = run(`git merge --no-commit --no-ff origin/${branch}`);
 if(tryMerge.code!==0){ // conflict or error
 console.log(`Conflict or error merging ${branch}, aborting merge and skipping.`);
 run('git merge --abort || true');
 run('git reset --hard origin/main');
 overall.skipped.push({number:num,branch, reason: tryMerge.out||tryMerge.err});
 continue;
 }
 // commit the merge
 const commit = run(`git commit -m "${msg}"`);
 if(commit.code!==0){ console.log(`Commit failed for ${branch}:`, commit.out||commit.err); run('git reset --hard origin/main'); overall.skipped.push({number:num,branch, reason: commit.out||commit.err}); continue; }
 overall.merged.push({number:num, branch, out: commit.out});
}
if(overall.merged.length>0){ console.log('Pushing main to origin...'); const push = run('git push origin main'); if(push.code!==0){ console.error('Push failed:', push.out, push.err); fs.writeFileSync('merge_clean_report.json', JSON.stringify({status:'push-failed', overall}, null, 2)); run(`git checkout ${original}`); process.exit(1); } }
run(`git checkout ${original}`);
fs.writeFileSync('merge_clean_report.json', JSON.stringify({status:'done', overall}, null, 2));
console.log('Done. Report saved to merge_clean_report.json');
