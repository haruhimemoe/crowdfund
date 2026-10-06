/**
 * @file tests/paypal.test.ts
 * @desc PayPal verify-request body, event parsing, donation and refund mapping.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { donationSchema, netAmount, refundDonation } from "../src/index.js";
import {
  parsePaypalEvent,
  paypalRefund,
  paypalToDonation,
  paypalVerifyBody,
} from "../src/paypal/index.js";
import { paypalCapture, paypalRefunded } from "./fixtures/providers.js";

const capture = parsePaypalEvent(JSON.stringify(paypalCapture));

describe("paypalVerifyBody", () => {
  const headers = new Headers({
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT-1",
    "paypal-transmission-id": "tid",
    "paypal-transmission-sig": "sig",
    "paypal-transmission-time": "2026-04-23T12:00:05Z",
  });

  it("builds the verify request from the headers", () => {
    expect(paypalVerifyBody(headers, JSON.stringify(paypalCapture), "WH-ID")).toEqual({
      auth_algo: "SHA256withRSA",
      cert_url: "https://api.paypal.com/v1/notifications/certs/CERT-1",
      transmission_id: "tid",
      transmission_sig: "sig",
      transmission_time: "2026-04-23T12:00:05Z",
      webhook_id: "WH-ID",
      webhook_event: paypalCapture,
    });
  });

  it("is null when a header or the webhook id is missing", () => {
    const partial = new Headers(headers);
    partial.delete("paypal-transmission-sig");
    expect(paypalVerifyBody(partial, "{}", "WH-ID")).toBeNull();
    expect(paypalVerifyBody(headers, "{}", "")).toBeNull();
    expect(() => paypalVerifyBody(headers, "nope", "WH-ID")).toThrow(/isn't JSON/);
  });
});

describe("mapping", () => {
  it("maps a capture with its converted settlement", () => {
    const donation = paypalToDonation(capture, { id: "d1", donorName: "Cityyy" });
    expect(donation).toMatchObject({
      amount: 2000,
      currency: "EUR",
      donorName: "Cityyy",
      source: "paypal",
      externalId: "CAPTURE1",
      createdAt: "2026-04-23T12:00:00Z",
      settled: { amount: 2095, currency: "USD" },
    });
    expect(donationSchema.parse(donation)).toEqual(donation);
  });

  it("leaves settled empty in the same currency and defaults the name", () => {
    const same = {
      ...capture,
      resource: {
        ...capture.resource,
        create_time: undefined,
        seller_receivable_breakdown: {
          receivable_amount: { currency_code: "EUR", value: "19.00" },
        },
      },
    };
    expect(paypalToDonation(same, { id: "d" })).toMatchObject({
      settled: null,
      donorName: "Supporter",
      createdAt: "2026-04-23T12:00:05Z",
    });
    const bare = {
      ...capture,
      resource: { ...capture.resource, seller_receivable_breakdown: null },
    };
    expect(paypalToDonation(bare, { id: "d" })?.settled).toBeNull();
  });

  it("skips other events", () => {
    expect(
      paypalToDonation({ ...capture, event_type: "PAYMENT.CAPTURE.DENIED" }, { id: "d" }),
    ).toBeNull();
  });

  it("reads the cumulative refund and its capture", () => {
    const refunded = paypalRefund(parsePaypalEvent(JSON.stringify(paypalRefunded)));
    expect(refunded).toEqual({
      externalId: "CAPTURE1",
      refund: { amount: 800, refundedAt: "2026-04-25T00:00:00Z", reason: null },
    });
    const donation = paypalToDonation(capture, { id: "d" });
    if (!donation || !refunded) throw new Error("mapping");
    expect(netAmount(refundDonation(donation, refunded.refund))).toBe(1200);
  });

  it("falls back to the refund amount, and skips refunds it can't place", () => {
    const event = parsePaypalEvent(JSON.stringify(paypalRefunded));
    const single = { ...event, resource: { ...event.resource, seller_payable_breakdown: null } };
    expect(paypalRefund(single, { reason: "dupe" })?.refund).toMatchObject({
      amount: 500,
      reason: "dupe",
    });
    expect(paypalRefund({ ...event, resource: { ...event.resource, links: [] } })).toBeNull();
    expect(paypalRefund(capture)).toBeNull();
    const zero = {
      ...single,
      resource: { ...single.resource, amount: { currency_code: "EUR", value: "0" } },
    };
    expect(paypalRefund(zero)).toBeNull();
  });
});
