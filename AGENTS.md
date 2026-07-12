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

The CLI supports macOS Keychain and Linux Secret Service. `CURSOR_API_KEY` overrides stored credentials. Windows is unsupported.
