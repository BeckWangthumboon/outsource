---
name: cursor-cloud
description: Delegate isolated implementation work in the current GitHub repository to a Cursor-hosted Cloud Agent through the cursor-cloud CLI. Use when an agent should hand off a bounded coding task, attach visual references, inspect one run snapshot, or send a concrete correction to an existing Cursor Cloud Agent.
---

# Cursor Cloud (Draft)

> Draft for manual review and substantial editing. Do not treat this as final policy.

## Delegate work

1. Confirm the shell is inside the intended Git working tree.
2. Define one isolated implementation task with clear success criteria, expected tests, and instructions to leave a PR-ready result.
3. Run `cursor-cloud launch --prompt "..." --json`. Add each visual reference with a repeated `--image <path-or-https-url>` flag.
4. Record the returned agent and run IDs, repository, and starting ref.
5. Treat the launch as a handoff. Follow the resulting GitHub PR workflow instead of waiting or polling the Cursor run.

Use `--branch <remote-branch>` only when the task must start from a specific existing branch on `origin`.

## Correct or continue

Use `cursor-cloud status <agent-id> --json` for one debugging snapshot. Do not poll continuously.

Use `cursor-cloud follow-up <agent-id> --prompt "..." --json` only for a concrete correction or continuation. Repeat `--image` for visual context. If the CLI reports `agent_busy`, follow the active work rather than retrying blindly.

## Guardrails

- Never run `auth`, `config`, or `models`; those commands belong to the human owner.
- Never choose or override a model.
- Never expose, request, print, or transmit credentials.
- Never tell Cursor to write directly to the starting/base branch.
- Never use this CLI outside the intended repository.
- Never assume launch completion from the immediate response; track the GitHub PR.
