/**
 * @file src/stripe/index.ts
 * @desc @haruhimemoe/crowdfund/stripe: Stripe webhook signature check and event to donation or\n *       refund mapping. No Stripe SDK: Web Crypto only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";
import { CrowdfundError } from "../errors.js";
import type { Donation, Refund } from "../schemas.js";
import { hmacSha256Hex, parseWebhookJson, safeEqual, unixToIso } from "../signing.js";

/** Options for `verifyStripeSignature`. */
export interface VerifyStripeOptions {
  /** Oldest signature accepted, in seconds. Default 300, like Stripe's SDK. */
  toleranceSeconds?: number;
  /** The current unix time in seconds, for tests. Default now. */
  now?: number;
}

/**
 * @function verifyStripeSignature
 * @param rawBody {string} the request body exactly as received
 * @param header {string | null} the `Stripe-Signature` header
 * @param secret {string} the endpoint's signing secret (`whsec_...`)
 * @param options {VerifyStripeOptions} tolerance and clock
 * @returns {Promise<boolean>} true when one `v1` signature matches and its timestamp is within the
 *          tolerance. False for a missing header, an empty secret or a replayed request.
 */
export const verifyStripeSignature = async (
  rawBody: string,
  header: string | null,
  secret: string,
  options: VerifyStripeOptions = {},
): Promise<boolean> => {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1] ?? "";
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > (options.toleranceSeconds ?? 300)) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  let matched = false;
  for (const signature of signatures) matched = safeEqual(signature, expected) || matched;
  return matched;
};

const idOf = z
  .union([z.string(), z.object({ id: z.string() })])
  .transform((value) => (typeof value === "string" ? value : value.id));

/** The parts of a Stripe event this subpath reads. Other keys are dropped. */
export const stripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  created: z.number().int(),
  data: z.object({
    object: z.object({
      id: z.string().min(1),
      object: z.string(),
      amount: z.number().int().optional(),
      amount_total: z.number().int().nullish(),
      amount_received: z.number().int().optional(),
      amount_refunded: z.number().int().optional(),
      currency: z
        .string()
        .regex(/^[a-z]{3}$/i)
        .nullish(),
      payment_intent: idOf.nullish(),
      payment_status: z.string().optional(),
      status: z.string().optional(),
      created: z.number().int().optional(),
      customer_details: z.object({ name: z.string().nullish() }).nullish(),
      metadata: z.record(z.string(), z.string()).nullish(),
    }),
  }),
});
export type StripeEvent = z.infer<typeof stripeEventSchema>;

/**
 * @function parseStripeEvent
 * @param rawBody {string} the verified request body
 * @returns {StripeEvent} the parsed event
 * @throws {CrowdfundError} `bad-webhook-body` when it isn't JSON or doesn't match
 */
export const parseStripeEvent = (rawBody: string): StripeEvent =>
  parseWebhookJson(stripeEventSchema, rawBody);

/** Options for `stripeToDonation`. */
export interface StripeToDonationOptions {
  /** The new donation's id, from your store. */
  id: string;
  /** Default "stripe". */
  source?: string;
  /** Shown name when Stripe has none. Default "Supporter". */
  donorName?: string;
  /** Stripe has no public flag; set it from your checkout. Default false. */
  anonymous?: boolean;
  message?: string | null;
  recurring?: boolean;
}

/**
 * @function stripeToDonation
 * @param event {StripeEvent} a verified, parsed event
 * @param options {StripeToDonationOptions} the id and what Stripe doesn't carry
 * @returns {Donation | null} a donation for a paid `checkout.session.completed` or a
 *          `payment_intent.succeeded`, else null. `externalId` is the PaymentIntent id, so both
 *          events for one payment dedupe to one donation (a session without one uses its own id).
 *          Stripe amounts are already minor units.
 * @throws {CrowdfundError} `bad-amount` for a missing or zero amount
 */
export const stripeToDonation = (
  event: StripeEvent,
  options: StripeToDonationOptions,
): Donation | null => {
  const object = event.data.object;
  let amount: number | null | undefined;
  let externalId: string;
  if (event.type === "checkout.session.completed" && object.payment_status === "paid") {
    amount = object.amount_total;
    externalId = object.payment_intent ?? object.id;
  } else if (event.type === "payment_intent.succeeded") {
    amount = object.amount_received ?? object.amount;
    externalId = object.id;
  } else {
    return null;
  }
  if (!amount || amount < 1 || !object.currency) {
    throw new CrowdfundError("bad-amount", `event ${event.id} has no amount`);
  }
  const name = object.customer_details?.name?.trim().slice(0, 128);
  return {
    id: options.id,
    amount,
    currency: object.currency.toUpperCase(),
    donorName: name || options.donorName || "Supporter",
    donorId: null,
    anonymous: options.anonymous ?? false,
    message: options.message ?? null,
    source: options.source ?? "stripe",
    externalId,
    recurring: options.recurring ?? false,
    createdAt: unixToIso(object.created ?? event.created),
    settled: null,
    refund: null,
  };
};

/** A refund found in a `charge.refunded` event, and which payment it belongs to. */
export interface StripeRefund {
  /** The PaymentIntent id: match it against `Donation.externalId`. */
  externalId: string;
  /** The total refunded so far. Apply with `refundDonation(d, refund, { replace: true })`. */
  refund: Refund;
}

/**
 * @function stripeRefund
 * @param event {StripeEvent} a verified, parsed event
 * @param options {{ reason?: string | null }} the refund reason to record
 * @returns {StripeRefund | null} for a `charge.refunded` event, else null. `amount_refunded` is
 *          cumulative, so several partial refunds arrive as one growing total.
 */
export const stripeRefund = (
  event: StripeEvent,
  options: { reason?: string | null } = {},
): StripeRefund | null => {
  const object = event.data.object;
  if (event.type !== "charge.refunded" || !object.amount_refunded) return null;
  return {
    externalId: object.payment_intent ?? object.id,
    refund: {
      amount: object.amount_refunded,
      refundedAt: unixToIso(event.created),
      reason: options.reason ?? null,
    },
  };
};
