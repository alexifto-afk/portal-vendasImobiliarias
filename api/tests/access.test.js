import { test } from "node:test";
import assert from "node:assert/strict";
import { requireAdvertiser } from "../src/access.js";
test("nível de parceiro não autoriza operações de proprietário", () => {
  for (const role of ["PARTNER", "UNKNOWN"]) {
    let failure;
    requireAdvertiser({ user: { role } }, {}, (e) => (failure = e));
    assert.equal(failure.status, 403);
  }
  for (const role of ["OWNER", "ADMIN"]) {
    let allowed = false;
    requireAdvertiser({ user: { role } }, {}, (e) => {
      assert.equal(e, undefined);
      allowed = true;
    });
    assert.equal(allowed, true);
  }
});
