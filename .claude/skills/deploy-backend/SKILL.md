---
name: deploy-backend
description: Deploy the backend to prod by dispatching the "Deploy backend" GitHub Actions workflow. Use when the user wants to deploy the backend to production.
---

Dispatch the backend deploy workflow:

1. Pick the ref:
   - If the user explicitly said to deploy the current branch, use it (skip step 2's prompt).
   - Otherwise determine the current branch with `git branch --show-current`. If it is `main`, use `main`. If it is anything else, ask the user whether to deploy `main` or the current branch and wait for their answer.
2. If the chosen ref is not `main`, verify the remote is in sync:
   - `git fetch origin <ref>` — if the remote branch does not exist, tell the user and ask whether to push it before deploying.
   - Compare `git rev-parse <ref>` to `git rev-parse origin/<ref>`. If they differ, also check `git status --porcelain` for uncommitted changes. Report the divergence (ahead/behind, dirty working tree) and ask the user how to proceed before continuing. Do not auto-push.
3. Trigger the workflow: `gh workflow run deploy-backend.yml --ref <ref>`
4. Report the run URL from `gh run list --workflow=deploy-backend.yml --limit 1` so the user can watch it.

Do all steps sequentially. Do not do anything else.
