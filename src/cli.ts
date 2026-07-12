#!/usr/bin/env bun
import { Command } from "commander";
import { Result } from "better-result";
import { getApiKey, storeApiKey, clearApiKey } from "./auth.js";
import { readModelSelection, writeModelSelection, configPath } from "./config.js";
import { cursorCall, cursorGateway } from "./cursor.js";
import { resolveRepository } from "./git.js";
import { prepareImages } from "./images.js";
import { validateModelSelection } from "./model-config.js";
import { CommandFailure, printError, printSuccess, type GlobalOptions } from "./output.js";
import { readSecret } from "./prompt.js";
import { installSkill, skillStatus, uninstallSkill } from "./skill-install.js";

const program = new Command().name("outsource").description("Launch and lightly manage Cursor Cloud Agents").version("0.1.0").option("--json", "emit stable JSON output").option("--debug", "include debug details in errors");
const opts = (command: Command): GlobalOptions => command.optsWithGlobals<GlobalOptions>();
const collect = (value: string, previous: string[]): string[] => [...previous, value];
async function credential(command: Command) { const result = await getApiKey(); if (Result.isError(result)) printError(result.error, opts(command)); return result.value; }

const auth = program.command("auth");
auth.command("set").action(async (_args, command: Command) => {
  if (!process.stdin.isTTY) printError({ code: "configuration_error", message: "auth set requires an interactive terminal.", retryable: false }, opts(command));
  const key = await readSecret();
  if (!key) printError({ code: "configuration_error", message: "API key cannot be empty.", retryable: false }, opts(command));
  const result = await storeApiKey(key); if (Result.isError(result)) printError(result.error, opts(command)); printSuccess({ stored: true }, opts(command), "Cursor API key stored securely.");
});
auth.command("status").action(async (_args, command: Command) => { const value = await credential(command); printSuccess({ available: true, source: value.source }, opts(command), `Credential available (${value.source}).`); });
auth.command("clear").action(async (_args, command: Command) => { const result = await clearApiKey(); if (Result.isError(result)) printError(result.error, opts(command)); printSuccess({ cleared: true }, opts(command), "Stored credential cleared."); });

const skill = program.command("skill").description("Manage the Outsource skill through skills.sh");
skill.command("install").option("--force", "replace an existing installation").action(async (args: { force?: boolean }, command: Command) => {
  const result = await installSkill(args.force); if (Result.isError(result)) printError(result.error, opts(command));
  printSuccess({ installed: true, output: result.value.output }, opts(command), result.value.output || "Outsource skill installed globally for universal agents.");
});
skill.command("status").action(async (_args, command: Command) => {
  const result = await skillStatus(); if (Result.isError(result)) printError(result.error, opts(command));
  printSuccess(result.value, opts(command), result.value.output);
});
skill.command("uninstall").action(async (_args, command: Command) => {
  const result = await uninstallSkill(); if (Result.isError(result)) printError(result.error, opts(command));
  printSuccess({ uninstalled: true, output: result.value.output }, opts(command), result.value.output || "Outsource skill removed from global universal skills.");
});

const config = program.command("config");
config.command("set-model <model-id>").option("--param <id=value>", "set a model parameter", collect, []).action(async (modelId: string, args: { param: string[] }, command: Command) => {
  const { key } = await credential(command); const listed = await cursorCall(() => cursorGateway.models(key)); if (Result.isError(listed)) printError(listed.error, opts(command));
  const validated = validateModelSelection(modelId, args.param ?? [], listed.value); if (Result.isError(validated)) printError(validated.error, opts(command));
  const saved = await writeModelSelection(validated.value); if (Result.isError(saved)) printError(saved.error, opts(command));
  const payload = validated.value.params.length ? { model: validated.value.id, params: validated.value.params } : { model: validated.value.id };
  printSuccess(payload, opts(command), validated.value.params.length ? `Default model set to ${validated.value.id} with ${validated.value.params.length} parameter(s).` : `Default model set to ${validated.value.id}.`);
});
config.command("show").action(async (_args, command: Command) => {
  const selection = await readModelSelection(); if (Result.isError(selection)) printError(selection.error, opts(command));
  const path = configPath(); if (Result.isError(path)) printError(path.error, opts(command));
  const payload = selection.value.params.length ? { model: selection.value.id, params: selection.value.params, path: path.value } : { model: selection.value.id, path: path.value };
  printSuccess(payload, opts(command));
});

program.command("models").action(async (_args, command: Command) => { const { key } = await credential(command); const result = await cursorCall(() => cursorGateway.models(key)); if (Result.isError(result)) printError(result.error, opts(command)); printSuccess({ models: result.value }, opts(command)); });

program.command("launch").requiredOption("--prompt <text>").option("--branch <branch>").option("--image <path-or-url>", "attach ordered image", collect, []).action(async (args: { prompt: string; branch?: string; image: string[] }, command: Command) => {
  const [repo, model, images, authResult] = await Promise.all([resolveRepository(args.branch), readModelSelection(), prepareImages(args.image), getApiKey()]);
  if (Result.isError(repo)) printError(repo.error, opts(command));
  if (Result.isError(model)) printError(model.error, opts(command));
  if (Result.isError(images)) printError(images.error, opts(command));
  if (Result.isError(authResult)) printError(authResult.error, opts(command));
  if (Result.isError(repo) || Result.isError(model) || Result.isError(images) || Result.isError(authResult)) return;
  const created = await cursorCall(() => cursorGateway.create({ apiKey: authResult.value.key, model: model.value, repository: repo.value.repository, startingRef: repo.value.startingRef, prompt: args.prompt, images: images.value })); if (Result.isError(created)) printError(created.error, opts(command));
  printSuccess({ agentId: created.value.agentId, runId: created.value.run.id, status: created.value.run.status, repository: repo.value.repository, startingRef: repo.value.startingRef }, opts(command));
});

program.command("status <agent-id>").action(async (agentId: string, _args, command: Command) => { const { key } = await credential(command); const result = await cursorCall(() => cursorGateway.status(key, agentId)); if (Result.isError(result)) printError(result.error, opts(command)); const latest = result.value.runs[0]; printSuccess({ agentId, name: result.value.agent.name, status: result.value.agent.status ?? latest?.status ?? "unknown", run: latest ? { runId: latest.id, status: latest.status, requestId: latest.requestId, git: latest.git, error: latest.error } : null }, opts(command)); });

program.command("follow-up <agent-id>").requiredOption("--prompt <text>").option("--image <path-or-url>", "attach ordered image", collect, []).action(async (agentId: string, args: { prompt: string; image: string[] }, command: Command) => { const [authResult, images] = await Promise.all([getApiKey(), prepareImages(args.image)]); if (Result.isError(authResult)) printError(authResult.error, opts(command)); if (Result.isError(images)) printError(images.error, opts(command)); if (Result.isError(authResult) || Result.isError(images)) return; const run = await cursorCall(() => cursorGateway.followUp({ apiKey: authResult.value.key, agentId, prompt: args.prompt, images: images.value })); if (Result.isError(run)) printError(run.error, opts(command)); printSuccess({ agentId, runId: run.value.id, status: run.value.status }, opts(command)); });

try { await program.parseAsync(); } catch (error) { if (!(error instanceof CommandFailure)) throw error; }
