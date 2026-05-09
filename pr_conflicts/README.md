This folder contains draft issue content for PRs with merge conflicts against `origin/main`.

Files:
- `conflicting_prs.md` — summary of all conflicting PRs.
- `pr-<number>.md` — issue body you can paste into GitHub Issues or post via the provided `post_conflicts.cjs` script.

To automatically create GitHub issues, set the environment variable `GITHUB_TOKEN` (repo scope) and run:

```
node scripts/post_conflicts.cjs
```

This will post one issue per conflict and report created issue URLs in `posted_issues.json`.
