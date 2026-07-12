# outsource

A Bun/TypeScript CLI for launching and lightly managing Cursor-hosted Cloud Agents from the current GitHub repository.

## Install

```bash
bun install
bun run build
bun link
```

The install exposes both `outsource` and the `os` shorthand.

Requires Bun, Git, and either macOS Keychain or Linux Secret Service (`secret-tool` from `libsecret-tools`). Set `CURSOR_API_KEY` for CI; it takes precedence over stored credentials.

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
