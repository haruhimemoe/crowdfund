/**
 * @file tests/fixtures/donations.ts
 * @desc Donation and goal builders for the tests.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { Donation, FundingGoal, GoalTier } from "../../src/index.js";

let next = 0;

/** A USD donation of `amount` cents with every other field filled. */
export const donation = (amount: number, overrides: Partial<Donation> = {}): Donation => {
  next += 1;
  return {
    id: `d${next}`,
    amount,
    currency: "USD",
    donorName: `Donor ${next}`,
    donorId: null,
    anonymous: false,
    message: null,
    source: "manual",
    externalId: null,
    recurring: false,
    createdAt: `2026-04-${String((next % 28) + 1).padStart(2, "0")}T12:00:00Z`,
    settled: null,
    refund: null,
    ...overrides,
  };
};

export const goal: FundingGoal = {
  id: "g1",
  label: "Prize pool",
  description: null,
  amount: 100_000,
  currency: "USD",
};

export const tier = (id: string, threshold: number): GoalTier => ({
  id,
  threshold,
  label: id,
  reward: `${id} reward`,
});
