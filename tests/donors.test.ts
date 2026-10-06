/**
 * @file tests/donors.test.ts
 * @desc Top donors and public donations never show who an anonymous donor is.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { publicDonation, topDonors } from "../src/index.js";
import { donation } from "./fixtures/donations.js";

const refund = (amount: number) => ({ amount, refundedAt: "2026-05-01T00:00:00Z", reason: null });
const at = (day: number) => `2026-04-${String(day).padStart(2, "0")}T12:00:00Z`;

describe("topDonors", () => {
  it("groups by donorId, then by normalized name", () => {
    const ranks = topDonors(
      [
        donation(100, { donorId: "u1", donorName: "old name", createdAt: at(1) }),
        donation(200, { donorId: "u1", donorName: "new name", createdAt: at(2) }),
        donation(50, { donorName: "Kiri ", createdAt: at(3) }),
        donation(60, { donorName: "kiri", createdAt: at(4) }),
      ],
      { currency: "USD" },
    );
    expect(ranks).toEqual([
      {
        donorName: "new name",
        donorId: "u1",
        anonymous: false,
        amount: 300,
        currency: "USD",
        count: 2,
      },
      {
        donorName: "kiri",
        donorId: null,
        anonymous: false,
        amount: 110,
        currency: "USD",
        count: 2,
      },
    ]);
  });

  it("never groups anonymous donations and never shows their donor", () => {
    const ranks = topDonors(
      [
        donation(500, { donorId: "u1", donorName: "Secret", anonymous: true, message: "hi" }),
        donation(400, { donorId: "u1", donorName: "Secret", anonymous: true }),
        donation(100, { donorId: "u1", donorName: "Secret" }),
      ],
      { currency: "USD", anonymousName: "Someone" },
    );
    expect(ranks.map((r) => [r.donorName, r.donorId, r.amount])).toEqual([
      ["Someone", null, 500],
      ["Someone", null, 400],
      ["Secret", "u1", 100],
    ]);
    expect(JSON.stringify(ranks.slice(0, 2))).not.toMatch(/Secret|u1|hi/);
  });

  it("leaves out fully refunded donors and counts partial refunds net", () => {
    const ranks = topDonors(
      [donation(500, { refund: refund(500) }), donation(500, { refund: refund(100) })],
      { currency: "USD" },
    );
    expect(ranks.map((r) => r.amount)).toEqual([400]);
  });

  it("breaks ties by earliest donation, then name, and applies the limit", () => {
    const list = [
      donation(100, { donorName: "b", createdAt: at(2) }),
      donation(100, { donorName: "c", createdAt: "2026-04-01T20:00:00+09:00" }),
      donation(100, { donorName: "a", createdAt: at(2) }),
      donation(900, { donorName: "z", createdAt: at(9) }),
    ];
    expect(topDonors(list, { currency: "USD" }).map((r) => r.donorName)).toEqual([
      "z",
      "c",
      "a",
      "b",
    ]);
    const twins = [
      donation(100, { donorName: "B", donorId: "1", createdAt: at(2) }),
      donation(100, { donorName: "A", donorId: "2", createdAt: at(2) }),
      donation(100, { donorName: "A", donorId: "3", createdAt: at(2) }),
    ];
    expect(topDonors(twins, { currency: "USD" }).map((r) => r.donorId)).toEqual(["2", "3", "1"]);
    expect(topDonors(list, { currency: "USD", limit: 1 })).toHaveLength(1);
    expect(topDonors(list, { currency: "USD", limit: -1 })).toEqual([]);
  });

  it("keeps the name from the latest donation, by time not list order", () => {
    const ranks = topDonors(
      [
        donation(1, { donorId: "u", donorName: "newer", createdAt: at(5) }),
        donation(1, { donorId: "u", donorName: "older", createdAt: at(1) }),
      ],
      { currency: "USD" },
    );
    expect(ranks[0]?.donorName).toBe("newer");
  });

  it("skips other currencies unless converted", () => {
    const list = [donation(1000, { currency: "CAD" })];
    expect(topDonors(list, { currency: "USD" })).toEqual([]);
    expect(topDonors(list, { currency: "USD", convert: () => 730 })[0]?.amount).toBe(730);
  });
});

describe("publicDonation", () => {
  it("drops the external id and refund details", () => {
    const shown = publicDonation(
      donation(500, { externalId: "txid-secret", source: "ko-fi", refund: refund(100) }),
    );
    expect(shown.amount).toBe(400);
    expect(JSON.stringify(shown)).not.toMatch(/txid-secret|ko-fi|refund/);
  });

  it("hides an anonymous donor's name, id and message", () => {
    const shown = publicDonation(
      donation(500, { anonymous: true, donorName: "Secret", donorId: "u1", message: "hi" }),
    );
    expect(shown).toMatchObject({ donorName: "Anonymous", donorId: null, message: null });
    expect(publicDonation(donation(1, { anonymous: true }), { anonymousName: "?" }).donorName).toBe(
      "?",
    );
  });
});
