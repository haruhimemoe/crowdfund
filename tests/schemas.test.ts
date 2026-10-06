/**
 * @file tests/schemas.test.ts
 * @desc The schemas accept good records, refuse bad money and dates, and stay extendable.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  currencyCodeSchema,
  donationSchema,
  fundingGoalSchema,
  goalTierSchema,
  minorUnitsSchema,
  positiveMinorUnitsSchema,
  refundSchema,
  settledSchema,
} from "../src/index.js";
import { donation, goal, tier } from "./fixtures/donations.js";

describe("money", () => {
  it.each([0, 1, Number.MAX_SAFE_INTEGER])("minor units accept %s", (value) => {
    expect(minorUnitsSchema.safeParse(value).success).toBe(true);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, "1"])("refuse %s", (value) => {
    expect(minorUnitsSchema.safeParse(value).success).toBe(false);
  });

  it("positive minor units refuse 0", () => {
    expect(positiveMinorUnitsSchema.safeParse(0).success).toBe(false);
  });

  it.each(["USD", "JPY", "XYZ"])("currency %s parses", (code) => {
    expect(currencyCodeSchema.safeParse(code).success).toBe(true);
  });

  it.each(["usd", "US", "USDT", ""])("currency %s is refused", (code) => {
    expect(currencyCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe("records", () => {
  it("parse", () => {
    const refund = { amount: 100, refundedAt: "2026-05-01T00:00:00+09:00", reason: null };
    expect(refundSchema.parse(refund)).toEqual(refund);
    const record = donation(500, { refund, settled: { amount: 700, currency: "CAD" } });
    expect(donationSchema.parse(record)).toEqual(record);
    expect(fundingGoalSchema.parse(goal)).toEqual(goal);
    expect(goalTierSchema.parse(tier("t1", 10))).toEqual(tier("t1", 10));
  });

  it("refuse float amounts, bad dates and empty ids", () => {
    expect(donationSchema.safeParse(donation(1.5)).success).toBe(false);
    expect(donationSchema.safeParse(donation(0)).success).toBe(false);
    expect(donationSchema.safeParse(donation(1, { createdAt: "yesterday" })).success).toBe(false);
    expect(donationSchema.safeParse(donation(1, { id: "" })).success).toBe(false);
    expect(fundingGoalSchema.safeParse({ ...goal, currency: "usd" }).success).toBe(false);
  });

  it.each([
    ["donation", donationSchema, donation(1)],
    ["goal", fundingGoalSchema, goal],
    ["tier", goalTierSchema, tier("t", 1)],
    ["refund", refundSchema, { amount: 1, refundedAt: "2026-05-01T00:00:00Z", reason: "x" }],
    ["settled", settledSchema, { amount: 1, currency: "EUR" }],
  ] as const)("%s extends", (_name, schema, value) => {
    const extended = (schema as z.ZodObject).extend({ editionId: z.string() });
    expect(extended.parse({ ...value, editionId: "e1" })).toMatchObject({ editionId: "e1" });
  });
});
