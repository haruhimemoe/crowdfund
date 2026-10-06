/**
 * @file src/kofi/token.ts
 * @desc Constant-time comparison of a Ko-fi verification token, with no Node-only APIs. Compares UTF-16 code units, so
 *       lone surrogates never collapse into one character.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

/**
 * @function verifyKofiToken
 * @param provided {string} the `verification_token` from the webhook payload
 * @param expected {string} the token from your Ko-fi webhook settings
 * @returns {boolean} whether they match. Runs in time that depends only on the lengths, not on
 *          where they differ. Always false when `expected` is empty, so a missing secret never
 *          lets a request through.
 */
export const verifyKofiToken = (provided: string, expected: string): boolean => {
  const length = Math.max(provided.length, expected.length);
  let diff = provided.length ^ expected.length;
  for (let i = 0; i < length; i++) {
    diff |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0 && expected.length > 0;
};
