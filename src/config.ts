import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".ai-tpm");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export type Config =
  | { mode: "byok"; anthropicApiKey: string }
  | { mode: "proxy"; backendUrl: string; proxyToken: string };

export async function loadConfig(): Promise<Config | null> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as Config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

export function projectOutputDir(projectSlug: string): string {
  return join(CONFIG_DIR, projectSlug);
}

/**
 * Resolves the current config into the env vars the Agent SDK reads for
 * auth and routing. BYOK talks to Anthropic directly; proxy mode routes
 * through ai-ic-backend using the token issued at `ai-tpm login`.
 */
export function resolveAuthEnv(config: Config): Record<string, string> {
  if (config.mode === "byok") {
    return { ANTHROPIC_API_KEY: config.anthropicApiKey };
  }
  return {
    ANTHROPIC_API_KEY: config.proxyToken,
    ANTHROPIC_BASE_URL: config.backendUrl,
  };
}