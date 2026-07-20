---
name: outsource
description: Delegate a bounded implementation task in the current GitHub repository to a Cursor Cloud Agent through the outsource CLI. Use when work should be handed off with clear requirements, tests, and PR-ready completion, optionally with image references or a specific remote base branch.
---

# Outsource

Delegate implementation to Cursor and treat the resulting GitHub pull request as the completion surface.

## Launch a task

1. Establish the handoff boundary. The Cursor agent starts from the selected remote branch on `origin` (or `origin`'s default branch when `--branch` is omitted). It cannot see the local working tree, uncommitted changes, local-only files, or the conversation that led to this task.
2. Make every required input available to the agent:
   - Attach visual references with `--image`, or describe them precisely in the prompt, when they are not present in the repository.
   - Do not refer to prior discussion, “the design we picked,” temporary local code, or implied context. Restate the final decision and the exact files, behavior, and acceptance criteria.
3. Write a self-contained prompt containing the task, relevant repository context, final design or technical decisions, success criteria, required tests, and instructions to create a focused PR.
4. Launch once:

```bash
outsource launch --prompt "..." --json
```

Without `--branch`, the agent starts from `origin`'s default branch—not the current local branch. Use `--branch <remote-branch>` to start from a specific, already-pushed branch on `origin`. Repeat `--image <path-or-https-url>` for ordered visual references.

5. Return the agent ID, run ID, repository, and starting ref as a handoff.
6. Follow completion through the GitHub PR. Do not wait for, poll, or repeatedly query the Cursor run.

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
