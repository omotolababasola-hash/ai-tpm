import { test, expect, mock, beforeEach } from "bun:test";
import { parseArgs, handleLogin, run, type LoginDeps } from "../src/cli.ts";

const savedConfigs: unknown[] = [];
const deviceLoginCalls: string[] = [];
let deviceLoginBehavior: () => Promise<void> = async () => {};

function makeDeps(): LoginDeps {
  return {
    saveConfig: mock(async (config: unknown) => {
      savedConfigs.push(config);
    }) as unknown as LoginDeps["saveConfig"],
    deviceCodeLogin: mock(async (backendUrl: string) => {
      deviceLoginCalls.push(backendUrl);
      await deviceLoginBehavior();
    }) as unknown as LoginDeps["deviceCodeLogin"],
  };
}

beforeEach(() => {
  savedConfigs.length = 0;
  deviceLoginCalls.length = 0;
  deviceLoginBehavior = async () => {};
});

test("parseArgs: no args -> help", () => {
  expect(parseArgs([])).toEqual({ type: "help" });
});

test("parseArgs: help/--help/-h -> help", () => {
  expect(parseArgs(["help"])).toEqual({ type: "help" });
  expect(parseArgs(["--help"])).toEqual({ type: "help" });
  expect(parseArgs(["-h"])).toEqual({ type: "help" });
});

test("parseArgs: login with --api-key", () => {
  expect(parseArgs(["login", "--api-key", "sk-ant-test"])).toEqual({
    type: "login",
    apiKey: "sk-ant-test",
    backendUrl: undefined,
  });
});

test("parseArgs: login with --backend-url", () => {
  expect(parseArgs(["login", "--backend-url", "https://backend.example"])).toEqual({
    type: "login",
    apiKey: undefined,
    backendUrl: "https://backend.example",
  });
});

test("parseArgs: login without flags", () => {
  expect(parseArgs(["login"])).toEqual({
    type: "login",
    apiKey: undefined,
    backendUrl: undefined,
  });
});

test("parseArgs: unrecognized command", () => {
  expect(parseArgs(["frobnicate", "--x"])).toEqual({
    type: "unknown",
    input: ["frobnicate", "--x"],
  });
});

test("handleLogin: saves byok config when apiKey is given", async () => {
  const code = await handleLogin("sk-ant-test", undefined, makeDeps());
  expect(code).toBe(0);
  expect(savedConfigs).toEqual([{ mode: "byok", anthropicApiKey: "sk-ant-test" }]);
  expect(deviceLoginCalls).toEqual([]);
});

test("handleLogin: apiKey takes priority over backendUrl", async () => {
  const code = await handleLogin("sk-ant-test", "https://backend.example", makeDeps());
  expect(code).toBe(0);
  expect(savedConfigs).toEqual([{ mode: "byok", anthropicApiKey: "sk-ant-test" }]);
  expect(deviceLoginCalls).toEqual([]);
});

test("handleLogin: runs device-code login when only backendUrl is given", async () => {
  const code = await handleLogin(undefined, "https://backend.example", makeDeps());
  expect(code).toBe(0);
  expect(deviceLoginCalls).toEqual(["https://backend.example"]);
});

test("handleLogin: device-code failure returns exit code 1", async () => {
  deviceLoginBehavior = async () => {
    throw new Error("Login denied");
  };
  const code = await handleLogin(undefined, "https://backend.example", makeDeps());
  expect(code).toBe(1);
});

test("handleLogin: fails without apiKey or backendUrl and saves nothing", async () => {
  const code = await handleLogin(undefined, undefined, makeDeps());
  expect(code).toBe(1);
  expect(savedConfigs).toEqual([]);
  expect(deviceLoginCalls).toEqual([]);
});

test("run: no args dispatches help with exit code 0", async () => {
  expect(await run([])).toBe(0);
});

test("run: unknown command exits with code 1", async () => {
  expect(await run(["bogus"])).toBe(1);
});

test("run: login dispatches through to handleLogin with injected deps", async () => {
  expect(await run(["login", "--api-key", "sk-ant-test"], makeDeps())).toBe(0);
  expect(savedConfigs).toEqual([{ mode: "byok", anthropicApiKey: "sk-ant-test" }]);
});