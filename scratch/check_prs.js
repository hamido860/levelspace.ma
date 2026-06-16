const fs = require('fs');
const path = require('path');

const prListPath = 'C:/Users/pc/Desktop/levelspace/levelspace.ma/pr_list.json';
const prs = JSON.parse(fs.readFileSync(prListPath, 'utf8'));

console.log('Total PRs:', prs.length);

console.log('\n--- FIRST 10 PRs IN JSON ARRAY ---');
prs.slice(0, 10).forEach(p => {
  console.log(`#${p.number} - ${p.title} (${p.state})`);
  console.log(`  Created: ${p.created_at} | URL: ${p.html_url}`);
});

console.log('\n--- LAST 10 PRs IN JSON ARRAY ---');
prs.slice(-10).forEach(p => {
  console.log(`#${p.number} - ${p.title} (${p.state})`);
  console.log(`  Created: ${p.created_at} | URL: ${p.html_url}`);
});

console.log('\n--- SORTED BY CREATED_AT DESCENDING (TOP 10) ---');
const sortedByCreatedDesc = [...prs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
sortedByCreatedDesc.slice(0, 10).forEach(p => {
  console.log(`#${p.number} - ${p.title} (${p.state})`);
  console.log(`  Created: ${p.created_at} | URL: ${p.html_url}`);
});

console.log('\n--- SORTED BY NUMBER DESCENDING (TOP 10) ---');
const sortedByNumberDesc = [...prs].sort((a, b) => b.number - a.number);
sortedByNumberDesc.slice(0, 10).forEach(p => {
  console.log(`#${p.number} - ${p.title} (${p.state})`);
  console.log(`  Created: ${p.created_at} | URL: ${p.html_url}`);
});
