# Cursor Cloud CLI — Mini PRD

## Purpose

Build a small personal CLI that lets Claude agents launch and lightly manage Cursor-hosted Cloud Agents without writing TypeScript or handling Cursor API details directly.

The CLI wraps Cursor's TypeScript SDK. Calling agents use a constrained command interface; the CLI owns API-key retrieval, repository resolution, branch validation, SDK calls, and structured output.

## Goals

- Launch Cursor Cloud Agents against the Git repository in the current working directory.
- Use a configured default model so calling agents do not choose models per task.
- Send task prompts with zero or more ordered image references.
- Create a new Cursor branch and GitHub PR for completed work.
- Let an orchestrating Claude agent hand off work and follow the resulting GitHub PR, rather than waiting for the Cursor agent.
- Support macOS and Linux only.

## Non-goals (v1)

- No local runtime or self-hosted Cursor workers.
- No multi-repository launches.
- No plan mode.
- No `wait` or `cancel` command.
- No per-invocation `--model` flag.
- No custom MCP servers, custom subagents, or session environment variables.
- No branch allowlists or protected-base policy.
- No Windows support.

## Commands

All operational commands support `--json` for machine-readable output.

```bash
cursor-cloud auth set
cursor-cloud auth status
cursor-cloud auth clear

cursor-cloud config set-model <model-id>
cursor-cloud config show

cursor-cloud launch --prompt "..." [--branch <branch>] [--image <path-or-url>]...
cursor-cloud status <agent-id>
cursor-cloud follow-up <agent-id> --prompt "..." [--image <path-or-url>]...
cursor-cloud models
```

### `auth`

Human-facing credential setup only.

- `auth set` prompts for a Cursor API key and stores it in the operating system's secure credential store.
- `auth status` reports whether a usable credential source is available, without exposing it.
- `auth clear` removes the stored credential.
- `CURSOR_API_KEY` takes precedence over stored credentials for CI or other non-interactive environments.

Credential storage:

- macOS: Keychain.
- Linux: Secret Service/libsecret.
- Do not fall back to a plaintext credential file.

### `launch`

Creates a Cursor-hosted Cloud Agent and starts its first run.

Required input:

- `--prompt`: task instructions.

Optional input:

- `--branch`: an existing remote branch to use as the PR base.
- Repeated `--image`: local image paths or HTTPS image URLs, preserved in input order.

The command returns immediately with structured details including at least:

```json
{
  "agentId": "bc-...",
  "runId": "run-...",
  "status": "creating",
  "repository": "https://github.com/org/repo",
  "startingRef": "main"
}
```

The parent Claude agent treats this as a handoff. It follows the GitHub PR workflow for completion rather than blocking on the Cursor run.

### `config`

Human-facing configuration only.

- `config set-model <model-id>` verifies the model ID against Cursor's available models, then stores it as the default model.
- `config show` displays the effective non-secret configuration.
- The draft Claude skill must instruct calling agents not to use `config` commands.

### `status`

Returns a single snapshot of an existing Cursor agent/run for debugging and orchestration. It does not wait or poll until completion.

### `follow-up`

Sends a corrective or additional prompt to a durable Cursor agent. It supports images using the same repeated `--image` interface as `launch`.

If a run is still active, surface a clear "agent busy" result; do not blindly retry.

### `models`

Lists models and valid parameters available to the authenticated Cursor account. This is for human inspection and configuration; calling agents do not select models in v1.

## Repository and branch resolution

The CLI is repo-contextual. It is run from anywhere inside the target Git working tree.

1. Locate the Git root with `git rev-parse --show-toplevel`.
2. Resolve the repository from `git remote get-url origin`.
3. Normalize and validate that it is a supported GitHub repository URL.
4. Load repository-local configuration from the Git root, if present.
5. Resolve the base branch:
   - when `--branch` is absent, detect the remote default branch;
   - when `--branch` is supplied, validate the branch name and verify that it exists on `origin` using:

     ```bash
     git ls-remote --exit-code --heads origin "refs/heads/<branch>"
     ```

6. Pass the validated branch to Cursor as `startingRef`.

Reject malformed branch names, `HEAD`, commit SHAs, and branches that do not exist on `origin`.

Any verified remote branch is valid in v1. The selected branch is only the starting/base branch: Cursor must work on a newly-created `cursor/...` branch and create a pull request. The CLI never asks Cursor to write directly to the base branch.

## Configuration

Keep configuration deliberately minimal in v1. There is one non-secret, user-level configuration file:

```text
~/.config/cursor-cloud/config.toml
```

```toml
[defaults]
model = "claude-4.6-sonnet-thinking"
```

The CLI derives repository identity from the current Git working tree, detects the repository's remote default branch when `--branch` is omitted, always creates a PR, and does not support model overrides. Therefore it does **not** need a repository-local configuration file in v1.

This configuration is for the human owner, not the calling agent. If per-repository defaults become necessary later, add them as a separate feature rather than introducing them preemptively.

The default model is the only non-secret setting configurable in v1. Keep runtime, repository resolution, PR creation, and branch validation as fixed CLI behavior rather than configuration knobs.

## Image input

`launch` and `follow-up` accept repeated `--image` arguments.

- Local paths are read and encoded by the CLI for the Cursor SDK.
- HTTPS URLs are passed as remote image references.
- Preserve the caller's image order.
- Validate supported image types and size before launching.

## Cursor SDK integration

The implementation uses `@cursor/sdk` with Cursor's cloud runtime:

- `Agent.create({ cloud: ... })` creates the hosted Cloud Agent against the resolved repository and branch.
- A configured default `model` is passed by the CLI.
- `agent.send(...)` starts the initial run or sends a follow-up.
- The CLI exposes stable Cursor agent/run IDs rather than hiding them.
- Cursor is configured to create a PR automatically.

## Output and error behavior

- Human-readable output by default; stable JSON with `--json`.
- Never print API keys, keychain values, or image file contents.
- Use [`better-result`](https://github.com/dmmulroy/better-result) internally so command paths compose typed success/failure results rather than relying on unstructured thrown errors.
- Return actionable errors for: no Git repository, missing `origin`, unsupported remote, missing credential, invalid/missing remote branch, unavailable model configuration, and Cursor SDK/API errors.
- In JSON mode, failures use a stable shape such as:

  ```json
  {
    "ok": false,
    "error": {
      "code": "branch_not_found",
      "message": "Branch 'release/next' does not exist on origin.",
      "hint": "Run 'git fetch origin' or choose an existing remote branch.",
      "retryable": false
    }
  }
  ```

- Classify transient network/rate-limit failures as retryable. Do not classify invalid input, missing configuration, authentication errors, or an active-agent/"busy" response as immediately retryable.
- Include Cursor error/request identifiers when safe and useful for debugging. Expose stack traces only with an explicit `--debug` flag.

## Draft Claude skill

Generate a **draft** `cursor-cloud` skill as part of the project. It is explicitly a starting point for manual review and substantial editing, not a final prescriptive skill.

The draft should teach Claude agents to:

- Run the CLI only inside the intended Git repository.
- Use `launch` for isolated implementation tasks.
- Provide clear success criteria, test expectations, and PR-ready instructions.
- Attach one or more images with repeated `--image` flags when visual references matter.
- Treat the returned agent ID as a handoff and follow the GitHub PR rather than waiting for completion.
- Use `follow-up` only for a concrete correction or continuation.
- Never choose models, alter CLI configuration, expose credentials, or direct Cursor to write to the base branch.

## Acceptance criteria

1. A user can securely store a Cursor API key on macOS or Linux, and `CURSOR_API_KEY` overrides it when set.
2. A human can inspect available models and set one validated default model with `config set-model`; calling agents cannot choose or alter it.
3. From a Git repository, `launch` resolves `origin`, chooses the configured/default base branch, starts a Cursor-hosted agent, and returns JSON IDs immediately.
4. `launch --branch <branch>` rejects invalid/non-remote branches and launches successfully for a verified remote branch.
5. Repeated local-path and HTTPS `--image` inputs reach the Cursor agent in order.
6. The launched Cursor agent uses the configured default model and creates a new branch plus PR.
7. `status`, `follow-up`, and `models` work through the SDK and provide machine-readable output.
8. The repository includes a clearly marked draft skill for manual editing.

## References

- [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript) — primary implementation reference for `@cursor/sdk`, cloud agent creation, structured image messages, model discovery, runs, follow-ups, and SDK errors.
- [Cursor Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) — REST-level reference for cloud-agent fields, repository/branch behavior, agent lifecycle, and model metadata.
- [`better-result`](https://github.com/dmmulroy/better-result) — Result-type library for typed, composable CLI error handling.
