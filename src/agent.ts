import {
  query as claudeQuery,
  type Options,
  type Query,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { resolveAuthEnv, type Config } from "./config.ts";

export interface AgentOptions {
  systemPrompt: string;
  authConfig: Config;
  mcpServers?: Options["mcpServers"];
  allowedTools?: string[];
}

/**
 * Starts a Claude Agent SDK session for a workflow. Auth/routing come from
 * the resolved Config (BYOK talks to Anthropic directly, proxy mode routes
 * through ai-ic-backend) rather than relying on ambient env vars, so a
 * session's auth is always explicit at the call site.
 */
export function startSession(
  initialPrompt: string,
  opts: AgentOptions,
  queryFn: typeof claudeQuery = claudeQuery,
): Query {
  return queryFn({
    prompt: initialPrompt,
    options: {
      systemPrompt: opts.systemPrompt,
      env: { ...process.env, ...resolveAuthEnv(opts.authConfig) },
      mcpServers: opts.mcpServers,
      allowedTools: opts.allowedTools,
    },
  });
}

/**
 * Builds a follow-up user turn for Query.streamInput(). Requires the
 * session_id from a message already received on the session — the initial
 * turn has no session yet, which is why startSession takes a plain string.
 */
export function userTurn(sessionId: string, text: string): SDKUserMessage {
  return {
    type: "user",
    session_id: sessionId,
    parent_tool_use_id: null,
    message: { role: "user", content: text },
  };
}