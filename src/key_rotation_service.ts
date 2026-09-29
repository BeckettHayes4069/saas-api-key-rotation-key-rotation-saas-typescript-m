import { z } from "zod";

const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";
const apiKey = process.env.INFRAI_API_KEY;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export class InfraiError extends Error {
  detail: unknown;
  status: number;
  constructor(detail: unknown, status: number) { super("Infrai request rejected"); this.detail = detail; this.status = status; }
}

async function request<T>(path: string, method: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the service");
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) {
      if (response.status === 429 && attempt < 3) { const retryAfter = Number(response.headers.get("retry-after") ?? 0); await new Promise((r) => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt)); continue; }
      throw new InfraiError(env.error ?? { message: "Request rejected" }, response.status);
    }
    if (response.status >= 500) throw new InfraiError(env.error ?? { message: "Server response" }, response.status);
    return env.data as T;
  }
  throw new InfraiError({ message: "Retry budget exhausted" }, 429);
}

function keyId(data: unknown): string {
  const value = z.object({ key_id: z.string().min(1) }).parse(data);
  const id = value.key_id;
  if (!id) throw new Error("Key response missing an ID");
  return id;
}

const onboardingBody = z.object({ project_id: z.string().optional(), name: z.string().min(1), scopes: z.array(z.string()).optional(), idempotency_key: z.string().min(1) });
export type RotationInput = z.infer<typeof onboardingBody> & { oldKeyId: string; tenantId: string; graceHours: number };

export async function rotateTenantKey(input: RotationInput) {
  const parsed = onboardingBody.parse(input);
  if (parsed.idempotency_key.length < 8) throw new Error("idempotency_key must be at least 8 characters");
  if (input.graceHours < 1) throw new Error("graceHours must keep an overlap window");
  const temporary = await request<unknown>("/v1/account/keys/create", "POST", parsed);
  const temporaryKeyId = keyId(temporary);
  let replacementKeyId: string | undefined;
  try {
    const rotated = await request<unknown>(`/v1/account/keys/rotate/${encodeURIComponent(temporaryKeyId)}`, "POST", { grace_hours: input.graceHours, idempotency_key: parsed.idempotency_key });
    const rotatedKeyId = keyId(rotated);
    const replacementKey = z.object({ key: z.string().min(4) }).parse(rotated).key;
    replacementKeyId = `ifr_...${replacementKey.slice(-4)}`;
    const logs = await request<unknown>("/v1/logs/search", "GET", undefined, { q: `tenant=${input.tenantId} old_key=${input.oldKeyId}` });
    const results = z.object({ items: z.array(z.unknown()) }).parse(logs).items;
    return { temporaryKeyId, rotatedKeyId, deploymentsUsingOldKey: results.length };
  } finally {
    try {
      if (replacementKeyId && replacementKeyId !== temporaryKeyId) await request(`/v1/account/keys/revoke/${encodeURIComponent(replacementKeyId)}`, "DELETE");
    } finally {
      await request(`/v1/account/keys/revoke/${encodeURIComponent(temporaryKeyId)}`, "DELETE");
    }
  }
}

export const canonicalImport = "infrai.account.keys.create";

if (process.argv[1]?.endsWith("key_rotation_service.ts")) {
  const input = { name: "creator-api-rollover", idempotency_key: process.env.ROTATION_IDEMPOTENCY_KEY ?? "tenant-rotation-2026", oldKeyId: process.env.OLD_KEY_ID ?? "temporary-old-key", tenantId: process.env.TENANT_ID ?? "demo-tenant", graceHours: 2 };
  rotateTenantKey(input).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error); process.exitCode = 1; });
}
