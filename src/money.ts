/**
 * @file src/money.ts
 * @desc Integer money: currency exponents, decimal text to minor units, checked sums, and
 *       refunds.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { CrowdfundError } from "./errors.js";
import type { Donation, Refund } from "./schemas.js";

// ISO 4217 currencies whose minor unit isn't 1/100. Everything else has 2 decimals.
const ZERO = "BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF";
const THREE = "BHD IQD JOD KWD LYD OMR TND";
const EXPONENTS = new Map<string, number>([
  ...ZERO.split(" ").map((code) => [code, 0] as const),
  ...THREE.split(" ").map((code) => [code, 3] as const),
  ["CLF", 4],
  ["UYW", 4],
]);

/**
 * @function currencyExponent
 * @param currency {string} a 3-letter currency code
 * @returns {number} how many decimal digits its minor unit has: 0 for JPY, 3 for KWD, 2 otherwise
 * @throws {CrowdfundError} `bad-currency` for anything but 3 uppercase letters
 */
export const currencyExponent = (currency: string): number => {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new CrowdfundError("bad-currency", `not a currency code: "${currency}"`);
  }
  return EXPONENTS.get(currency) ?? 2;
};

/**
 * @function toMinorUnits
 * @param amount {string} a decimal amount like "25", "25.5" or "25.00"
 * @param currency {string} the amount's currency code
 * @returns {number} the amount in minor units (2500 for "25.00" USD)
 * @throws {CrowdfundError} `bad-amount` for anything but digits with an optional fraction, a
 *         fraction finer than the currency's minor unit (trailing zeros aside), or an unsafe
 *         integer; `bad-currency` for a bad code
 */
export const toMinorUnits = (amount: string, currency: string): number => {
  const exponent = currencyExponent(currency);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match || amount.length > 64) {
    throw new CrowdfundError("bad-amount", `not a decimal amount: "${amount}"`);
  }
  const [, whole = "", rawFraction = ""] = match;
  const fraction = rawFraction.replace(/0+$/, "");
  if (fraction.length > exponent) {
    throw new CrowdfundError("bad-amount", `"${amount}" is finer than one ${currency} minor unit`);
  }
  const value = BigInt(whole + fraction.padEnd(exponent, "0"));
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new CrowdfundError("bad-amount", `"${amount}" is too large`);
  }
  return Number(value);
};

/**
 * @function addMinor
 * @param a {number} minor units
 * @param b {number} minor units
 * @returns {number} a + b
 * @throws {CrowdfundError} `overflow` when the sum leaves the safe integer range
 */
export const addMinor = (a: number, b: number): number => {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new CrowdfundError("overflow", "total is too large");
  return sum;
};

/**
 * @function isRefunded
 * @param donation {Donation} a donation
 * @returns {boolean} whether any of it was refunded
 */
export const isRefunded = (donation: Donation): boolean => donation.refund !== null;

/**
 * @function netAmount
 * @param donation {Donation} a donation
 * @returns {number} what's left after its refund, in minor units (never negative)
 * @throws {CrowdfundError} `refund-exceeds-amount` when the refund is bigger than the donation,
 *         `bad-amount` when the amount or refund isn't a safe integer (amount 1 or more)
 */
export const netAmount = (donation: Donation): number => {
  const refunded = donation.refund?.amount ?? 0;
  if (!Number.isSafeInteger(donation.amount) || donation.amount < 1) {
    throw new CrowdfundError("bad-amount", `donation ${donation.id} has amount ${donation.amount}`);
  }
  if (!Number.isSafeInteger(refunded) || refunded < 0) {
    throw new CrowdfundError("bad-amount", `donation ${donation.id} refunds ${refunded}`);
  }
  if (refunded > donation.amount) {
    throw new CrowdfundError(
      "refund-exceeds-amount",
      `donation ${donation.id} refunds ${refunded} of ${donation.amount}`,
    );
  }
  return donation.amount - refunded;
};

/**
 * @function refundDonation
 * @param donation {Donation} a donation
 * @param refund {Refund} the refund, in the donation's currency
 * @param options {{ replace?: boolean }} `replace: true` swaps an existing refund (to correct one)
 * @returns {Donation} a copy of the donation carrying the refund
 * @throws {CrowdfundError} `already-refunded` when it has a refund and `replace` isn't set, or
 *         `refund-exceeds-amount`
 */
export const refundDonation = <D extends Donation>(
  donation: D,
  refund: Refund,
  options: { replace?: boolean } = {},
): D => {
  if (donation.refund !== null && options.replace !== true) {
    throw new CrowdfundError("already-refunded", `donation ${donation.id} is already refunded`);
  }
  const next = { ...donation, refund: { ...refund } };
  netAmount(next);
  return next;
};
