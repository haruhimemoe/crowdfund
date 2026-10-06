/**
 * @file tests/kofi.test.ts
 * @desc Ko-fi body parsing, token checks, mapping and transaction id extraction.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { CrowdfundError, donationSchema } from "../src/index.js";
import {
  extractKofiTransactionId,
  KOFI_TYPES,
  kofiPayloadSchema,
  kofiToDonation,
  parseKofiBody,
  verifyKofiToken,
} from "../src/kofi/index.js";
import { KOFI_TOKEN, kofiBody, kofiPayload } from "./fixtures/kofi.js";

const badBody = (body: string) => {
  try {
    parseKofiBody(body);
  } catch (error) {
    return error instanceof CrowdfundError ? `${error.code}: ${error.message}` : "other";
  }
  return "parsed";
};

describe("parseKofiBody", () => {
  it("parses a webhook body and drops unknown keys", () => {
    const payload = parseKofiBody(kofiBody(kofiPayload));
    expect(payload.kofi_transaction_id).toBe(kofiPayload.kofi_transaction_id);
    expect(payload).not.toHaveProperty("shipping");
  });

  it("accepts types it doesn't know, so new Ko-fi types aren't retried forever", () => {
    expect(parseKofiBody(kofiBody({ ...kofiPayload, type: "Something New" })).type).toBe(
      "Something New",
    );
    expect(KOFI_TYPES).toContain("Shop Order");
    expect(Object.isFrozen(KOFI_TYPES)).toBe(true);
  });

  it("accepts any currency and a missing email or message", () => {
    const { email: _email, message: _message, ...rest } = kofiPayload;
    expect(kofiPayloadSchema.safeParse({ ...rest, currency: "EUR" }).success).toBe(true);
  });

  it.each([
    ["", /no `data`/],
    ["data=", /no `data`/],
    ["data=%7Bnope", /isn't JSON/],
    [kofiBody({ ...kofiPayload, verification_token: "x".repeat(257) }), /verification_token/],
    [kofiBody({ ...kofiPayload, amount: "ten" }), /amount/],
    [kofiBody({ ...kofiPayload, currency: "usd" }), /currency/],
  ])("refuses %s", (body, message) => {
    expect(badBody(body)).toMatch(/^bad-kofi-body/);
    expect(badBody(body)).toMatch(message);
  });
});

describe("verifyKofiToken", () => {
  it.each([
    [KOFI_TOKEN, KOFI_TOKEN, true],
    [`${KOFI_TOKEN}x`, KOFI_TOKEN, false],
    [KOFI_TOKEN.slice(0, -1), KOFI_TOKEN, false],
    [KOFI_TOKEN.replace("0", "1"), KOFI_TOKEN, false],
    ["", KOFI_TOKEN, false],
    ["", "", false],
    ["anything", "", false],
    ["tökén", "tökén", true],
    ["tökén", "tokén", false],
    ["\uD800", "\uDFFF", false],
  ])("%s vs %s is %s", (provided, expected, result) => {
    expect(verifyKofiToken(provided, expected)).toBe(result);
  });
});

describe("kofiToDonation", () => {
  const payload = parseKofiBody(kofiBody(kofiPayload));

  it("maps a donation", () => {
    const donation = kofiToDonation(payload, { id: "d1" });
    expect(donation).toEqual({
      id: "d1",
      amount: 2500,
      currency: "USD",
      donorName: "Cityyy",
      donorId: null,
      anonymous: false,
      message: "love this",
      source: "ko-fi",
      externalId: kofiPayload.kofi_transaction_id,
      recurring: false,
      createdAt: "2026-04-23T12:00:00Z",
      settled: null,
      refund: null,
    });
    expect(donationSchema.parse(donation)).toEqual(donation);
    expect(JSON.stringify(donation)).not.toContain("donor@example.com");
  });

  it("maps private and subscription payments", () => {
    const sub = { ...payload, is_public: false, is_subscription_payment: true, message: null };
    const donation = kofiToDonation(
      { ...sub, type: "Subscription" },
      {
        id: "d2",
        source: "kofi-main",
        accept: ["Donation", "Subscription"],
      },
    );
    expect(donation).toMatchObject({ anonymous: true, recurring: true, source: "kofi-main" });
  });

  it("fills an empty name, cuts a long one, and takes empty email and null url", () => {
    const loose = parseKofiBody(kofiBody({ ...kofiPayload, from_name: " ", email: "", url: null }));
    expect(kofiToDonation(loose, { id: "d" })?.donorName).toBe("Ko-fi Supporter");
    const long = { ...payload, from_name: "x".repeat(200) };
    expect(kofiToDonation(long, { id: "d" })?.donorName).toHaveLength(128);
  });

  it("returns null for types not accepted", () => {
    expect(kofiToDonation({ ...payload, type: "Shop Order" }, { id: "d3" })).toBeNull();
  });

  it("uses the currency's exponent and refuses 0", () => {
    expect(
      kofiToDonation({ ...payload, amount: "500", currency: "JPY" }, { id: "d" })?.amount,
    ).toBe(500);
    expect(() => kofiToDonation({ ...payload, amount: "0.00" }, { id: "d" })).toThrow(/0/);
  });
});

describe("extractKofiTransactionId", () => {
  it.each([
    ["  abc-123  ", "abc-123"],
    ["https://ko-fi.com/Home/CoffeeShop?txid=abc-123&mode=b", "abc-123"],
    ["https://ko-fi.com/x#txid=a%2Fb", "a/b"],
    ["txid=%E0%A4%A", "%E0%A4%A"],
    ["https://ko-fi.com/x?other=1", "https://ko-fi.com/x?other=1"],
  ])("%s gives %s", (ref, id) => {
    expect(extractKofiTransactionId(ref)).toBe(id);
  });
});
