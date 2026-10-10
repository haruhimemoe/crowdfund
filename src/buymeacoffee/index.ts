/**
 * @file src/buymeacoffee/index.ts
 * @desc @haruhimemoe/crowdfund/buymeacoffee: Buy Me a Coffee webhook signature check and donation
 *       and refund mapping. Web Crypto only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";
import { CrowdfundError } from "../errors.js";
import { toMinorUnits } from "../money.js";
import type { Donation, Refund } from "../schemas.js";
import { hmacSha256Hex, parseWebhookJson, safeEqual, unixToIso } from "../signing.js";

/**
 * @function verifyBuyMeACoffeeSignature
 * @param rawBody {string} the request body exactly as received
 * @param header {string | null} the `x-signature-sha256` header (hex)
 * @param secret {string} the webhook's signing secret
 * @returns {Promise<boolean>} whether the signature matches. False for a missing header or an
 *          empty secret.
 */
export const verifyBuyMeACoffeeSignature = async (
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> => {
  if (!header || !secret) return false;
  return safeEqual(header.trim().toLowerCase(), await hmacSha256Hex(secret, rawBody));
};

const flag = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === "true");

/** The parts of a Buy Me a Coffee event this subpath reads. Other keys are dropped. */
export const buyMeACoffeeEventSchema = z.object({
  type: z.string().min(1),
  live_mode: z.boolean(),
  created: z.number().int(),
  event_id: z.union([z.number(), z.string()]),
  data: z.object({
    id: z.union([z.number(), z.string()]).transform(String),
    amount: z.union([z.number().nonnegative(), z.string()]),
    currency: z.string().regex(/^[A-Z]{3}$/i),
    status: z.string().optional(),
    created_at: z.number().int().optional(),
    refunded_at: z.number().int().nullish(),
    support_note: z.string().nullish(),
    note_hidden: flag.optional(),
    supporter_name: z.string().nullish(),
    supporter_id: z.union([z.number(), z.string()]).nullish(),
    transaction_id: z.string().nullish(),
  }),
});
export type BuyMeACoffeeEvent = z.infer<typeof buyMeACoffeeEventSchema>;

/**
 * @function parseBuyMeACoffeeEvent
 * @param rawBody {string} the verified request body
 * @returns {BuyMeACoffeeEvent} the parsed event
 * @throws {CrowdfundError} `bad-webhook-body` when it isn't JSON or doesn't match
 */
export const parseBuyMeACoffeeEvent = (rawBody: string): BuyMeACoffeeEvent =>
  parseWebhookJson(buyMeACoffeeEventSchema, rawBody);

// Buy Me a Coffee sends amounts in major units, often as JSON numbers. Read them as decimal
// text so no float math touches the value.
const minorOf = (event: BuyMeACoffeeEvent): number => {
  const { amount, currency } = event.data;
  return toMinorUnits(typeof amount === "number" ? String(amount) : amount, currency.toUpperCase());
};

const externalIdOf = (event: BuyMeACoffeeEvent): string =>
  event.data.transaction_id || event.data.id;

/** Options for `buyMeACoffeeToDonation`. */
export interface BuyMeACoffeeToDonationOptions {
  /** The new donation's id, from your store. */
  id: string;
  /** Default "buymeacoffee". */
  source?: string;
  /** Default false. A hidden note already drops the message. */
  anonymous?: boolean;
  /** Turn test events into donations too. Default false. */
  allowTest?: boolean;
}

/**
 * @function buyMeACoffeeToDonation
 * @param event {BuyMeACoffeeEvent} a verified, parsed event
 * @param options {BuyMeACoffeeToDonationOptions} the id, plus `source`, `anonymous`, `allowTest`
 * @returns {Donation | null} a donation for a live `donation.created`, else null. The message is
 *          null when the supporter hid their note. `externalId` is the transaction id.
 * @throws {CrowdfundError} `bad-amount` or `bad-currency`
 */
export const buyMeACoffeeToDonation = (
  event: BuyMeACoffeeEvent,
  options: BuyMeACoffeeToDonationOptions,
): Donation | null => {
  if (event.type !== "donation.created") return null;
  if (!event.live_mode && options.allowTest !== true) return null;
  const amount = minorOf(event);
  if (amount === 0) throw new CrowdfundError("bad-amount", "a donation of 0");
  const { data } = event;
  return {
    id: options.id,
    amount,
    currency: data.currency.toUpperCase(),
    donorName: data.supporter_name?.trim().slice(0, 128) || "Supporter",
    donorId: null,
    anonymous: options.anonymous ?? false,
    message: data.note_hidden ? null : data.support_note?.slice(0, 2000) || null,
    source: options.source ?? "buymeacoffee",
    externalId: externalIdOf(event),
    recurring: false,
    createdAt: unixToIso(data.created_at ?? event.created),
    settled: null,
    refund: null,
  };
};

/**
 * @function buyMeACoffeeRefund
 * @param event {BuyMeACoffeeEvent} a verified, parsed event
 * @param options {{ reason?: string | null }} the refund reason to record
 * @returns {{ externalId: string; refund: Refund } | null} a full refund for `donation.refunded`,
 *          else null. Match `externalId` against `Donation.externalId`.
 * @throws {CrowdfundError} `bad-amount` or `bad-currency`
 */
export const buyMeACoffeeRefund = (
  event: BuyMeACoffeeEvent,
  options: { reason?: string | null } = {},
): { externalId: string; refund: Refund } | null => {
  if (event.type !== "donation.refunded") return null;
  const amount = minorOf(event);
  if (amount === 0) return null;
  return {
    externalId: externalIdOf(event),
    refund: {
      amount,
      refundedAt: unixToIso(event.data.refunded_at ?? event.created),
      reason: options.reason ?? null,
    },
  };
};
