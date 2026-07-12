import { Agent, Cursor, AgentBusyError, AgentNotFoundError, AuthenticationError, ConfigurationError, CursorSdkError, NetworkError, RateLimitError, type Run, type SDKAgentInfo, type SDKImage, type SDKModel } from "@cursor/sdk";
import { err, failure, ok, type CliError, type CliResult } from "./error.js";

export interface CursorGateway {
  models(apiKey: string): Promise<SDKModel[]>;
  create(input: { apiKey: string; model: string; repository: string; startingRef: string; prompt: string; images: SDKImage[] }): Promise<{ agentId: string; run: Run }>;
  status(apiKey: string, agentId: string): Promise<{ agent: SDKAgentInfo; runs: Run[] }>;
  followUp(input: { apiKey: string; agentId: string; prompt: string; images: SDKImage[] }): Promise<Run>;
}

export const cursorGateway: CursorGateway = {
  models: (apiKey) => Cursor.models.list({ apiKey }),
  async create(input) {
    const agent = await Agent.create({ apiKey: input.apiKey, model: { id: input.model }, mode: "agent", cloud: { repos: [{ url: input.repository, startingRef: input.startingRef }], workOnCurrentBranch: false, autoCreatePR: true } });
    const run = await agent.send(input.images.length ? { text: input.prompt, images: input.images } : input.prompt);
    return { agentId: agent.agentId, run };
  },
  async status(apiKey, agentId) {
    const [agent, runs] = await Promise.all([Agent.get(agentId, { apiKey }), Agent.listRuns(agentId, { runtime: "cloud", apiKey, limit: 20 })]);
    return { agent, runs: runs.items };
  },
  async followUp(input) {
    const agent = await Agent.resume(input.agentId, { apiKey: input.apiKey, cloud: {} });
    return agent.send(input.images.length ? { text: input.prompt, images: input.images } : input.prompt);
  },
};

export function mapCursorError(cause: unknown): CliError {
  const detail = cause instanceof CursorSdkError ? { requestId: cause.requestId, cause } : { cause };
  if (cause instanceof AgentBusyError) return failure("agent_busy", "The agent already has an active run.", { hint: "Check its status and send the follow-up after the active run finishes.", ...detail });
  if (cause instanceof AuthenticationError) return failure("authentication_error", "Cursor rejected the configured API key.", { hint: "Run 'cursor-cloud auth set' with a valid key.", ...detail });
  if (cause instanceof RateLimitError) return failure("rate_limited", cause.message, { retryable: true, ...detail });
  if (cause instanceof NetworkError) return failure("network_error", cause.message, { retryable: true, ...detail });
  if (cause instanceof AgentNotFoundError) return failure("agent_not_found", cause.message, detail);
  if (cause instanceof ConfigurationError) return failure("configuration_error", cause.message, detail);
  if (cause instanceof CursorSdkError) return failure("cursor_api_error", cause.message, { retryable: cause.isRetryable, ...detail });
  return failure("cursor_api_error", cause instanceof Error ? cause.message : "Cursor SDK request failed.", detail);
}
export async function cursorCall<T>(operation: () => Promise<T>): Promise<CliResult<T>> { try { return ok(await operation()); } catch (cause) { return err(mapCursorError(cause)); } }
