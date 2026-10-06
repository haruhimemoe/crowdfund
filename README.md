# @haruhimemoe/crowdfund

Crowdfunding state as data: zod schemas for goals, stretch tiers, donations and refunds, and pure functions for totals, goal progress, tiers and donor leaderboards. Money is integer minor units in any currency. A `/kofi` subpath turns Ko-fi webhooks into donations. No runtime dependencies besides zod. ESM for Node 22.12+, Bun, Deno, browsers and edge runtimes.

It never moves money. Your payment provider takes the payment; this package records what it reports and adds it up. Storage, routes and UI stay in your app.

## Install

```sh
bun add @haruhimemoe/crowdfund zod
npm install @haruhimemoe/crowdfund zod
deno add npm:@haruhimemoe/crowdfund npm:zod
```

`zod` (4.0.16 or later in 4.x) is a peer dependency, so your app and this package share one copy and the schemas compose with yours.

## Quick start

A Ko-fi webhook route, with any framework:

```ts
import { CrowdfundError, hasDonation } from "@haruhimemoe/crowdfund";
import { kofiToDonation, parseKofiBody, verifyKofiToken } from "@haruhimemoe/crowdfund/kofi";

export const POST = async (request: Request) => {
  let donation;
  try {
    const payload = parseKofiBody(await request.text());
    if (!verifyKofiToken(payload.verification_token, process.env.KOFI_TOKEN ?? "")) {
      return new Response(null, { status: 401 });
    }
    donation = kofiToDonation(payload, { id: crypto.randomUUID() });
  } catch (error) {
    // Every CrowdfundError here is about the payload, so a retry won't help. Answer 400
    // without echoing the message: the token hasn't been checked yet.
    if (error instanceof CrowdfundError) return new Response(null, { status: 400 });
    throw error;
  }
  if (donation && !hasDonation(await db.donations.all(), donation)) {
    await db.donations.insert(donation);
  }
  return new Response(null, { status: 200 });
};
```

A crowdfund page:

```ts
import { goalProgress, nextTier, topDonors, unlockedTiers } from "@haruhimemoe/crowdfund";

const progress = goalProgress(goal, donations);
// { currency: "USD", goal: 100000, raised: 42500, remaining: 57500, percent: 42, reached: false }
unlockedTiers(tiers, progress.raised); // tiers at or under 425.00
nextTier(tiers, progress.raised); // { tier, remaining: 7500 } or null
topDonors(donations, { currency: "USD", limit: 10 }); // anonymous donors show as "Anonymous"
```

Show amounts with `Intl.NumberFormat`, dividing by `10 ** currencyExponent(currency)`.

## API

### Money rules

- Amounts are integers in the currency's minor unit: cents for USD, yen for JPY, fils for KWD. `currencyExponent` says how many decimals a currency has. No function does float math on money.
- Totals that leave the safe integer range throw `overflow`.
- A refund is part of a donation (`refund: Refund | null`). It can be partial. A refund bigger than its donation throws `refund-exceeds-amount`, so net totals are never negative.
- Totals in one currency count other currencies through the donation's `settled` value (its worth in another currency, fixed when it was taken) or your `convert(amount, from, to)`. Without either, they're skipped. A converted net is the converted gross scaled by net / amount, rounded down, and the converted `refunded` is gross minus net, so it can be up to 1 minor unit high per partly refunded donation. `convert` must return an integer of 0 or more, or it throws `bad-convert`.

### Schemas

Plain `z.object`s with no refinements. Functions check amounts they rely on (`bad-amount`), but parse records from outside with these first, so `.extend()` adds your own fields (an edition id, a user's osu! id, a banner choice). Ids are strings. Dates are ISO 8601 strings with `Z` or an offset.

| Schema | Fields |
| --- | --- |
| `fundingGoalSchema` | `id`, `label`, `description` (or null), `amount`, `currency` |
| `goalTierSchema` | `id`, `threshold` (in its goal's currency), `label`, `reward` |
| `donationSchema` | `id`, `amount`, `currency`, `donorName`, `donorId` (or null), `anonymous`, `message` (or null), `source` (like `"ko-fi"` or `"manual"`), `externalId` (the provider's id, or null), `recurring`, `createdAt`, `settled` (or null), `refund` (or null) |
| `refundSchema` | `amount`, `refundedAt`, `reason` (or null) |
| `settledSchema` | `amount`, `currency` |
| `currencyCodeSchema` | 3 uppercase letters |
| `minorUnitsSchema`, `positiveMinorUnitsSchema` | safe integers, `>= 0` and `>= 1` |

Each has a matching type: `FundingGoal`, `GoalTier`, `Donation`, `Refund`, `Settled`.

### `@haruhimemoe/crowdfund`

| Export | Does |
| --- | --- |
| `currencyExponent(currency)` | Decimal places of its minor unit: 0 for JPY, 3 for KWD, 2 for most. Throws `bad-currency` for a bad code. |
| `toMinorUnits(amount, currency)` | `"25.00"` USD to `2500`. Throws `bad-amount` for anything but digits with an optional fraction, or a fraction finer than the minor unit (`"500.5"` JPY). Trailing zeros are fine. |
| `netAmount(donation)` | Amount minus its refund. Throws `refund-exceeds-amount`, or `bad-amount` for an amount or refund that isn't a safe integer. |
| `isRefunded(donation)` | Whether it has a refund. |
| `refundDonation(donation, refund, { replace? })` | A copy with the refund. Throws `already-refunded` unless `replace: true`, and `refund-exceeds-amount`. |
| `totalsByCurrency(donations)` | `CurrencyTotals[]` sorted by code: `{ currency, gross, refunded, net, count, refundedCount }`. |
| `totalsFor(donations, currency, { convert? })` | `CurrencyTotals` in one currency. |
| `goalProgress(goal, donations, { convert? })` | `{ currency, goal, raised, remaining, percent, reached }`. `raised` is net. `percent` is rounded down and not capped, so 150 means 1.5 times the goal. Throws `bad-amount` for a goal amount under 1. |
| `unlockedTiers(tiers, raised)` | Tiers with `threshold <= raised`, lowest first, ties by id. |
| `nextTier(tiers, raised)` | `{ tier, remaining }` for the lowest locked tier, or null. |
| `topDonors(donations, { currency, limit?, convert?, anonymousName? })` | `DonorRank[]`: `{ donorName, donorId, anonymous, amount, currency, count }`, highest net first. Named donations group by `donorId`, else by name (trimmed, any case), and show the latest name. Each anonymous donation is its own row named `anonymousName` (default `"Anonymous"`) with no id. Donors at 0 are left out. Ties go to the earlier donor. `limit` is rounded down. Grouping by name merges two people who use the same name, so set `donorId` when you know who gave. |
| `publicDonation(donation, { anonymousName? })` | The fields a public page may show: `{ id, donorName, donorId, anonymous, message, amount (net), currency, recurring, createdAt }`. Never includes `externalId`, `source`, `settled` or the refund. Anonymous donations lose their name, id and message, but keep amount and time, which someone could match against the provider's public feed. Round `createdAt` if that matters. |
| `donationKey(donation)` | A string unique per `(source, externalId)`, or null without an `externalId`. |
| `dedupeDonations(donations)` | Keeps the first donation of each key and every one without a key, in order. |
| `hasDonation(donations, candidate)` | Whether the candidate's key is already there. For a large store, put a unique index on `(source, externalId)` instead. |

`CrowdfundError` has a `code`: `"bad-amount" | "bad-currency" | "refund-exceeds-amount" | "already-refunded" | "overflow" | "bad-convert" | "bad-kofi-body"`.

### `@haruhimemoe/crowdfund/kofi`

Ko-fi posts `application/x-www-form-urlencoded` with one `data` field holding JSON. These functions are pure; your route reads the body and answers.

| Export | Does |
| --- | --- |
| `parseKofiBody(body)` | The validated `KofiPayload`. Throws `bad-kofi-body` when `data` is missing, isn't JSON or doesn't match. Unknown keys are dropped, and unknown `type`s parse, so a new Ko-fi type doesn't make Ko-fi retry forever. |
| `kofiPayloadSchema` | The zod schema behind it. |
| `verifyKofiToken(provided, expected)` | Constant-time compare with your webhook token. False when `expected` is empty, so a missing secret never lets a request through. |
| `kofiToDonation(payload, { id, source?, accept? })` | A `Donation`, or null for a type not in `accept` (default `["Donation"]`). `source` defaults to `"ko-fi"`, `externalId` is the transaction id, `anonymous` is `!is_public`. An empty `from_name` becomes `"Ko-fi Supporter"`. Throws `bad-amount` for a zero amount or one finer than the currency's minor unit. |
| `extractKofiTransactionId(ref)` | The transaction id from what a donor pasted: a bare id, a receipt URL or a `txid=` fragment. |
| `KOFI_TYPES` | `["Donation", "Subscription", "Commission", "Shop Order"]`. |

A parsed payload still holds the verification token and the donor's email. Don't log or store it raw. `kofiToDonation` copies neither. Pass your own `id`: the Ko-fi transaction id can prove who paid, so keep it out of public pages (`publicDonation` drops it).

## License

MIT
