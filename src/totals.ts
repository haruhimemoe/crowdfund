/**
 * @file src/totals.ts
 * @desc Gross, refunded and net totals per currency, and in one currency through a host-supplied
 *       converter.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { CrowdfundError } from "./errors.js";
import { addMinor, netAmount } from "./money.js";
import type { Donation } from "./schemas.js";

/** Turns minor units of `from` into minor units of `to`. The host owns exchange rates. */
export type Convert = (amount: number, from: string, to: string) => number;

/** Options for the functions that total in one currency. */
export interface ConvertOptions {
  /** Values donations in other currencies that carry no `settled` value in the target
   *  currency. Without it they're skipped. */
  convert?: Convert;
}

/** Totals for one currency, in its minor units. */
export interface CurrencyTotals {
  currency: string;
  /** Sum of every donation's amount. */
  gross: number;
  /** Sum of the refunds. */
  refunded: number;
  /** gross - refunded. */
  net: number;
  /** How many donations. */
  count: number;
  /** How many of them carry a refund. */
  refundedCount: number;
}

const empty = (currency: string): CurrencyTotals => ({
  currency,
  gross: 0,
  refunded: 0,
  net: 0,
  count: 0,
  refundedCount: 0,
});

const add = (totals: CurrencyTotals, gross: number, net: number, refunded: boolean): void => {
  totals.gross = addMinor(totals.gross, gross);
  totals.net = addMinor(totals.net, net);
  totals.refunded = totals.gross - totals.net;
  totals.count += 1;
  if (refunded) totals.refundedCount += 1;
};

/** A donation's gross and net in one currency. */
export interface Valued {
  gross: number;
  net: number;
}

const checkConverted = (result: number, amount: number, from: string, to: string): number => {
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new CrowdfundError("bad-convert", `convert(${amount}, ${from}, ${to}) gave ${result}`);
  }
  return result;
};

/**
 * @function valueIn
 * @param donation {Donation} a donation
 * @param currency {string} the currency to value it in
 * @param convert {Convert | undefined} the host's converter
 * @returns {Valued | null} gross and net in `currency`, or null when it can't be valued there.
 *          In another currency the gross comes from `settled` when it's in `currency`, else from
 *          one `convert` call; the net is the gross scaled by net / amount, rounded down, so
 *          0 <= net <= gross always holds.
 * @throws {CrowdfundError} `refund-exceeds-amount` or `bad-convert`
 */
export const valueIn = (
  donation: Donation,
  currency: string,
  convert: Convert | undefined,
): Valued | null => {
  const net = netAmount(donation);
  if (donation.currency === currency) return { gross: donation.amount, net };
  let gross: number;
  if (donation.settled !== null && donation.settled.currency === currency) {
    gross = donation.settled.amount;
  } else if (convert) {
    gross = checkConverted(
      convert(donation.amount, donation.currency, currency),
      donation.amount,
      donation.currency,
      currency,
    );
  } else {
    return null;
  }
  const scaled = (BigInt(gross) * BigInt(net)) / BigInt(donation.amount);
  return { gross, net: Number(scaled) };
};

/**
 * @function totalsByCurrency
 * @param donations {readonly Donation[]} donations in any currencies
 * @returns {CurrencyTotals[]} one entry per currency, sorted by code
 * @throws {CrowdfundError} `refund-exceeds-amount` or `overflow`
 */
export const totalsByCurrency = (donations: readonly Donation[]): CurrencyTotals[] => {
  const byCurrency = new Map<string, CurrencyTotals>();
  for (const donation of donations) {
    let totals = byCurrency.get(donation.currency);
    if (!totals) {
      totals = empty(donation.currency);
      byCurrency.set(donation.currency, totals);
    }
    add(totals, donation.amount, netAmount(donation), donation.refund !== null);
  }
  return [...byCurrency.values()].sort((a, b) => (a.currency < b.currency ? -1 : 1));
};

/**
 * @function totalsFor
 * @param donations {readonly Donation[]} donations in any currencies
 * @param currency {string} the currency to total in
 * @param options {ConvertOptions} `convert` to count other currencies
 * @returns {CurrencyTotals} totals in `currency`. Donations in other currencies count through
 *          their `settled` value or `convert`, and are skipped when they have neither.
 * @throws {CrowdfundError} `refund-exceeds-amount`, `overflow` or `bad-convert`
 */
export const totalsFor = (
  donations: readonly Donation[],
  currency: string,
  options: ConvertOptions = {},
): CurrencyTotals => {
  const totals = empty(currency);
  for (const donation of donations) {
    const value = valueIn(donation, currency, options.convert);
    if (value) add(totals, value.gross, value.net, donation.refund !== null);
  }
  return totals;
};
