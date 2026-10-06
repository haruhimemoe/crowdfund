/**
 * @file src/goals.ts
 * @desc Goal progress, unlocked stretch tiers and the next tier to reach.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { Donation, FundingGoal, GoalTier } from "./schemas.js";
import { type ConvertOptions, totalsFor } from "./totals.js";

/** How far a goal is, in its currency's minor units. */
export interface GoalProgress {
  currency: string;
  /** The goal's amount. */
  goal: number;
  /** Net raised: donations minus refunds. */
  raised: number;
  /** What's still needed, 0 once reached. */
  remaining: number;
  /** floor(raised / goal * 100). Not capped, so 150 means 1.5 times the goal. */
  percent: number;
  reached: boolean;
}

/** The next tier and what it still needs. */
export interface NextTier {
  tier: GoalTier;
  remaining: number;
}

const byThreshold = (a: GoalTier, b: GoalTier): number =>
  a.threshold - b.threshold || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * @function goalProgress
 * @param goal {FundingGoal} the goal
 * @param donations {readonly Donation[]} donations in any currencies
 * @param options {ConvertOptions} `convert` for donations in other currencies
 * @returns {GoalProgress} progress in the goal's currency
 * @throws {CrowdfundError} `refund-exceeds-amount`, `overflow` or `bad-convert`
 */
export const goalProgress = (
  goal: FundingGoal,
  donations: readonly Donation[],
  options: ConvertOptions = {},
): GoalProgress => {
  const raised = totalsFor(donations, goal.currency, options).net;
  return {
    currency: goal.currency,
    goal: goal.amount,
    raised,
    remaining: Math.max(goal.amount - raised, 0),
    percent: Number((BigInt(raised) * 100n) / BigInt(goal.amount)),
    reached: raised >= goal.amount,
  };
};

/**
 * @function unlockedTiers
 * @param tiers {readonly GoalTier[]} a goal's tiers, in any order
 * @param raised {number} net raised, in the goal's minor units
 * @returns {GoalTier[]} tiers with `threshold <= raised`, lowest first (ties by id)
 */
export const unlockedTiers = (tiers: readonly GoalTier[], raised: number): GoalTier[] =>
  tiers.filter((tier) => tier.threshold <= raised).sort(byThreshold);

/**
 * @function nextTier
 * @param tiers {readonly GoalTier[]} a goal's tiers, in any order
 * @param raised {number} net raised, in the goal's minor units
 * @returns {NextTier | null} the lowest locked tier and what it still needs, or null when every
 *          tier is unlocked
 */
export const nextTier = (tiers: readonly GoalTier[], raised: number): NextTier | null => {
  const locked = tiers.filter((tier) => tier.threshold > raised).sort(byThreshold);
  const tier = locked[0];
  return tier ? { tier, remaining: tier.threshold - raised } : null;
};
