---
name: pr-cycle
description: Create a PR with description, merge it, checkout main, pull with prune, and delete the local merged branch. Use when the user wants to complete the full PR cycle for the current branch.
---

Complete the full PR cycle for the current branch:

1. If any changes, push the current branch to the remote repository: `git push origin <branch-name>`
2. Create a pull request using `gh pr create` with an appropriate title and a brief description of the changes
3. Merge the PR using `gh pr merge --merge --delete-branch` (merges and deletes the remote branch)
4. Check out the main branch: `git checkout main`
5. Pull and prune remote tracking refs: `git pull -p`
6. Delete the local branch that was merged: `git branch -d <branch-name>`

Do all steps sequentially, waiting for each to succeed before proceeding. Do not do anything else.