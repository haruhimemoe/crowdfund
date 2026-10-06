/**
 * @file scripts/smoke.mjs
 * @desc Imports the built package through its own exports map, the way Node consumers will\n *       (every subpath), and checks one result per subpath. Run by `bun run test:dist`.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const { goalProgress, toMinorUnits, CrowdfundError, totalsByCurrency } = await import(
  "@haruhimemoe/crowdfund"
);
const { parseKofiBody, verifyKofiToken, kofiToDonation } = await import(
  "@haruhimemoe/crowdfund/kofi"
);

assert.equal(toMinorUnits("25.00", "USD"), 2500);
assert.throws(() => toMinorUnits("1.5", "JPY"), CrowdfundError);
const payload = parseKofiBody(
  new URLSearchParams({
    data: JSON.stringify({
      verification_token: "t",
      message_id: "m",
      timestamp: "2026-04-23T12:00:00Z",
      type: "Donation",
      is_public: true,
      from_name: "a",
      amount: "5.00",
      url: "https://ko-fi.com/",
      currency: "USD",
      kofi_transaction_id: "x",
      is_subscription_payment: false,
      is_first_subscription_payment: false,
    }),
  }).toString(),
);
assert.equal(verifyKofiToken(payload.verification_token, "t"), true);
const donation = kofiToDonation(payload, { id: "d1" });
assert.equal(totalsByCurrency([donation])[0].net, 500);
const goal = { id: "g", label: "g", description: null, amount: 1000, currency: "USD" };
assert.equal(goalProgress(goal, [donation]).percent, 50);
for (const sub of ["index", "kofi/index"]) {
  assert.ok(
    existsSync(new URL(`../dist/${sub}.d.ts`, import.meta.url)),
    `dist/${sub}.d.ts missing`,
  );
}
console.log("smoke: ok");
