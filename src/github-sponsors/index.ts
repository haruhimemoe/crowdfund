/**
 * @file src/github-sponsors/index.ts
 * @desc @haruhimemoe/crowdfund/github-sponsors: GitHub Sponsors webhook signature check and
 *       sponsorship to donation mapping. Web Crypto only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";
import type { Donation } from "../schemas.js";
import { hmacSha256Hex, parseWebhookJson, safeEqual } from "../signing.js";

/**
 * @function verifyGithubSignature
 * @param rawBody {string} the request body exactly as received
 * @param header {string | null} the `X-Hub-Signature-256` header (`sha256=<hex>`)
 * @param secret {string} the webhook secret
 * @returns {Promise<boolean>} whether the signature matches. False for a missing header or an
 *          empty secret.
 */
export const verifyGithubSignature = async (
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> => {
  if (!header?.startsWith("sha256=") || !secret) return false;
  return safeEqual(header.slice(7), await hmacSha256Hex(secret, rawBody));
};

/** The parts of a `sponsorship` event this subpath reads. Other keys are dropped. */
export const githubSponsorshipEventSchema = z.object({
  action: z.string().min(1),
  sponsorship: z.object({
    node_id: z.string().min(1),
    created_at: z.iso.datetime({ offset: true }),
    privacy_level: z.string(),
    sponsor: z.object({ login: z.string().min(1), id: z.number().int() }).nullish(),
    tier: z.object({
      monthly_price_in_cents: z.number().int().min(0),
      is_one_time_payment: z.boolean(),
    }),
  }),
});
export type GithubSponsorshipEvent = z.infer<typeof githubSponsorshipEventSchema>;

/**
 * @function parseGithubSponsorshipEvent
 * @param rawBody {string} the verified request body of a `sponsorship` event
 * @returns {GithubSponsorshipEvent} the parsed event
 * @throws {CrowdfundError} `bad-webhook-body` when it isn't JSON or doesn't match
 */
export const parseGithubSponsorshipEvent = (rawBody: string): GithubSponsorshipEvent =>
  parseWebhookJson(githubSponsorshipEventSchema, rawBody);

/**
 * @function githubSponsorshipToDonation
 * @param event {GithubSponsorshipEvent} a verified, parsed event
 * @param options {{ id: string; source?: string }} the new donation's id; `source` defaults to
 *        "github-sponsors"
 * @returns {Donation | null} a USD donation for `action: "created"`, else null. `anonymous` is
 *          `privacy_level === "private"`; `donorId` is the sponsor's GitHub user id. GitHub
 *          sends no event per monthly payment, so a recurring sponsorship records its first
 *          month only (`recurring: true`); count later months from GitHub's API if you need
 *          them. `externalId` is the sponsorship's node id.
 */
export const githubSponsorshipToDonation = (
  event: GithubSponsorshipEvent,
  options: { id: string; source?: string },
): Donation | null => {
  const { sponsorship } = event;
  const amount = sponsorship.tier.monthly_price_in_cents;
  if (event.action !== "created" || amount < 1) return null;
  return {
    id: options.id,
    amount,
    currency: "USD",
    donorName: sponsorship.sponsor?.login ?? "Sponsor",
    donorId: sponsorship.sponsor ? `github:${sponsorship.sponsor.id}` : null,
    anonymous: sponsorship.privacy_level === "private",
    message: null,
    source: options.source ?? "github-sponsors",
    externalId: sponsorship.node_id,
    recurring: !sponsorship.tier.is_one_time_payment,
    createdAt: sponsorship.created_at,
    settled: null,
    refund: null,
  };
};
