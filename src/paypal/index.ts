/**
 * @file src/paypal/index.ts
 * @desc @haruhimemoe/crowdfund/paypal: PayPal webhook events to donations and refunds, and the\n *       body for PayPal's verify-webhook-signature call. No PayPal SDK, no HTTP.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";
import { toMinorUnits } from "../money.js";
import type { Donation, Refund, Settled } from "../schemas.js";
import { parseWebhookJson } from "../signing.js";

const money = z.object({ currency_code: z.string(), value: z.string() });

/** The parts of a PayPal webhook event this subpath reads. Other keys are dropped. */
export const paypalEventSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  create_time: z.iso.datetime({ offset: true }),
  resource: z.object({
    id: z.string().min(1),
    status: z.string().optional(),
    amount: money.optional(),
    create_time: z.iso.datetime({ offset: true }).optional(),
    custom_id: z.string().nullish(),
    seller_receivable_breakdown: z.object({ receivable_amount: money.optional() }).nullish(),
    seller_payable_breakdown: z.object({ total_refunded_amount: money.optional() }).nullish(),
    links: z.array(z.object({ href: z.string(), rel: z.string() })).optional(),
  }),
});
export type PaypalEvent = z.infer<typeof paypalEventSchema>;

/**
 * @function parsePaypalEvent
 * @param rawBody {string} the request body
 * @returns {PaypalEvent} the parsed event. Verify it with PayPal before trusting it.
 * @throws {CrowdfundError} `bad-webhook-body` when it isn't JSON or doesn't match
 */
export const parsePaypalEvent = (rawBody: string): PaypalEvent =>
  parseWebhookJson(paypalEventSchema, rawBody);

/** The body for `POST /v1/notifications/verify-webhook-signature`. */
export interface PaypalVerifyBody {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: unknown;
}

/**
 * @function paypalVerifyBody
 * @param headers {{ get(name: string): string | null }} the request headers (a `Headers` works)
 * @param rawBody {string} the request body
 * @param webhookId {string} your webhook's id from the PayPal dashboard
 * @returns {PaypalVerifyBody | null} the JSON to send to PayPal's verify-webhook-signature API
 *          with your access token, or null when a `paypal-*` header is missing. PayPal answers
 *          `{ "verification_status": "SUCCESS" }` for a genuine event.
 * @throws {CrowdfundError} `bad-webhook-body` when the body isn't JSON
 */
export const paypalVerifyBody = (
  headers: { get(name: string): string | null },
  rawBody: string,
  webhookId: string,
): PaypalVerifyBody | null => {
  const header = (name: string) => headers.get(`paypal-${name}`) ?? "";
  const body = {
    auth_algo: header("auth-algo"),
    cert_url: header("cert-url"),
    transmission_id: header("transmission-id"),
    transmission_sig: header("transmission-sig"),
    transmission_time: header("transmission-time"),
    webhook_id: webhookId,
    webhook_event: parseWebhookJson(z.unknown(), rawBody),
  };
  return Object.values(body).every((value) => value !== "") ? body : null;
};

/** Options for `paypalToDonation`. */
export interface PaypalToDonationOptions {
  /** The new donation's id, from your store. */
  id: string;
  /** Default "paypal". */
  source?: string;
  /** A capture carries no payer name. Default "Supporter". */
  donorName?: string;
  /** Default false. */
  anonymous?: boolean;
  message?: string | null;
  recurring?: boolean;
}

const settledOf = (event: PaypalEvent): Settled | null => {
  const received = event.resource.seller_receivable_breakdown?.receivable_amount;
  if (!received) return null;
  return {
    amount: toMinorUnits(received.value, received.currency_code),
    currency: received.currency_code,
  };
};

/**
 * @function paypalToDonation
 * @param event {PaypalEvent} a verified, parsed event
 * @param options {PaypalToDonationOptions} the id and what PayPal doesn't carry
 * @returns {Donation | null} a donation for `PAYMENT.CAPTURE.COMPLETED`, else null.
 *          `externalId` is the capture id. When PayPal converted the payment, `settled` holds
 *          the amount received.
 * @throws {CrowdfundError} `bad-amount` or `bad-currency`
 */
export const paypalToDonation = (
  event: PaypalEvent,
  options: PaypalToDonationOptions,
): Donation | null => {
  const { resource } = event;
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED" || !resource.amount) return null;
  const amount = toMinorUnits(resource.amount.value, resource.amount.currency_code);
  const settled = settledOf(event);
  return {
    id: options.id,
    amount,
    currency: resource.amount.currency_code,
    donorName: options.donorName || "Supporter",
    donorId: null,
    anonymous: options.anonymous ?? false,
    message: options.message ?? null,
    source: options.source ?? "paypal",
    externalId: resource.id,
    recurring: options.recurring ?? false,
    createdAt: resource.create_time ?? event.create_time,
    settled: settled && settled.currency !== resource.amount.currency_code ? settled : null,
    refund: null,
  };
};

/** A refund found in a PayPal event, and which capture it belongs to. */
export interface PaypalRefund {
  /** The capture id: match it against `Donation.externalId`. */
  externalId: string;
  /** The total refunded so far. Apply with `refundDonation(d, refund, { replace: true })`. */
  refund: Refund;
}

/**
 * @function paypalRefund
 * @param event {PaypalEvent} a verified, parsed event
 * @param options {{ reason?: string | null }} the refund reason to record
 * @returns {PaypalRefund | null} for `PAYMENT.CAPTURE.REFUNDED`, else null. Uses the
 *          cumulative `total_refunded_amount` when PayPal sends it, else this refund's amount.
 * @throws {CrowdfundError} `bad-amount` or `bad-currency`
 */
export const paypalRefund = (
  event: PaypalEvent,
  options: { reason?: string | null } = {},
): PaypalRefund | null => {
  const { resource } = event;
  const capture = resource.links
    ?.find((link) => link.rel === "up")
    ?.href.split("/")
    .pop();
  const total = resource.seller_payable_breakdown?.total_refunded_amount ?? resource.amount;
  if (event.event_type !== "PAYMENT.CAPTURE.REFUNDED" || !capture || !total) return null;
  const amount = toMinorUnits(total.value, total.currency_code);
  if (amount === 0) return null;
  return {
    externalId: capture,
    refund: {
      amount,
      refundedAt: resource.create_time ?? event.create_time,
      reason: options.reason ?? null,
    },
  };
};
