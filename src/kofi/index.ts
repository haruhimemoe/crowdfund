/**
 * @file src/kofi/index.ts
 * @desc @haruhimemoe/crowdfund/kofi: Ko-fi webhook payload schema, body parsing, token check and
 *       payload to donation mapping. No HTTP: the host's route calls these.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";
import { CrowdfundError } from "../errors.js";
import { toMinorUnits } from "../money.js";
import type { Donation } from "../schemas.js";

export { verifyKofiToken } from "./token.js";

/** The payload types Ko-fi documents. `kofiPayloadSchema` accepts others too. */
export const KOFI_TYPES = Object.freeze(["Donation", "Subscription", "Commission", "Shop Order"]);

/**
 * The JSON in a Ko-fi webhook's `data` field. Unknown keys are dropped. It still carries the
 * verification token and the donor's email: don't log or store it raw.
 */
export const kofiPayloadSchema = z.object({
  verification_token: z.string().min(1).max(256),
  message_id: z.string().min(1),
  timestamp: z.iso.datetime({ offset: true }),
  type: z.string().min(1),
  is_public: z.boolean(),
  from_name: z.string(),
  message: z.string().max(2000).nullish(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  url: z.string().nullish(),
  email: z.string().nullish(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  kofi_transaction_id: z.string().min(1).max(128),
  is_subscription_payment: z.boolean(),
  is_first_subscription_payment: z.boolean(),
  tier_name: z.string().nullish(),
});
export type KofiPayload = z.infer<typeof kofiPayloadSchema>;

/**
 * @function parseKofiBody
 * @param body {string} the raw `application/x-www-form-urlencoded` request body
 * @returns {KofiPayload} the validated payload. Check its token with `verifyKofiToken` next.
 * @throws {CrowdfundError} `bad-kofi-body` when `data` is missing, isn't JSON, or doesn't match
 *         the schema
 */
export const parseKofiBody = (body: string): KofiPayload => {
  const data = new URLSearchParams(body).get("data");
  if (!data) throw new CrowdfundError("bad-kofi-body", "the body has no `data` field");
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    throw new CrowdfundError("bad-kofi-body", "`data` isn't JSON");
  }
  const parsed = kofiPayloadSchema.safeParse(json);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new CrowdfundError("bad-kofi-body", `bad payload fields: ${fields}`);
  }
  return parsed.data;
};

/** Options for `kofiToDonation`. */
export interface KofiToDonationOptions {
  /** The new donation's id, from your store. Not the transaction id, which proves ownership. */
  id: string;
  /** Default "ko-fi". */
  source?: string;
  /** Payload types to turn into donations. Default `["Donation"]`. */
  accept?: readonly string[];
}

/**
 * @function kofiToDonation
 * @param payload {KofiPayload} a parsed, verified payload
 * @param options {KofiToDonationOptions} the id, plus `source` and `accept`
 * @returns {Donation | null} the donation, or null for a type not in `accept`. The email is not
 *          copied. An empty `from_name` becomes "Ko-fi Supporter"; a long one is cut to 128.
 * @throws {CrowdfundError} `bad-amount` for a zero amount or one finer than the currency's minor unit, `bad-currency`
 */
export const kofiToDonation = (
  payload: KofiPayload,
  options: KofiToDonationOptions,
): Donation | null => {
  if (!(options.accept ?? ["Donation"]).includes(payload.type)) return null;
  const amount = toMinorUnits(payload.amount, payload.currency);
  if (amount === 0) throw new CrowdfundError("bad-amount", "a donation of 0");
  return {
    id: options.id,
    amount,
    currency: payload.currency,
    donorName: payload.from_name.trim().slice(0, 128) || "Ko-fi Supporter",
    donorId: null,
    anonymous: !payload.is_public,
    message: payload.message ?? null,
    source: options.source ?? "ko-fi",
    externalId: payload.kofi_transaction_id,
    recurring: payload.is_subscription_payment,
    createdAt: payload.timestamp,
    settled: null,
    refund: null,
  };
};

/**
 * @function extractKofiTransactionId
 * @param ref {string} what a donor pasted: a bare transaction id, a Ko-fi receipt or share URL,
 *        or a `txid=...` fragment
 * @returns {string} the transaction id, or the trimmed input when there's no `txid` parameter
 */
export const extractKofiTransactionId = (ref: string): string => {
  const trimmed = ref.trim();
  const match = /(?:^|[?&#])txid=([^&#\s]+)/i.exec(trimmed);
  if (!match?.[1]) return trimmed;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};
