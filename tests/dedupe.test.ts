/**
 * @file tests/dedupe.test.ts
 * @desc Dedupe by (source, externalId).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { dedupeDonations, donationKey, hasDonation } from "../src/index.js";
import { donation } from "./fixtures/donations.js";

describe("dedupe", () => {
  const first = donation(100, { source: "ko-fi", externalId: "tx1" });
  const redelivered = donation(100, { source: "ko-fi", externalId: "tx1" });
  const otherSource = donation(100, { source: "stripe", externalId: "tx1" });
  const manualA = donation(100);
  const manualB = donation(100);

  it("keys by source and externalId, null without an externalId", () => {
    expect(donationKey(first)).toBe(donationKey(redelivered));
    expect(donationKey(first)).not.toBe(donationKey(otherSource));
    expect(donationKey(manualA)).toBeNull();
  });

  it("can't be fooled by separators inside the values", () => {
    expect(donationKey({ source: "a:b", externalId: "c" })).not.toBe(
      donationKey({ source: "a", externalId: "b:c" }),
    );
  });

  it("keeps the first of each key and every manual entry, in order", () => {
    expect(dedupeDonations([first, manualA, redelivered, otherSource, manualB])).toEqual([
      first,
      manualA,
      otherSource,
      manualB,
    ]);
  });

  it("checks a candidate against stored donations", () => {
    expect(hasDonation([first], redelivered)).toBe(true);
    expect(hasDonation([first], otherSource)).toBe(false);
    expect(hasDonation([manualA], manualA)).toBe(false);
  });
});
