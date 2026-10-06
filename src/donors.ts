/**
 * @file src/donors.ts
 * @desc Top donors by net amount. Anonymous donations never group and never show who gave.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { addMinor, netAmount } from "./money.js";
import type { Donation } from "./schemas.js";
import { type ConvertOptions, valueIn } from "./totals.js";

/** Options for `topDonors`. */
export interface TopDonorsOptions extends ConvertOptions {
  /** The currency to rank in. */
  currency: string;
  /** At most this many. Default: all. */
  limit?: number;
  /** Name shown for anonymous donations. Default "Anonymous". */
  anonymousName?: string;
}

/** One row of a donor leaderboard. */
export interface DonorRank {
  /** The latest name the donor gave, or `anonymousName`. */
  donorName: string;
  /** The host's id for the donor, null when unknown or anonymous. */
  donorId: string | null;
  anonymous: boolean;
  /** Net total, in `currency` minor units. */
  amount: number;
  currency: string;
  /** How many donations it adds up. */
  count: number;
}

interface Group {
  rank: DonorRank;
  first: string;
  latest: string;
}

/**
 * @function topDonors
 * @param donations {readonly Donation[]} donations in any currencies
 * @param options {TopDonorsOptions} the currency, plus `limit`, `convert` and `anonymousName`
 * @returns {DonorRank[]} donors by net amount, highest first; ties go to the earliest donation,
 *          then the name. Donors whose net is 0 are left out. Named donations group by `donorId`,
 *          else by trimmed lowercased name. Each anonymous donation is its own row with no id.
 * @throws {CrowdfundError} `refund-exceeds-amount`, `overflow` or `bad-convert`
 */
export const topDonors = (
  donations: readonly Donation[],
  options: TopDonorsOptions,
): DonorRank[] => {
  const { currency, convert, limit, anonymousName = "Anonymous" } = options;
  const groups = new Map<string, Group>();
  donations.forEach((donation, index) => {
    const amount = valueIn(donation, currency, convert)?.net ?? 0;
    if (amount === 0) return;
    const key = donation.anonymous
      ? `anonymous:${index}`
      : donation.donorId !== null
        ? `id:${donation.donorId}`
        : `name:${donation.donorName.trim().toLowerCase()}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        first: donation.createdAt,
        latest: donation.createdAt,
        rank: {
          donorName: donation.anonymous ? anonymousName : donation.donorName,
          donorId: donation.anonymous ? null : donation.donorId,
          anonymous: donation.anonymous,
          amount,
          currency,
          count: 1,
        },
      });
      return;
    }
    group.rank.amount = addMinor(group.rank.amount, amount);
    group.rank.count += 1;
    if (Date.parse(donation.createdAt) < Date.parse(group.first)) group.first = donation.createdAt;
    if (Date.parse(donation.createdAt) >= Date.parse(group.latest)) {
      group.latest = donation.createdAt;
      group.rank.donorName = donation.donorName;
    }
  });
  const ranked = [...groups.values()]
    .sort(
      (a, b) =>
        b.rank.amount - a.rank.amount ||
        Date.parse(a.first) - Date.parse(b.first) ||
        (a.rank.donorName < b.rank.donorName ? -1 : a.rank.donorName > b.rank.donorName ? 1 : 0),
    )
    .map((group) => group.rank);
  return limit === undefined ? ranked : ranked.slice(0, Math.max(0, Math.floor(limit) || 0));
};

/** What a public donor wall may show of a donation. */
export interface PublicDonation {
  id: string;
  /** The donor's name, or `anonymousName`. */
  donorName: string;
  /** null when anonymous. */
  donorId: string | null;
  anonymous: boolean;
  /** null when anonymous. */
  message: string | null;
  /** Net, in the donation's currency. */
  amount: number;
  currency: string;
  recurring: boolean;
  createdAt: string;
}

/**
 * @function publicDonation
 * @param donation {Donation} a stored donation
 * @param options {{ anonymousName?: string }} name shown for anonymous donations, default
 *        "Anonymous"
 * @returns {PublicDonation} the fields a public page may show. Never carries `externalId` (a
 *          provider transaction id can prove ownership in claim flows), `source`, `settled` or
 *          refund details. Anonymous donations lose their name, `donorId` and message.
 * @throws {CrowdfundError} `refund-exceeds-amount`
 */
export const publicDonation = (
  donation: Donation,
  options: { anonymousName?: string } = {},
): PublicDonation => ({
  id: donation.id,
  donorName: donation.anonymous ? (options.anonymousName ?? "Anonymous") : donation.donorName,
  donorId: donation.anonymous ? null : donation.donorId,
  anonymous: donation.anonymous,
  message: donation.anonymous ? null : donation.message,
  amount: netAmount(donation),
  currency: donation.currency,
  recurring: donation.recurring,
  createdAt: donation.createdAt,
});
