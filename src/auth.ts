import { saveConfig } from "./config.ts";

interface DeviceStartResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  intervalSeconds: number;
  expiresInSeconds: number;
}

interface DeviceTokenResponse {
  status: "pending" | "complete" | "expired" | "denied";
  token?: string;
}

/**
 * Device-code login against ai-ic-backend's /device/start + /device/token
 * endpoints (GitHub OAuth happens in the browser at verificationUrl). This
 * is the client half of that contract — it has nothing to talk to until
 * ai-ic-backend implements the matching server side.
 */
export async function login(
  backendUrl: string,
  deps: { saveConfig: typeof saveConfig } = { saveConfig },
): Promise<void> {
  const start = await postJson<DeviceStartResponse>(`${backendUrl}/device/start`, {});

  console.log(`\nOpen ${start.verificationUrl} and enter code: ${start.userCode}\n`);
  console.log("Waiting for authorization...");

  const deadline = Date.now() + start.expiresInSeconds * 1000;

  while (Date.now() < deadline) {
    await sleep(start.intervalSeconds * 1000);

    const poll = await postJson<DeviceTokenResponse>(`${backendUrl}/device/token`, {
      deviceCode: start.deviceCode,
    });

    if (poll.status === "complete" && poll.token) {
      await deps.saveConfig({ mode: "proxy", backendUrl, proxyToken: poll.token });
      console.log("Logged in.");
      return;
    }
    if (poll.status === "denied" || poll.status === "expired") {
      throw new Error(`Login ${poll.status}`);
    }
    // "pending" — keep polling
  }

  throw new Error("Login timed out waiting for authorization");
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}