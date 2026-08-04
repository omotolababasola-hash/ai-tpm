import { test, expect, mock } from "bun:test";
import { startSession, userTurn } from "../src/agent.ts";
import type { Config } from "../src/config.ts";
import type { Query } from "@anthropic-ai/claude-agent-sdk";

const byokConfig: Config = { mode: "byok", anthropicApiKey: "sk-ant-test" };
const proxyConfig: Config = {
  mode: "proxy",
  backendUrl: "https://backend.example",
  proxyToken: "tok-123",
};

const sentinelQuery = { __sentinel: true } as unknown as Query;

function makeFakeQueryFn() {
  return mock((_params: unknown) => sentinelQuery);
}

test("startSession: passes the initial prompt straight through", () => {
  const fakeQuery = makeFakeQueryFn();

  startSession("break this task down", { systemPrompt: "sys", authConfig: byokConfig }, fakeQuery as never);

  expect(fakeQuery.mock.calls[0]?.[0]).toMatchObject({ prompt: "break this task down" });
});

test("startSession: BYOK config resolves to ANTHROPIC_API_KEY only", () => {
  const fakeQuery = makeFakeQueryFn();

  startSession("task", { systemPrompt: "sys", authConfig: byokConfig }, fakeQuery as never);

  const params = fakeQuery.mock.calls[0]?.[0] as { options: { env: Record<string, string> } };
  expect(params.options.env.ANTHROPIC_API_KEY).toBe("sk-ant-test");
  expect(params.options.env.ANTHROPIC_BASE_URL).toBeUndefined();
});

test("startSession: proxy config resolves to token + base URL", () => {
  const fakeQuery = makeFakeQueryFn();

  startSession("task", { systemPrompt: "sys", authConfig: proxyConfig }, fakeQuery as never);

  const params = fakeQuery.mock.calls[0]?.[0] as { options: { env: Record<string, string> } };
  expect(params.options.env.ANTHROPIC_API_KEY).toBe("tok-123");
  expect(params.options.env.ANTHROPIC_BASE_URL).toBe("https://backend.example");
});

test("startSession: passes systemPrompt, mcpServers, and allowedTools through unchanged", () => {
  const fakeQuery = makeFakeQueryFn();
  const mcpServers = { "my-server": { type: "sdk" } } as never;

  startSession(
    "task",
    { systemPrompt: "you are a helpful tpm", authConfig: byokConfig, mcpServers, allowedTools: ["mcp__my-server__finish"] },
    fakeQuery as never,
  );

  const params = fakeQuery.mock.calls[0]?.[0] as {
    options: { systemPrompt: string; mcpServers: unknown; allowedTools: string[] };
  };
  expect(params.options.systemPrompt).toBe("you are a helpful tpm");
  expect(params.options.mcpServers).toBe(mcpServers);
  expect(params.options.allowedTools).toEqual(["mcp__my-server__finish"]);
});

test("startSession: returns whatever the injected queryFn returns", () => {
  const fakeQuery = makeFakeQueryFn();

  const result = startSession("task", { systemPrompt: "sys", authConfig: byokConfig }, fakeQuery as never);

  expect(result).toBe(sentinelQuery);
});

test("userTurn: builds a well-formed SDKUserMessage", () => {
  const msg = userTurn("session-abc", "4 workers, deadline is Friday");

  expect(msg).toEqual({
    type: "user",
    session_id: "session-abc",
    parent_tool_use_id: null,
    message: { role: "user", content: "4 workers, deadline is Friday" },
  });
});
