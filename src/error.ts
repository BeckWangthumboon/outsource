import { Result } from "better-result";

export type ErrorCode =
  | "not_git_repository" | "missing_origin" | "unsupported_remote"
  | "invalid_branch" | "branch_not_found" | "missing_credential"
  | "missing_model" | "model_unavailable" | "invalid_model_param" | "duplicate_model_param"
  | "unsupported_model_param" | "unsupported_model_param_value" | "invalid_image"
  | "image_too_large" | "agent_busy" | "authentication_error"
  | "rate_limited" | "network_error" | "agent_not_found"
  | "cursor_api_error" | "configuration_error" | "internal_error"
  | "skill_already_installed" | "skill_not_installed" | "skill_install_error";

export interface CliError {
  code: ErrorCode;
  message: string;
  hint?: string;
  retryable: boolean;
  requestId?: string;
  cause?: unknown;
}

export type CliResult<T> = Result<T, CliError>;
export const ok = <T>(value: T): CliResult<T> => Result.ok(value);
export const err = <T = never>(error: CliError): CliResult<T> => Result.err(error);

export function failure(code: ErrorCode, message: string, options: Partial<Omit<CliError, "code" | "message">> = {}): CliError {
  return { code, message, retryable: false, ...options };
}
