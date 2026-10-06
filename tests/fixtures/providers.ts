/**
 * @file tests/fixtures/providers.ts
 * @desc Webhook payloads shaped like the providers' documented events, and a signer for tests.\n *       Every secret is fake.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { createHmac } from "node:crypto";

export const SECRET = "whsec_test_not_a_real_secret";

export const sign = (secret: string, message: string): string =>
  createHmac("sha256", secret).update(message).digest("hex");

export const stripeCheckout = {
  id: "evt_1",
  object: "event",
  type: "checkout.session.completed",
  created: 1_776_945_600,
  data: {
    object: {
      id: "cs_test_1",
      object: "checkout.session",
      amount_total: 2500,
      currency: "usd",
      payment_intent: "pi_1",
      payment_status: "paid",
      created: 1_776_945_590,
      customer_details: { name: "Cityyy", email: "donor@example.com" },
      metadata: {},
    },
  },
};

export const stripeChargeRefunded = {
  id: "evt_2",
  type: "charge.refunded",
  created: 1_777_000_000,
  data: {
    object: {
      id: "ch_1",
      object: "charge",
      amount: 2500,
      amount_refunded: 1000,
      currency: "usd",
      payment_intent: "pi_1",
    },
  },
};

export const paypalCapture = {
  id: "WH-1",
  event_type: "PAYMENT.CAPTURE.COMPLETED",
  create_time: "2026-04-23T12:00:05Z",
  resource: {
    id: "CAPTURE1",
    status: "COMPLETED",
    amount: { currency_code: "EUR", value: "20.00" },
    create_time: "2026-04-23T12:00:00Z",
    seller_receivable_breakdown: {
      gross_amount: { currency_code: "EUR", value: "20.00" },
      receivable_amount: { currency_code: "USD", value: "20.95" },
    },
  },
};

export const paypalRefunded = {
  id: "WH-2",
  event_type: "PAYMENT.CAPTURE.REFUNDED",
  create_time: "2026-04-25T00:00:05Z",
  resource: {
    id: "REFUND1",
    amount: { currency_code: "EUR", value: "5.00" },
    create_time: "2026-04-25T00:00:00Z",
    seller_payable_breakdown: { total_refunded_amount: { currency_code: "EUR", value: "8.00" } },
    links: [
      { href: "https://api.paypal.com/v2/payments/refunds/REFUND1", rel: "self" },
      { href: "https://api.paypal.com/v2/payments/captures/CAPTURE1", rel: "up" },
    ],
  },
};

export const githubSponsorship = {
  action: "created",
  sponsorship: {
    node_id: "MDExOlNwb25zb3JzaGlwMQ==",
    created_at: "2026-04-23T12:00:00Z",
    privacy_level: "public",
    sponsor: { login: "octocat", id: 1 },
    tier: { monthly_price_in_cents: 500, is_one_time_payment: false, is_custom_amount: false },
  },
};

export const bmcDonation = {
  event_id: 1234,
  type: "donation.created",
  live_mode: true,
  created: 1_776_945_600,
  attempt: 1,
  data: {
    id: 99,
    amount: 15,
    object: "payment",
    status: "succeeded",
    message: "",
    currency: "USD",
    refunded: "false",
    created_at: 1_776_945_590,
    note_hidden: "false",
    refunded_at: null,
    support_note: "keep it up",
    supporter_name: "Kiri",
    transaction_id: "pi_bmc_1",
    supporter_email: "donor@example.com",
  },
};
