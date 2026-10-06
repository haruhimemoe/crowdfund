/**
 * @file tests/money.test.ts
 * @desc Currency exponents, decimal parsing, net amounts and refunds.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import {
  CrowdfundError,
  currencyExponent,
  isRefunded,
  netAmount,
  refundDonation,
  toMinorUnits,
} from "../src/index.js";
import { addMinor } from "../src/money.js";
import { donation } from "./fixtures/donations.js";

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    if (error instanceof CrowdfundError) return error.code;
    throw error;
  }
  return undefined;
};

const refund = (amount: number) => ({ amount, refundedAt: "2026-05-01T00:00:00Z", reason: null });

describe("currencyExponent", () => {
  it.each([
    ["USD", 2],
    ["EUR", 2],
    ["JPY", 0],
    ["KRW", 0],
    ["KWD", 3],
    ["CLF", 4],
  ])("%s has %i", (currency, exponent) => {
    expect(currencyExponent(currency)).toBe(exponent);
  });

  it("refuses a bad code", () => {
    expect(code(() => currencyExponent("usd"))).toBe("bad-currency");
  });
});

describe("toMinorUnits", () => {
  it.each([
    ["25", "USD", 2500],
    ["25.5", "USD", 2550],
    ["25.00", "USD", 2500],
    [" 0.01 ", "USD", 1],
    ["0", "USD", 0],
    ["007", "USD", 700],
    ["500", "JPY", 500],
    ["500.00", "JPY", 500],
    ["1.234", "KWD", 1234],
    ["1.2", "KWD", 1200],
    ["90071992547409.91", "USD", Number.MAX_SAFE_INTEGER],
  ])("%s %s is %i", (amount, currency, minor) => {
    expect(toMinorUnits(amount, currency)).toBe(minor);
  });

  it.each([
    ["25.001", "USD"],
    ["500.5", "JPY"],
    ["", "USD"],
    ["1.", "USD"],
    [".5", "USD"],
    ["-1", "USD"],
    ["+1", "USD"],
    ["1,000", "USD"],
    ["1e3", "USD"],
    ["90071992547409.92", "USD"],
    ["1".repeat(80), "USD"],
  ])("%s %s is refused", (amount, currency) => {
    expect(code(() => toMinorUnits(amount, currency))).toBe("bad-amount");
  });

  it("refuses a bad currency", () => {
    expect(code(() => toMinorUnits("1", "usd"))).toBe("bad-currency");
  });
});

describe("addMinor", () => {
  it("throws past the safe range", () => {
    expect(addMinor(1, 2)).toBe(3);
    expect(code(() => addMinor(Number.MAX_SAFE_INTEGER, 1))).toBe("overflow");
  });
});

describe("refunds", () => {
  it("net is the amount minus the refund", () => {
    expect(netAmount(donation(500))).toBe(500);
    expect(netAmount(donation(500, { refund: refund(200) }))).toBe(300);
    expect(netAmount(donation(500, { refund: refund(500) }))).toBe(0);
  });

  it("a refund over the amount throws", () => {
    expect(code(() => netAmount(donation(500, { refund: refund(501) })))).toBe(
      "refund-exceeds-amount",
    );
  });

  it.each([
    [0, null],
    [1.5, null],
    [500, -1],
    [500, 1.5],
  ])("refuses amount %s with refund %s", (amount, refunded) => {
    const d = donation(amount, { refund: refunded === null ? null : refund(refunded) });
    expect(code(() => netAmount(d))).toBe("bad-amount");
  });

  it("refundDonation copies, and refuses a second refund unless replacing", () => {
    const original = donation(500);
    const refunded = refundDonation(original, refund(100));
    expect(original.refund).toBeNull();
    expect(isRefunded(original)).toBe(false);
    expect(isRefunded(refunded)).toBe(true);
    expect(netAmount(refunded)).toBe(400);
    expect(code(() => refundDonation(refunded, refund(100)))).toBe("already-refunded");
    expect(netAmount(refundDonation(refunded, refund(500), { replace: true }))).toBe(0);
    expect(code(() => refundDonation(original, refund(600)))).toBe("refund-exceeds-amount");
  });
});
