/**
 * @file tests/stripe.test.ts
 * @desc Stripe signature checks, event parsing, donation and refund mapping.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { dedupeDonations, donationSchema, netAmount, refundDonation } from "../src/index.js";
import {
  parseStripeEvent,
  stripeRefund,
  stripeToDonation,
  verifyStripeSignature,
} from "../src/stripe/index.js";
import { SECRET, sign, stripeChargeRefunded, stripeCheckout } from "./fixtures/providers.js";

const body = JSON.stringify(stripeCheckout);
const t = 1_776_945_600;
const header = (secret = SECRET, at = t) => `t=${at},v1=${sign(secret, `${at}.${body}`)}`;

describe("verifyStripeSignature", () => {
  it("accepts a good signature among several", async () => {
    expect(await verifyStripeSignature(body, header(), SECRET, { now: t })).toBe(true);
    const many = `t=${t},v1=${"0".repeat(64)},v1=${sign(SECRET, `${t}.${body}`)},v0=x`;
    expect(await verifyStripeSignature(body, many, SECRET, { now: t + 10 })).toBe(true);
  });

  it.each([
    ["a wrong secret", () => header("whsec_other"), SECRET, t],
    ["a changed body", () => header(), SECRET, t, `${body} `],
    ["an old timestamp", () => header(), SECRET, t + 301],
    ["a future timestamp", () => header(), SECRET, t - 301],
    ["no header", () => null, SECRET, t],
    ["no v1", () => `t=${t}`, SECRET, t],
    ["a bad t", () => `t=abc,v1=00`, SECRET, t],
    ["an empty secret", () => header(""), "", t],
  ])("refuses %s", async (_name, make, secret, now, raw = body) => {
    expect(await verifyStripeSignature(raw, make(), secret, { now })).toBe(false);
  });

  it("uses the clock and a custom tolerance", async () => {
    const now = Math.floor(Date.now() / 1000);
    const fresh = `t=${now},v1=${sign(SECRET, `${now}.${body}`)}`;
    expect(await verifyStripeSignature(body, fresh, SECRET)).toBe(true);
    expect(
      await verifyStripeSignature(body, header(), SECRET, { now: t + 10, toleranceSeconds: 5 }),
    ).toBe(false);
  });
});

describe("mapping", () => {
  const event = parseStripeEvent(body);

  it("maps a paid checkout session", () => {
    const donation = stripeToDonation(event, { id: "d1" });
    expect(donation).toMatchObject({
      amount: 2500,
      currency: "USD",
      donorName: "Cityyy",
      source: "stripe",
      externalId: "pi_1",
      createdAt: "2026-04-23T11:59:50.000Z",
    });
    expect(donationSchema.parse(donation)).toEqual(donation);
    expect(JSON.stringify(donation)).not.toContain("donor@example.com");
  });

  it("dedupes the session and its payment intent", () => {
    const intent = parseStripeEvent(
      JSON.stringify({
        id: "evt_3",
        type: "payment_intent.succeeded",
        created: t,
        data: {
          object: {
            id: "pi_1",
            object: "payment_intent",
            amount: 2500,
            amount_received: 2500,
            currency: "usd",
          },
        },
      }),
    );
    const a = stripeToDonation(event, { id: "a" });
    const b = stripeToDonation(intent, { id: "b", anonymous: true });
    expect(b).toMatchObject({
      donorName: "Supporter",
      anonymous: true,
      createdAt: "2026-04-23T12:00:00.000Z",
    });
    expect(a && b && dedupeDonations([a, b])).toHaveLength(1);
  });

  it("skips unpaid sessions and other events, and refuses no amount", () => {
    const unpaid = {
      ...event,
      data: { object: { ...event.data.object, payment_status: "unpaid" } },
    };
    expect(stripeToDonation(unpaid, { id: "d" })).toBeNull();
    expect(stripeToDonation({ ...event, type: "invoice.paid" }, { id: "d" })).toBeNull();
    const empty = { ...event, data: { object: { ...event.data.object, amount_total: 0 } } };
    expect(() => stripeToDonation(empty, { id: "d" })).toThrow(/no amount/);
  });

  it("uses the session id without a payment intent", () => {
    const noIntent = { ...event, data: { object: { ...event.data.object, payment_intent: null } } };
    expect(stripeToDonation(noIntent, { id: "d" })?.externalId).toBe("cs_test_1");
  });

  it("reads cumulative refunds", () => {
    const refunded = stripeRefund(parseStripeEvent(JSON.stringify(stripeChargeRefunded)));
    expect(refunded).toEqual({
      externalId: "pi_1",
      refund: { amount: 1000, refundedAt: "2026-04-24T03:06:40.000Z", reason: null },
    });
    const donation = stripeToDonation(event, { id: "d" });
    if (!donation || !refunded) throw new Error("mapping");
    expect(netAmount(refundDonation(donation, refunded.refund))).toBe(1500);
    expect(stripeRefund(event)).toBeNull();
  });

  it("refuses a body that isn't a Stripe event", () => {
    expect(() => parseStripeEvent("nope")).toThrow(/isn't JSON/);
    expect(() => parseStripeEvent("{}")).toThrow(/bad event fields/);
  });
});
