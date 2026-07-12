# outsource

A CLI for launching and managing Cursor Cloud Agents for agents.

I built this with 5.6 Sol so that Codex can orchestrate cheaper, straightfoward tasks to Composer instead of burning valuable Sol tokens.

## Install

```bash
bun add --global 'git+ssh://git@github.com/BeckWangthumboon/outsource.git#4f4e0ee6f405d36342125013250a6c914ab5d7ed'
outsource skill install
```

The GitHub install exposes both `outsource` and the `os` shorthand. It requires Bun 1.3 or newer; no npm publication is needed.

`outsource skill install` wraps the [skills.sh CLI](https://www.skills.sh/docs/cli) and installs the `outsource` skill globally for universal agents at `~/.agents/skills`. It runs the equivalent of:

```bash
npx skills add BeckWangthumboon/outsource --skill outsource --agent universal --global
```

To upgrade after a new release, replace the global CLI with its tagged Git source, then refresh the globally installed skill:

```bash
bun remove --global outsource-cli
bun add --global 'git+ssh://git@github.com/BeckWangthumboon/outsource.git#4f4e0ee6f405d36342125013250a6c914ab5d7ed'
outsource skill install --force
```

To remove the global universal skill and CLI:

```bash
outsource skill uninstall
bun remove --global outsource-cli
```

For local development:

```bash
bun install --frozen-lockfile
bun run verify
bun link
```

Requires Bun and Git. Credentials use macOS Keychain or Linux Secret Service (`secret-tool` from `libsecret-tools`) when available; on Linux without a secret service, Outsource securely falls back to `~/.config/outsource/auth.json` (directory mode `0700`, file mode `0600`). `CURSOR_API_KEY` takes precedence and is recommended for CI.

## Setup and usage

```bash
outsource auth set
outsource models
outsource config set-model <model-id> [--param <id=value>]...
outsource launch --prompt "Implement the requested change and open a PR" --json
outsource status <agent-id> --json
outsource follow-up <agent-id> --prompt "Fix the failing test" --json
```

Run commands from anywhere inside the intended Git working tree. `launch` resolves and validates `origin`, uses its default branch unless `--branch` is supplied, and instructs Cursor to create a new branch and PR. Repeat `--image` for ordered local PNG/JPEG/GIF/WebP references (maximum 10 MiB) or HTTPS URLs.

Configure the default model atomically with `config set-model`. Each invocation fully replaces the saved model and any explicit parameters; changing models never preserves parameters from a previous model. Repeat `--param <id=value>` to set supported model parameters validated against the authenticated Cursor catalog, for example:

```bash
os config set-model composer-2.5 --param fast=false
```

Model-only configuration is stored as:

```toml
[defaults]
model = "composer-2.5"
```

When explicit parameters are configured:

```toml
[defaults]
model = "composer-2.5"

[[defaults.params]]
id = "fast"
value = "false"
```
