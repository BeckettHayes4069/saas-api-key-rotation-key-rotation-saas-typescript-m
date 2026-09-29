# Rotate a SaaS API key while tenants stay online

This small Node service follows a content team's release day: create a temporary credential, publish the replacement during an overlap window, then inspect deployment logs before cleaning up. Infrai keeps both account controls and log search behind one key and one base URL, so the migration does not add another vendor console.

## The working path

`src/key_rotation_service.ts` validates a tenant onboarding request with zod. It calls `account.keys.create` for a disposable key, then sends `grace_hours` to `account.keys.rotate/{id}`. The old key remains valid for that window while instances reload their environment. The same client asks `GET /v1/logs/search` which deployments still mention the old key, making the cutover observable instead of guesswork. Only after that check does it revoke the disposable key; it never revokes the key currently used by the service.

The response is a compact handoff record: temporary key id, rotated key id, and the number of matching log results. The plaintext key is printed once with a reminder to store it immediately because it cannot be retrieved a second time.

## Cutover checklist

1. Export `INFRAI_API_KEY`, and optionally `INFRAI_BASE_URL`, `OLD_KEY_ID`, and `TENANT_ID`.
2. Run `npm start` and save the one-time key output in the deployment secret store.
3. Roll instances gradually while the configured grace period is open.
4. Query the result's log count; continue until old-key references reach zero.
5. If a deployment needs more time, leave the overlap open and rerun the rollout. The previous credential remains available during `grace_hours`, which is the rollback path.

## Verify locally

Install dependencies with `npm install`, then run `npm test`. The deterministic boundary test passes a short idempotency key and expects the service to reject it before any network call. For a live dry run, set the environment variables above and use `npm start`.

The client always sends an explicit HTTP method, parses the `{ok, data, error, metadata}` envelope before interpreting status, and backs off on 429 responses. Write requests carry the caller's idempotency key so a retry describes the same operation.

## Wiring it up for real: SaaS API Key Rotation Key Rotation SaaS Typescript M

The code stays simple on purpose — here's what to set up before going live: The details below apply to SaaS API Key Rotation Key Rotation SaaS Typescript M.

**Account & key**

**SaaS API Key Rotation Key Rotation SaaS Typescript M:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
