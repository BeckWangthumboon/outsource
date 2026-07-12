---
name: outsource
description: Delegate a bounded implementation task in the current GitHub repository to a Cursor Cloud Agent through the outsource CLI. Use when work should be handed off with clear requirements, tests, and PR-ready completion, optionally with image references or a specific remote base branch.
---

# Outsource

Delegate implementation to Cursor and treat the resulting GitHub pull request as the completion surface.

## Launch a task

1. Run inside the intended Git repository. Ensure the starting branch and any required changes are pushed; Cursor cannot see uncommitted local work.
2. Write a self-contained prompt containing the task, relevant context, success criteria, required tests, and instructions to create a focused PR without writing to the base branch.
3. Launch once:

```bash
outsource launch --prompt "..." --json
```

Use `--branch <remote-branch>` only to start from a specific existing branch on `origin`. Repeat `--image <path-or-https-url>` for ordered visual references.

4. Return the agent ID, run ID, repository, and starting ref as a handoff.
5. Follow completion through the GitHub PR. Do not wait for, poll, or repeatedly query the Cursor run.

## Review and corrections

Prefer GitHub PR state, checks, reviews, and commits as the source of truth. Use `outsource status <agent-id> --json` only for a user-requested, one-time diagnostic when no PR information is available.

After reviewing the PR, use `outsource follow-up <agent-id> --prompt "..." --json` only for a concrete correction or continuation. Do not use follow-ups to ask for progress. If the agent is busy, surface that result without retrying blindly.

## Human-owned setup

Run these commands only when the user explicitly asks to configure Outsource:

```bash
outsource auth set                          # securely store the Cursor API key
outsource auth status                       # report whether credentials are available
outsource models                            # inspect available models and parameters
outsource config set-model <id> [--param id=value]...
outsource config show
```

`CURSOR_API_KEY` overrides stored credentials. Never expose credentials or choose/change the model unless the user requests it.
