/**
 * @file tests/github-sponsors.test.ts
 * @desc GitHub Sponsors signature checks and sponsorship mapping.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import {
  githubSponsorshipToDonation,
  parseGithubSponsorshipEvent,
  verifyGithubSignature,
} from "../src/github-sponsors/index.js";
import { donationSchema } from "../src/index.js";
import { githubSponsorship, SECRET, sign } from "./fixtures/providers.js";

const body = JSON.stringify(githubSponsorship);

describe("verifyGithubSignature", () => {
  it.each([
    [`sha256=${sign(SECRET, body)}`, SECRET, true],
    [`sha256=${sign("other", body)}`, SECRET, false],
    [sign(SECRET, body), SECRET, false],
    [null, SECRET, false],
    [`sha256=${sign("", body)}`, "", false],
  ])("%s is %s", async (header, secret, result) => {
    expect(await verifyGithubSignature(body, header, secret)).toBe(result);
  });
});

describe("githubSponsorshipToDonation", () => {
  const event = parseGithubSponsorshipEvent(body);

  it("maps a new sponsorship", () => {
    const donation = githubSponsorshipToDonation(event, { id: "d1" });
    expect(donation).toMatchObject({
      amount: 500,
      currency: "USD",
      donorName: "octocat",
      donorId: "github:1",
      anonymous: false,
      recurring: true,
      source: "github-sponsors",
      externalId: "MDExOlNwb25zb3JzaGlwMQ==",
    });
    expect(donationSchema.parse(donation)).toEqual(donation);
  });

  it("maps private and one-time sponsorships", () => {
    const sponsorship = {
      ...event.sponsorship,
      privacy_level: "private",
      sponsor: null,
      tier: { monthly_price_in_cents: 1000, is_one_time_payment: true },
    };
    expect(
      githubSponsorshipToDonation({ ...event, sponsorship }, { id: "d", source: "gh" }),
    ).toMatchObject({
      anonymous: true,
      recurring: false,
      donorName: "Sponsor",
      donorId: null,
      source: "gh",
    });
  });

  it("skips other actions and free tiers", () => {
    expect(githubSponsorshipToDonation({ ...event, action: "cancelled" }, { id: "d" })).toBeNull();
    const free = {
      ...event.sponsorship,
      tier: { monthly_price_in_cents: 0, is_one_time_payment: false },
    };
    expect(githubSponsorshipToDonation({ ...event, sponsorship: free }, { id: "d" })).toBeNull();
  });
});
