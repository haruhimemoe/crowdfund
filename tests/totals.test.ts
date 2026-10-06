/**
 * @file tests/totals.test.ts
 * @desc Per-currency totals, totals in one currency, settled values and conversion.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CrowdfundError, totalsByCurrency, totalsFor } from "../src/index.js";
import { valueIn } from "../src/totals.js";
import { donation } from "./fixtures/donations.js";

const refund = (amount: number) => ({ amount, refundedAt: "2026-05-01T00:00:00Z", reason: null });
const cadToUsd = (amount: number) => Math.round(amount * 0.73);

describe("totalsByCurrency", () => {
  it("is empty for no donations", () => {
    expect(totalsByCurrency([])).toEqual([]);
  });

  it("sums each currency, sorted by code", () => {
    const totals = totalsByCurrency([
      donation(1000, { currency: "USD" }),
      donation(500, { currency: "CAD", refund: refund(500) }),
      donation(2000, { currency: "USD", refund: refund(300) }),
      donation(100, { currency: "CAD" }),
      donation(1, { currency: "AUD" }),
    ]);
    expect(totals.map((t) => t.currency)).toEqual(["AUD", "CAD", "USD"]);
    expect(totals.slice(1)).toEqual([
      { currency: "CAD", gross: 600, refunded: 500, net: 100, count: 2, refundedCount: 1 },
      { currency: "USD", gross: 3000, refunded: 300, net: 2700, count: 2, refundedCount: 1 },
    ]);
  });

  it("throws on overflow", () => {
    const big = donation(Number.MAX_SAFE_INTEGER);
    expect(() => totalsByCurrency([big, donation(1)])).toThrow(CrowdfundError);
  });
});

describe("totalsFor", () => {
  const mixed = [
    donation(1000),
    donation(1000, { currency: "CAD" }),
    donation(1000, { currency: "CAD", settled: { amount: 700, currency: "USD" } }),
    donation(1000, { currency: "EUR", settled: { amount: 1500, currency: "CAD" } }),
  ];

  it("skips other currencies without settled or convert", () => {
    expect(totalsFor(mixed, "USD")).toMatchObject({ gross: 1700, net: 1700, count: 2 });
  });

  it("uses settled before convert", () => {
    const totals = totalsFor(mixed, "USD", { convert: cadToUsd });
    expect(totals).toMatchObject({ gross: 1000 + 730 + 700 + 730, count: 4 });
  });

  it("scales partial refunds in converted values, rounding the net down", () => {
    const totals = totalsFor([donation(1000, { currency: "CAD", refund: refund(333) })], "USD", {
      convert: cadToUsd,
    });
    // gross 730; net floor(730 * 667 / 1000) = 486
    expect(totals).toEqual({
      currency: "USD",
      gross: 730,
      refunded: 244,
      net: 486,
      count: 1,
      refundedCount: 1,
    });
  });

  it.each([-1, 1.5, Number.NaN])("refuses a converter returning %s", (value) => {
    expect(() => totalsFor(mixed, "USD", { convert: () => value })).toThrow(/convert/);
  });

  it("keeps 0 <= net <= gross and gross = net + refunded for any converter", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e12 }),
        fc.integer({ min: 0, max: 1e12 }),
        fc.integer({ min: 0, max: 1e12 }),
        (amount, refunded, converted) => {
          const refundAmount = refunded % (amount + 1);
          const d = donation(amount, {
            currency: "EUR",
            refund: refundAmount === 0 ? null : refund(refundAmount),
          });
          const value = valueIn(d, "USD", () => converted);
          if (!value) return false;
          const totals = totalsFor([d], "USD", { convert: () => converted });
          return (
            value.net >= 0 &&
            value.net <= value.gross &&
            totals.gross === totals.net + totals.refunded
          );
        },
      ),
    );
  });
});
