# Changelog

All notable changes to `@haruhimemoe/crowdfund` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). While on 0.x, a change to a schema or to how totals are computed is a minor version.

## [Unreleased]

## [0.1.0] - 2026-10-06

### Added

- `fundingGoalSchema`, `goalTierSchema`, `donationSchema`, `refundSchema`, `settledSchema`, `currencyCodeSchema`, `minorUnitsSchema`, `positiveMinorUnitsSchema`: zod schemas with no refinements, so they `.extend()`.
- `currencyExponent`, `toMinorUnits`, `netAmount`, `isRefunded`, `refundDonation`: integer money in any currency, full and partial refunds.
- `totalsByCurrency`, `totalsFor`: gross, refunded and net totals, with `settled` values and a host-supplied `convert`.
- `goalProgress`, `unlockedTiers`, `nextTier`: progress toward a goal and its stretch tiers.
- `topDonors`, `publicDonation`: donor leaderboards and public rows that never reveal an anonymous donor.
- `donationKey`, `dedupeDonations`, `hasDonation`: dedupe by `(source, externalId)`.
- `@haruhimemoe/crowdfund/kofi`: `kofiPayloadSchema`, `parseKofiBody`, `verifyKofiToken`, `kofiToDonation`, `extractKofiTransactionId`, `KOFI_TYPES`.
- `@haruhimemoe/crowdfund/stripe`: `verifyStripeSignature`, `parseStripeEvent`, `stripeEventSchema`, `stripeToDonation`, `stripeRefund`.
- `@haruhimemoe/crowdfund/paypal`: `paypalVerifyBody`, `parsePaypalEvent`, `paypalEventSchema`, `paypalToDonation`, `paypalRefund`.
- `@haruhimemoe/crowdfund/github-sponsors`: `verifyGithubSignature`, `parseGithubSponsorshipEvent`, `githubSponsorshipEventSchema`, `githubSponsorshipToDonation`.
- `@haruhimemoe/crowdfund/buymeacoffee`: `verifyBuyMeACoffeeSignature`, `parseBuyMeACoffeeEvent`, `buyMeACoffeeEventSchema`, `buyMeACoffeeToDonation`, `buyMeACoffeeRefund`.
- `CrowdfundError` with a `code`.

[Unreleased]: https://github.com/haruhimemoe/crowdfund/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/haruhimemoe/crowdfund/releases/tag/v0.1.0
