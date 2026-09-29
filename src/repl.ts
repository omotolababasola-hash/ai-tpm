import { createInterface } from "node:readline/promises";
import type { Query, SDKAssistantMessage, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { userTurn } from "./agent.ts";

export interface ReplIO {
  print(text: string): void;
  prompt(question: string): Promise<string>;
}

export function createTerminalIO(): ReplIO {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    print(text: string) {
      process.stdout.write(text);
    },
    prompt(question: string): Promise<string> {
      return rl.question(question);
    },
  };
}

export interface RunReplOptions {
  io: ReplIO;
  /** Inspect each message as it streams in; returning true ends the loop immediately (no further prompting). */
  shouldStop?: (message: SDKMessage) => boolean;
}

/**
 * Drives one Query session interactively: streams assistant text to the
 * terminal, and on each "result" message (the agent has nothing more to
 * say right now) prompts the user and feeds their reply back in via
 * streamInput on the SAME generator, per the SDK's documented multi-turn
 * pattern. Ends when the user types "exit", shouldStop matches a message,
 * or the underlying generator completes on its own.
 */
export async function runRepl(query: Query, opts: RunReplOptions): Promise<void> {
  const { io, shouldStop = () => false } = opts;
  let sessionId: string | undefined;

  for await (const message of query) {
    if ("session_id" in message) {
      sessionId = message.session_id;
    }

    if (message.type === "assistant") {
      const text = extractText(message);
      if (text) io.print(text);
    }

    if (shouldStop(message)) {
      await query.interrupt();
      return;
    }

    if (message.type === "result") {
      if (!sessionId) return;

      const answer = await io.prompt("\n> ");
      if (answer.trim().toLowerCase() === "exit") {
        await query.interrupt();
        return;
      }

      await query.streamInput(singleMessage(userTurn(sessionId, answer)));
    }
  }
}

function extractText(message: SDKAssistantMessage): string {
  const content = message.message.content;
  if (typeof content === "string") return content;

  // message.message's real type resolves through @anthropic-ai/sdk, which
  // isn't installed as its own package (see agent.ts) — cast to the shape
  // we actually need rather than fight the broken inference chain.
  const blocks = content as Array<{ type: string; text?: string }>;
  return blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

async function* singleMessage(message: SDKUserMessage): AsyncGenerator<SDKUserMessage> {
  yield message;
}
