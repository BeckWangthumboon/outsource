# cursor-cloud

A Bun/TypeScript CLI for launching and lightly managing Cursor-hosted Cloud Agents from the current GitHub repository.

## Install

```bash
bun install
bun run build
bun link
```

Requires Bun, Git, and either macOS Keychain or Linux Secret Service (`secret-tool` from `libsecret-tools`). Set `CURSOR_API_KEY` for CI; it takes precedence over stored credentials.

## Setup and usage

```bash
cursor-cloud auth set
cursor-cloud models
cursor-cloud config set-model <model-id>
cursor-cloud launch --prompt "Implement the requested change and open a PR" --json
cursor-cloud status <agent-id> --json
cursor-cloud follow-up <agent-id> --prompt "Fix the failing test" --json
```

Run commands from anywhere inside the intended Git working tree. `launch` resolves and validates `origin`, uses its default branch unless `--branch` is supplied, and instructs Cursor to create a new branch and PR. Repeat `--image` for ordered local PNG/JPEG/GIF/WebP references (maximum 10 MiB) or HTTPS URLs.
