# Outsource — Agent Notes

Outsource is a Bun/TypeScript CLI for launching and managing Cursor Cloud Agents. It has no server, database, or web UI.

## Development

Use Bun exclusively. Run commands from the repository root:

```bash
bun run check
bun test
bun run build
```

Run `bun run verify` before filing a PR. Keep human-owned model configuration out of agent workflows; agents must not run `auth`, `config`, or `models`.

## Platform

Credentials use `CURSOR_API_KEY` or `~/.config/outsource/auth.json`; the environment variable overrides the file and is recommended for CI.
