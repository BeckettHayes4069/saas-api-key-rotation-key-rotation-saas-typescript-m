import { strict as assert } from "node:assert";
import { rotateTenantKey } from "./key_rotation_service.js";

await assert.rejects(rotateTenantKey({ name: "tenant", idempotency_key: "short", oldKeyId: "old", tenantId: "t1", graceHours: 2 }), /at least 8/);
console.log("rotation boundary test passed");
