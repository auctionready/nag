---
name: deploy-dev
description: Deploy the current git branch to the dev VPS by dispatching the "Deploy VPS (manual)" GitHub Actions workflow. Use when the user wants to deploy what they're working on to the dev server.
---

Dispatch the manual VPS deploy workflow for the current branch:

1. Get the current branch: `git rev-parse --abbrev-ref HEAD`
2. Make sure it's pushed so the VPS can fetch it: `git push -u origin <branch>`
3. Trigger the workflow on that branch: `gh workflow run deploy-vps-manual.yml --ref <branch>`
4. Report the run URL from `gh run list --workflow=deploy-vps-manual.yml --limit 1` so the user can watch it.

Do all steps sequentially. Do not do anything else.
