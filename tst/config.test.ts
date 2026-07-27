import { test, expect, mock, beforeEach } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";

const files = new Map<string, string>();

mock.module("node:fs/promises", () => ({
  mkdir: mock(async () => undefined),
  readFile: mock(async (path: string) => {
    const content = files.get(path);
    if (content === undefined) {
      const err = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    }
    return content;
  }),
  writeFile: mock(async (path: string, data: string) => {
    files.set(path, data);
  }),
}));

// Must import after mock.module() registers the fs/promises mock, since
// config.ts's own top-level import of fs/promises needs to resolve to it.
const { loadConfig, saveConfig, resolveAuthEnv, projectOutputDir } = await import("../src/config.ts");

beforeEach(() => {
  files.clear();
});

test("loadConfig returns null when no config file exists", async () => {
  expect(await loadConfig()).toBeNull();
});

test("saveConfig then loadConfig round-trips byok mode", async () => {
  await saveConfig({ mode: "byok", anthropicApiKey: "sk-ant-test" });
  expect(await loadConfig()).toEqual({ mode: "byok", anthropicApiKey: "sk-ant-test" });
});

test("saveConfig then loadConfig round-trips proxy mode", async () => {
  const saved = {
    mode: "proxy" as const,
    backendUrl: "https://backend.example",
    proxyToken: "tok-123",
  };
  await saveConfig(saved);
  expect(await loadConfig()).toEqual(saved);
});

test("resolveAuthEnv maps byok config to ANTHROPIC_API_KEY only", () => {
  const env = resolveAuthEnv({ mode: "byok", anthropicApiKey: "sk-ant-test" });
  expect(env).toEqual({ ANTHROPIC_API_KEY: "sk-ant-test" });
});

test("resolveAuthEnv maps proxy config to token + base URL", () => {
  const env = resolveAuthEnv({
    mode: "proxy",
    backendUrl: "https://backend.example",
    proxyToken: "tok-123",
  });
  expect(env).toEqual({
    ANTHROPIC_API_KEY: "tok-123",
    ANTHROPIC_BASE_URL: "https://backend.example",
  });
});

test("projectOutputDir nests the slug under ~/.ai-tpm", () => {
  expect(projectOutputDir("my-project")).toBe(join(homedir(), ".ai-tpm", "my-project"));
});