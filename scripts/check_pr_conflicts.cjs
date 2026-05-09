const fs = require('fs');
const cp = require('child_process');
const prs = JSON.parse(fs.readFileSync('pr_list.json'));
const openPRs = prs.filter(p => p.state === 'open');
const results = [];
function run(cmd){ try{ return {code:0, out: cp.execSync(cmd, {encoding:'utf8', stdio:['pipe','pipe','pipe']})}; }catch(e){ return {code:e.status || 1, out: e.stdout ? e.stdout.toString() : (e.message||''), err: e.stderr ? e.stderr.toString() : ''}; }}
const originalBranch = (run('git rev-parse --abbrev-ref HEAD').out||'main').trim();
for(const p of openPRs){ const num = p.number; const branch = p.head.ref; const local = `tmp/pr-${num}`; console.log(`Checking PR #${num} -> ${branch}`);
 // ensure remote branch exists
 const check = run(`git show-ref --verify --quiet refs/remotes/origin/${branch} || echo MISSING`);
 if(check.out.includes('MISSING')){ results.push({number:num, branch, status:'remote-missing'}); continue; }
 // create/reset local branch
 run(`git branch -f ${local} origin/${branch}`);
 const co = run(`git checkout ${local}`);
 if(co.code !== 0){ results.push({number:num, branch, status:'checkout-failed', out: co.out, err: co.err}); continue; }
 // attempt merge
 const merge = run(`git merge --no-commit --no-ff origin/main`);
 let conflict=false;
 if(merge.code !== 0){ // check for unmerged paths
 const ls = run('git ls-files -u');
 if(ls.out && ls.out.trim().length>0) conflict = true;
 }
 // abort or reset
 // if merge in progress, try abort
 run('git merge --abort || true');
 // checkout original
 run(`git checkout ${originalBranch}`);
 // delete temp
 run(`git branch -D ${local} || true`);
 results.push({number:num, branch, status: conflict? 'conflict' : 'clean', mergeOutput: merge.out||merge.err});
}
fs.writeFileSync('pr_conflict_report.json', JSON.stringify(results, null, 2));
console.log('Done. Report saved to pr_conflict_report.json');
