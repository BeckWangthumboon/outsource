# AGENTS.md

## Cursor Cloud specific instructions

`outsource-cli` is a single Bun/TypeScript CLI (binaries `outsource` and `os`) that wraps
`@cursor/sdk` to launch and manage Cursor-hosted Cloud Agents. There is no local server,
database, or web UI — it is a stateless CLI that talks to the hosted Cursor Cloud API and
GitHub. Standard dev commands live in `package.json` (`build`, `check`, `test`, `verify`).

Common commands (run from the repo root):
- Type check: `bun run check` (`tsc --noEmit`)
- Tests: `bun test`
- Build: `bun run build` (emits `dist/cli.js`)
- Everything: `bun run verify`
- Run the built CLI: `./dist/cli.js <command>` (add `--json` for machine-readable output)

Non-obvious caveats discovered during setup:
- Bun is the runtime and package manager (no npm/yarn/pnpm). It is installed at
  `~/.bun/bin/bun` and added to `PATH` via `~/.bashrc`. Non-interactive shells that do not
  source `~/.bashrc` should call bun via its full path (`~/.bun/bin/bun`).
- The cloud git environment has a global `url.<token>@github.com/.insteadOf` rewrite, so
  `git remote get-url origin` returns a tokenized URL like
  `https://x-access-token:...@github.com/owner/repo`. The CLI's `normalizeGitHubRemote`
  only accepts clean `https://github.com/<owner>/<repo>`, `git@github.com:...`, or
  `ssh://git@github.com/...` URLs, so running `launch`/`status`/etc. against this
  workspace's own origin returns an `unsupported_remote` error. To exercise repo/branch
  resolution end to end, run inside a repo whose *resolved* origin is a clean github.com
  URL — e.g. set `GIT_CONFIG_GLOBAL=/dev/null` in a scratch repo before running the CLI.
- Core commands (`launch`, `models`, `status`, `follow-up`, `config set-model`) call the
  live Cursor Cloud API and require a valid `CURSOR_API_KEY`. The env var takes precedence
  over the OS credential store. With an invalid/absent key the pipeline still runs fully
  (repo resolution, branch validation, model read, image prep) and fails only at the API
  call with `authentication_error`.
- `auth set/status/clear` use the OS secure credential store; on Linux this needs
  `secret-tool` (from `libsecret-tools`) plus a running Secret Service, which is not
  installed by default. Prefer `CURSOR_API_KEY` to bypass the credential store.
- Non-secret config lives at `~/.config/outsource/config.toml` (`[defaults] model = "..."`).
  `config set-model` validates the model against the live API before writing.
- Platform support is macOS and Linux only; Windows is explicitly rejected.
