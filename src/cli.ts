#!/usr/bin/env bun
import { saveConfig } from "./config.ts";
import { login as deviceCodeLogin } from "./auth.ts";

export type Command =
  | { type: "login"; apiKey?: string; backendUrl?: string }
  | { type: "help" }
  | { type: "unknown"; input: string[] };

export const USAGE = `Usage: ai-tpm <command> [options]

Commands:
  login --api-key <key>       Save an Anthropic API key for BYOK mode
  login --backend-url <url>   Device-code login against ai-ic-backend
  help                        Show this help message
`;

export function parseArgs(argv: string[]): Command {
  const [sub, ...rest] = argv;

  if (sub === undefined || sub === "help" || sub === "--help" || sub === "-h") {
    return { type: "help" };
  }

  if (sub === "login") {
    return {
      type: "login",
      apiKey: readFlagValue(rest, "--api-key"),
      backendUrl: readFlagValue(rest, "--backend-url"),
    };
  }

  return { type: "unknown", input: argv };
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

export interface LoginDeps {
  saveConfig: typeof saveConfig;
  deviceCodeLogin: typeof deviceCodeLogin;
}

const defaultLoginDeps: LoginDeps = { saveConfig, deviceCodeLogin };

export async function handleLogin(
  apiKey: string | undefined,
  backendUrl: string | undefined,
  deps: LoginDeps = defaultLoginDeps,
): Promise<number> {
  if (apiKey) {
    await deps.saveConfig({ mode: "byok", anthropicApiKey: apiKey });
    console.log("Saved your Anthropic API key. ai-tpm will call Anthropic directly.");
    return 0;
  }

  if (backendUrl) {
    try {
      await deps.deviceCodeLogin(backendUrl);
      return 0;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  }

  console.error("login requires either --api-key <key> (BYOK) or --backend-url <url> (device-code login).");
  return 1;
}

export async function run(argv: string[], deps: LoginDeps = defaultLoginDeps): Promise<number> {
  const command = parseArgs(argv);

  switch (command.type) {
    case "help":
      console.log(USAGE);
      return 0;
    case "login":
      return handleLogin(command.apiKey, command.backendUrl, deps);
    case "unknown":
      console.error(`Unknown command: ${command.input.join(" ")}\n`);
      console.log(USAGE);
      return 1;
  }
}

if (import.meta.main) {
  const exitCode = await run(process.argv.slice(2));
  process.exit(exitCode);
}