/**
 * @file tests/goals.test.ts
 * @desc Goal progress, unlocked tiers and the next tier.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { goalProgress, nextTier, unlockedTiers } from "../src/index.js";
import { donation, goal, tier } from "./fixtures/donations.js";

const refund = (amount: number) => ({ amount, refundedAt: "2026-05-01T00:00:00Z", reason: null });

describe("goalProgress", () => {
  it("starts at 0", () => {
    expect(goalProgress(goal, [])).toEqual({
      currency: "USD",
      goal: 100_000,
      raised: 0,
      remaining: 100_000,
      percent: 0,
      reached: false,
    });
  });

  it("counts net and floors the percent", () => {
    const progress = goalProgress(goal, [
      donation(33_399),
      donation(1000, { refund: refund(400) }),
    ]);
    expect(progress).toMatchObject({ raised: 33_999, remaining: 66_001, percent: 33 });
  });

  it("goes past 100 with remaining 0", () => {
    const progress = goalProgress(goal, [donation(150_000)]);
    expect(progress).toMatchObject({ remaining: 0, percent: 150, reached: true });
  });

  it("reaches at exactly the goal", () => {
    expect(goalProgress(goal, [donation(100_000)]).reached).toBe(true);
    expect(goalProgress(goal, [donation(99_999)])).toMatchObject({ reached: false, percent: 99 });
  });

  it("handles amounts where raised * 100 leaves the safe range", () => {
    const huge = { ...goal, amount: Number.MAX_SAFE_INTEGER };
    expect(goalProgress(huge, [donation(Number.MAX_SAFE_INTEGER)]).percent).toBe(100);
  });

  it("converts other currencies when asked", () => {
    const cad = [donation(1000, { currency: "CAD" })];
    expect(goalProgress(goal, cad).raised).toBe(0);
    expect(goalProgress(goal, cad, { convert: (a) => Math.round(a * 0.73) }).raised).toBe(730);
  });
});

describe("tiers", () => {
  const tiers = [tier("c", 300), tier("a", 100), tier("b2", 200), tier("b1", 200)];

  it("unlocks tiers at or under raised, lowest first, ties by id", () => {
    expect(unlockedTiers(tiers, 0)).toEqual([]);
    expect(unlockedTiers(tiers, 200).map((t) => t.id)).toEqual(["a", "b1", "b2"]);
  });

  it("finds the next locked tier and what it needs", () => {
    expect(nextTier(tiers, 0)).toEqual({ tier: tier("a", 100), remaining: 100 });
    expect(nextTier(tiers, 100)).toEqual({ tier: tier("b1", 200), remaining: 100 });
    expect(nextTier(tiers, 299)?.remaining).toBe(1);
    expect(nextTier(tiers, 300)).toBeNull();
    expect(nextTier([], 0)).toBeNull();
  });

  it("keeps tiers that share a threshold and an id", () => {
    const same = [tier("x", 5), tier("w", 5), tier("x", 5)];
    expect(unlockedTiers(same, 5).map((t) => t.id)).toEqual(["w", "x", "x"]);
  });

  it("doesn't reorder the input", () => {
    unlockedTiers(tiers, 1000);
    expect(tiers.map((t) => t.id)).toEqual(["c", "a", "b2", "b1"]);
  });
});
