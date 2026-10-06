/**
 * @file src/schemas.ts
 * @desc zod schemas for goals, tiers, donations and refunds. Plain objects with no refinements, so\n *       hosts can .extend() them with their own fields.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";

/** A 3-letter uppercase currency code, like `USD` or `JPY`. Not checked against a fixed list. */
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, "expected a 3-letter code");

/** An amount in a currency's minor unit (cents for USD, yen for JPY): a safe integer, 0 or more. */
export const minorUnitsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** Minor units, 1 or more. */
export const positiveMinorUnitsSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

const idSchema = z.string().min(1).max(128);
const isoDateSchema = z.iso.datetime({ offset: true });

/** What a crowdfund is raising toward. */
export const fundingGoalSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(128),
  description: z.string().max(2000).nullable(),
  amount: positiveMinorUnitsSchema,
  currency: currencyCodeSchema,
});
export type FundingGoal = z.infer<typeof fundingGoalSchema>;

/** A stretch tier. `threshold` is in its goal's currency. */
export const goalTierSchema = z.object({
  id: idSchema,
  threshold: positiveMinorUnitsSchema,
  label: z.string().min(1).max(128),
  reward: z.string().max(2000),
});
export type GoalTier = z.infer<typeof goalTierSchema>;

/** Money returned to a donor, in the donation's currency. Full or partial. */
export const refundSchema = z.object({
  amount: positiveMinorUnitsSchema,
  refundedAt: isoDateSchema,
  reason: z.string().max(500).nullable(),
});
export type Refund = z.infer<typeof refundSchema>;

/** The donation's value in another currency, fixed when it was taken (for example at the
 *  provider's payout rate). Totals in that currency use it instead of converting. */
export const settledSchema = z.object({
  amount: minorUnitsSchema,
  currency: currencyCodeSchema,
});
export type Settled = z.infer<typeof settledSchema>;

/** One donation as the payment provider or an admin reported it. */
export const donationSchema = z.object({
  id: idSchema,
  amount: positiveMinorUnitsSchema,
  currency: currencyCodeSchema,
  donorName: z.string().min(1).max(128),
  donorId: idSchema.nullable(),
  anonymous: z.boolean(),
  message: z.string().max(2000).nullable(),
  source: z.string().min(1).max(64),
  externalId: z.string().min(1).max(128).nullable(),
  recurring: z.boolean(),
  createdAt: isoDateSchema,
  settled: settledSchema.nullable(),
  refund: refundSchema.nullable(),
});
export type Donation = z.infer<typeof donationSchema>;
