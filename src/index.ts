/**
 * @file src/index.ts
 * @desc @haruhimemoe/crowdfund: schemas, money math, totals, goals and tiers, donors and dedupe.
 *       Ko-fi helpers live in ./kofi.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

export { dedupeDonations, donationKey, hasDonation } from "./dedupe.js";
export {
  type DonorRank,
  type PublicDonation,
  publicDonation,
  type TopDonorsOptions,
  topDonors,
} from "./donors.js";
export { CrowdfundError, type CrowdfundErrorCode } from "./errors.js";
export {
  type GoalProgress,
  goalProgress,
  type NextTier,
  nextTier,
  unlockedTiers,
} from "./goals.js";
export {
  currencyExponent,
  isRefunded,
  netAmount,
  refundDonation,
  toMinorUnits,
} from "./money.js";
export {
  currencyCodeSchema,
  type Donation,
  donationSchema,
  type FundingGoal,
  fundingGoalSchema,
  type GoalTier,
  goalTierSchema,
  minorUnitsSchema,
  positiveMinorUnitsSchema,
  type Refund,
  refundSchema,
  type Settled,
  settledSchema,
} from "./schemas.js";
export {
  type Convert,
  type ConvertOptions,
  type CurrencyTotals,
  totalsByCurrency,
  totalsFor,
} from "./totals.js";
