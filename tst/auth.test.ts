import { test, expect, mock, beforeEach, afterEach } from "bun:test";
import { login } from "../src/auth.ts";

const savedConfigs: unknown[] = [];

function makeDeps() {
  return {
    saveConfig: mock(async (config: unknown) => {
      savedConfigs.push(config);
    }) as unknown as Parameters<typeof login>[1] extends { saveConfig: infer F } ? F : never,
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  savedConfigs.length = 0;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(handler: (url: string) => Response): void {
  globalThis.fetch = mock(async (input: string | URL) => handler(String(input))) as unknown as typeof fetch;
}

test("login: completes after a pending poll and saves proxy config", async () => {
  let pollCount = 0;
  mockFetch((url) => {
    if (url.endsWith("/device/start")) {
      return jsonResponse({
        deviceCode: "dev-1",
        userCode: "ABCD-1234",
        verificationUrl: "https://backend.example/verify",
        intervalSeconds: 0.01,
        expiresInSeconds: 5,
      });
    }
    pollCount += 1;
    if (pollCount === 1) return jsonResponse({ status: "pending" });
    return jsonResponse({ status: "complete", token: "tok-abc" });
  });

  await login("https://backend.example", makeDeps());

  expect(savedConfigs).toEqual([
    { mode: "proxy", backendUrl: "https://backend.example", proxyToken: "tok-abc" },
  ]);
});

test("login: throws when authorization is denied", async () => {
  mockFetch((url) => {
    if (url.endsWith("/device/start")) {
      return jsonResponse({
        deviceCode: "dev-1",
        userCode: "ABCD-1234",
        verificationUrl: "https://backend.example/verify",
        intervalSeconds: 0.01,
        expiresInSeconds: 5,
      });
    }
    return jsonResponse({ status: "denied" });
  });

  await expect(login("https://backend.example", makeDeps())).rejects.toThrow("Login denied");
  expect(savedConfigs).toEqual([]);
});

test("login: throws when the device code expires", async () => {
  mockFetch((url) => {
    if (url.endsWith("/device/start")) {
      return jsonResponse({
        deviceCode: "dev-1",
        userCode: "ABCD-1234",
        verificationUrl: "https://backend.example/verify",
        intervalSeconds: 0.01,
        expiresInSeconds: 5,
      });
    }
    return jsonResponse({ status: "expired" });
  });

  await expect(login("https://backend.example", makeDeps())).rejects.toThrow("Login expired");
});

test("login: throws after expiresInSeconds elapses without completion", async () => {
  mockFetch((url) => {
    if (url.endsWith("/device/start")) {
      return jsonResponse({
        deviceCode: "dev-1",
        userCode: "ABCD-1234",
        verificationUrl: "https://backend.example/verify",
        intervalSeconds: 0.02,
        expiresInSeconds: 0.05,
      });
    }
    return jsonResponse({ status: "pending" });
  });

  await expect(login("https://backend.example", makeDeps())).rejects.toThrow("Login timed out");
});

test("login: throws when /device/start responds with an error", async () => {
  mockFetch(() => jsonResponse({ error: "bad request" }, 400));

  await expect(login("https://backend.example", makeDeps())).rejects.toThrow(/400/);
  expect(savedConfigs).toEqual([]);
});