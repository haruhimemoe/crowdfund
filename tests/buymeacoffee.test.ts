/**
 * @file tests/buymeacoffee.test.ts
 * @desc Buy Me a Coffee signature checks, donation and refund mapping.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import {
  buyMeACoffeeRefund,
  buyMeACoffeeToDonation,
  parseBuyMeACoffeeEvent,
  verifyBuyMeACoffeeSignature,
} from "../src/buymeacoffee/index.js";
import { donationSchema } from "../src/index.js";
import { bmcDonation, SECRET, sign } from "./fixtures/providers.js";

const body = JSON.stringify(bmcDonation);
const event = parseBuyMeACoffeeEvent(body);

describe("verifyBuyMeACoffeeSignature", () => {
  it.each([
    [sign(SECRET, body), SECRET, true],
    [sign(SECRET, body).toUpperCase(), SECRET, true],
    [sign("other", body), SECRET, false],
    [null, SECRET, false],
    [sign("", body), "", false],
  ])("%s is %s", async (header, secret, result) => {
    expect(await verifyBuyMeACoffeeSignature(body, header, secret)).toBe(result);
  });
});

describe("buyMeACoffeeToDonation", () => {
  it("maps a donation with a numeric amount", () => {
    const donation = buyMeACoffeeToDonation(event, { id: "d1" });
    expect(donation).toMatchObject({
      amount: 1500,
      currency: "USD",
      donorName: "Kiri",
      message: "keep it up",
      source: "buymeacoffee",
      externalId: "pi_bmc_1",
      createdAt: "2026-04-23T11:59:50.000Z",
    });
    expect(donationSchema.parse(donation)).toEqual(donation);
    expect(JSON.stringify(donation)).not.toContain("donor@example.com");
  });

  it("reads string amounts, hides hidden notes, falls back on ids and names", () => {
    const data = {
      ...event.data,
      amount: "4.50",
      note_hidden: true,
      transaction_id: null,
      supporter_name: " ",
      created_at: undefined,
    };
    expect(buyMeACoffeeToDonation({ ...event, data }, { id: "d", anonymous: true })).toMatchObject({
      amount: 450,
      message: null,
      externalId: "99",
      donorName: "Supporter",
      anonymous: true,
      createdAt: "2026-04-23T12:00:00.000Z",
    });
  });

  it("skips test events unless allowed, and other types", () => {
    const test = { ...event, live_mode: false };
    expect(buyMeACoffeeToDonation(test, { id: "d" })).toBeNull();
    expect(buyMeACoffeeToDonation(test, { id: "d", allowTest: true })).not.toBeNull();
    expect(
      buyMeACoffeeToDonation({ ...event, type: "membership.started" }, { id: "d" }),
    ).toBeNull();
  });

  it("refuses a zero or float-unsafe amount", () => {
    expect(() =>
      buyMeACoffeeToDonation({ ...event, data: { ...event.data, amount: 0 } }, { id: "d" }),
    ).toThrow(/0/);
    expect(() =>
      buyMeACoffeeToDonation({ ...event, data: { ...event.data, amount: 1e-7 } }, { id: "d" }),
    ).toThrow();
  });
});

describe("buyMeACoffeeRefund", () => {
  it("records a full refund", () => {
    const refunded = {
      ...event,
      type: "donation.refunded",
      data: { ...event.data, refunded_at: 1_777_000_000 },
    };
    expect(buyMeACoffeeRefund(refunded, { reason: "chargeback" })).toEqual({
      externalId: "pi_bmc_1",
      refund: { amount: 1500, refundedAt: "2026-04-24T03:06:40.000Z", reason: "chargeback" },
    });
    expect(
      buyMeACoffeeRefund({ ...refunded, data: { ...refunded.data, refunded_at: null } })?.refund
        .refundedAt,
    ).toBe("2026-04-23T12:00:00.000Z");
    expect(buyMeACoffeeRefund({ ...refunded, data: { ...refunded.data, amount: 0 } })).toBeNull();
    expect(buyMeACoffeeRefund(event)).toBeNull();
  });
});
