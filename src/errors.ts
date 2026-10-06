/**
 * @file src/errors.ts
 * @desc CrowdfundError: the one error class the package throws, with a code callers can switch on.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

/** Why a call refused its input. */
export type CrowdfundErrorCode =
  | "bad-amount"
  | "bad-currency"
  | "refund-exceeds-amount"
  | "already-refunded"
  | "overflow"
  | "bad-convert"
  | "bad-kofi-body"
  | "bad-webhook-body";

/** Thrown for input the package can't work with. `code` says which kind. */
export class CrowdfundError extends Error {
  readonly code: CrowdfundErrorCode;

  constructor(code: CrowdfundErrorCode, message: string) {
    super(message);
    this.name = "CrowdfundError";
    this.code = code;
  }
}
