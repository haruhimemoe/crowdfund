/**
 * @file src/dedupe.ts
 * @desc Dedupe donations by (source, externalId), so a redelivered webhook isn't counted twice.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { Donation } from "./schemas.js";

/**
 * @function donationKey
 * @param donation {Pick<Donation, "source" | "externalId">} a donation or a candidate
 * @returns {string | null} a key unique per (source, externalId), or null without an externalId
 *          (manual entries never count as duplicates)
 */
export const donationKey = (donation: Pick<Donation, "source" | "externalId">): string | null =>
  donation.externalId === null ? null : JSON.stringify([donation.source, donation.externalId]);

/**
 * @function dedupeDonations
 * @param donations {readonly D[]} donations, possibly with redeliveries
 * @returns {D[]} the donations with the first of each key kept, order unchanged
 */
export const dedupeDonations = <D extends Pick<Donation, "source" | "externalId">>(
  donations: readonly D[],
): D[] => {
  const seen = new Set<string>();
  return donations.filter((donation) => {
    const key = donationKey(donation);
    if (key === null) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * @function hasDonation
 * @param donations {readonly Pick<Donation, "source" | "externalId">[]} what's already stored
 * @param candidate {Pick<Donation, "source" | "externalId">} an incoming donation
 * @returns {boolean} whether a donation with the same key is already there
 */
export const hasDonation = (
  donations: readonly Pick<Donation, "source" | "externalId">[],
  candidate: Pick<Donation, "source" | "externalId">,
): boolean => {
  const key = donationKey(candidate);
  return key !== null && donations.some((donation) => donationKey(donation) === key);
};
