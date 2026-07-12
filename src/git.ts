import { Result } from "better-result";
import { err, failure, ok, type CliResult } from "./error.js";
import { checked, runCommand, type CommandRunner } from "./process.js";

export interface RepositoryContext { root: string; repository: string; startingRef: string }

export function normalizeGitHubRemote(remote: string): CliResult<string> {
  const value = remote.trim().replace(/\.git$/, "");
  let match = value.match(/^git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/);
  if (!match) match = value.match(/^ssh:\/\/git@github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/);
  if (!match) match = value.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/);
  return match?.[1]
    ? ok(`https://github.com/${match[1]}`)
    : err(failure("unsupported_remote", `Origin '${remote}' is not a supported GitHub repository URL.`, { hint: "Use an HTTPS or SSH github.com origin URL." }));
}

export function validateBranchName(branch: string): CliResult<string> {
  const sha = /^[0-9a-f]{7,40}$/i.test(branch);
  const invalid = !branch || branch === "HEAD" || sha || branch.startsWith("-") || branch.endsWith("/") || branch.endsWith(".") ||
    branch.includes("..") || branch.includes("@{") || /[\x00-\x20~^:?*\\[]/.test(branch) || branch.split("/").some((part) => !part || part.startsWith(".") || part.endsWith(".lock"));
  return invalid
    ? err(failure("invalid_branch", `Branch '${branch}' is not a valid branch name.`, { hint: "Provide the name of an existing branch on origin, not HEAD or a commit SHA." }))
    : ok(branch);
}

export async function resolveRepository(branch: string | undefined, runner: CommandRunner = runCommand): Promise<CliResult<RepositoryContext>> {
  const root = await checked(runner, ["git", "rev-parse", "--show-toplevel"], "not_git_repository", "Run outsource from inside a Git working tree.");
  if (Result.isError(root)) return err(root.error);
  const remote = await checked(runner, ["git", "-C", root.value, "remote", "get-url", "origin"], "missing_origin", "The repository has no origin remote.");
  if (Result.isError(remote)) return err(remote.error);
  const repository = normalizeGitHubRemote(remote.value);
  if (Result.isError(repository)) return err(repository.error);

  let startingRef: string;
  if (branch !== undefined) {
    const valid = validateBranchName(branch);
    if (Result.isError(valid)) return err(valid.error);
    const exists = await runner(["git", "-C", root.value, "ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`]);
    if (exists.exitCode !== 0) return err(failure("branch_not_found", `Branch '${branch}' does not exist on origin.`, { hint: "Run 'git fetch origin' or choose an existing remote branch." }));
    startingRef = branch;
  } else {
    const symbolic = await runner(["git", "-C", root.value, "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    if (symbolic.exitCode === 0 && symbolic.stdout.trim().startsWith("origin/")) {
      startingRef = symbolic.stdout.trim().slice("origin/".length);
    } else {
      const ls = await checked(runner, ["git", "-C", root.value, "ls-remote", "--symref", "origin", "HEAD"], "branch_not_found", "Could not detect origin's default branch.");
      if (Result.isError(ls)) return err(ls.error);
      const match = ls.value.match(/^ref: refs\/heads\/([^\s]+)\s+HEAD/m);
      if (!match?.[1]) return err(failure("branch_not_found", "Could not detect origin's default branch.", { hint: "Pass --branch with an existing remote branch." }));
      startingRef = match[1];
    }
  }
  return ok({ root: root.value, repository: repository.value, startingRef });
}
