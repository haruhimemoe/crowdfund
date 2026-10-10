/**
 * @file src/signing.ts
 * @desc Shared webhook helpers: constant-time string compare, HMAC-SHA256 through Web Crypto,
 *       unix seconds to ISO, and JSON body parsing. Internal, not exported.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { z } from "zod";
import { CrowdfundError } from "./errors.js";

const encoder = new TextEncoder();

/**
 * @function safeEqual
 * @param provided {string} what the request carried
 * @param expected {string} what it should be
 * @returns {boolean} whether they match, in time that depends only on the lengths. False when
 *          `expected` is empty. Compares UTF-16 code units.
 */
export const safeEqual = (provided: string, expected: string): boolean => {
  const length = Math.max(provided.length, expected.length);
  let diff = provided.length ^ expected.length;
  for (let i = 0; i < length; i++) {
    diff |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0 && expected.length > 0;
};

/**
 * @function hmacSha256Hex
 * @param secret {string} the signing secret
 * @param message {string} the signed text
 * @returns {Promise<string>} the lowercase hex HMAC-SHA256
 */
export const hmacSha256Hex = async (secret: string, message: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * @function unixToIso
 * @param seconds {number} a unix time in seconds
 * @returns {string} the ISO 8601 UTC string
 */
export const unixToIso = (seconds: number): string => new Date(seconds * 1000).toISOString();

/**
 * @function parseWebhookJson
 * @param schema {z.ZodType} the event schema
 * @param rawBody {string} the request body
 * @returns {T} the parsed event
 * @throws {CrowdfundError} `bad-webhook-body` when it isn't JSON or doesn't match
 */
export const parseWebhookJson = <T>(schema: z.ZodType<T>, rawBody: string): T => {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new CrowdfundError("bad-webhook-body", "the body isn't JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new CrowdfundError("bad-webhook-body", `bad event fields: ${fields}`);
  }
  return parsed.data;
};
