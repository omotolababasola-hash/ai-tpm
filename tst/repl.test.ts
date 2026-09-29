import { test, expect } from "bun:test";
import { runRepl, type ReplIO } from "../src/repl.ts";
import type { Query, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

function assistantMsg(sessionId: string, text: string): SDKMessage {
  return {
    type: "assistant",
    session_id: sessionId,
    parent_tool_use_id: null,
    message: { content: [{ type: "text", text }] },
  } as unknown as SDKMessage;
}

function resultMsg(sessionId: string): SDKMessage {
  return { type: "result", subtype: "success", session_id: sessionId } as unknown as SDKMessage;
}

/**
 * A minimal fake satisfying the parts of Query that runRepl actually uses:
 * async iteration, interrupt(), and streamInput(). Each streamInput() call
 * advances to the next scripted "turn" of messages, mirroring how the real
 * SDK is documented to push new output after streamed input.
 */
function makeFakeQuery(turns: SDKMessage[][]) {
  let turnIndex = 0;
  let queue = [...(turns[0] ?? [])];
  const streamInputCalls: SDKUserMessage[] = [];
  let interruptCallCount = 0;

  const fake = {
    [Symbol.asyncIterator]() {
      return fake;
    },
    async next(): Promise<IteratorResult<SDKMessage, void>> {
      if (queue.length === 0) return { done: true, value: undefined };
      return { done: false, value: queue.shift()! };
    },
    async interrupt() {
      interruptCallCount += 1;
    },
    async streamInput(stream: AsyncIterable<SDKUserMessage>) {
      for await (const message of stream) streamInputCalls.push(message);
      turnIndex += 1;
      queue = [...(turns[turnIndex] ?? [])];
    },
  };

  return {
    query: fake as unknown as Query,
    streamInputCalls,
    interruptCallCount: () => interruptCallCount,
  };
}

function makeFakeIO(answers: string[]): ReplIO & { printed: string[] } {
  const printed: string[] = [];
  const queue = [...answers];
  return {
    printed,
    print(text: string) {
      printed.push(text);
    },
    async prompt(): Promise<string> {
      return queue.shift() ?? "exit";
    },
  };
}

test("runRepl: prints assistant text and exits when the user types exit", async () => {
  const { query, interruptCallCount, streamInputCalls } = makeFakeQuery([
    [assistantMsg("session-1", "How many workers do you have?"), resultMsg("session-1")],
  ]);
  const io = makeFakeIO(["exit"]);

  await runRepl(query, { io });

  expect(io.printed.join("")).toBe("How many workers do you have?");
  expect(interruptCallCount()).toBe(1);
  expect(streamInputCalls).toEqual([]);
});

test("runRepl: feeds the user's reply back in via streamInput with the captured session_id", async () => {
  const { query, streamInputCalls } = makeFakeQuery([
    [assistantMsg("session-1", "How many workers?"), resultMsg("session-1")],
    [assistantMsg("session-1", "Got it, thanks."), resultMsg("session-1")],
  ]);
  const io = makeFakeIO(["4 workers", "exit"]);

  await runRepl(query, { io });

  expect(streamInputCalls).toEqual([
    {
      type: "user",
      session_id: "session-1",
      parent_tool_use_id: null,
      message: { role: "user", content: "4 workers" },
    },
  ]);
  expect(io.printed.join("")).toBe("How many workers?Got it, thanks.");
});

test("runRepl: shouldStop ends the loop immediately without prompting", async () => {
  const { query, interruptCallCount } = makeFakeQuery([
    [assistantMsg("session-1", "calling finish_workflow"), resultMsg("session-1")],
  ]);
  let prompted = false;
  const io: ReplIO = {
    print() {},
    async prompt() {
      prompted = true;
      return "exit";
    },
  };

  await runRepl(query, { io, shouldStop: (msg) => msg.type === "assistant" });

  expect(prompted).toBe(false);
  expect(interruptCallCount()).toBe(1);
});

test("runRepl: returns naturally when the generator ends without a result message", async () => {
  const { query, interruptCallCount } = makeFakeQuery([[assistantMsg("session-1", "just some text, no result")]]);
  const io = makeFakeIO([]);

  await runRepl(query, { io });

  expect(io.printed.join("")).toBe("just some text, no result");
  expect(interruptCallCount()).toBe(0);
});
