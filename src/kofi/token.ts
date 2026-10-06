/**
 * @file src/kofi/token.ts
 * @desc Constant-time comparison of a Ko-fi verification token, with no Node-only APIs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { safeEqual } from "../signing.js";

/**
 * @function verifyKofiToken
 * @param provided {string} the `verification_token` from the webhook payload
 * @param expected {string} the token from your Ko-fi webhook settings
 * @returns {boolean} whether they match. Runs in time that depends only on the lengths, not on
 *          where they differ. Always false when `expected` is empty, so a missing secret never
 *          lets a request through.
 */
export const verifyKofiToken = (provided: string, expected: string): boolean =>
  safeEqual(provided, expected);
