# AGENTS.md

`@haruhimemoe/crowdfund`: one job. Record crowdfund state (goals, tiers, donations, refunds) and add it up. It never moves money, and storage, routes and UI live in the host app. Keep it that way.

## Rules

- **No runtime dependencies.** `zod` is the only peer. No network, no DOM, no Node-only APIs in `src/`. `tests/api.test.ts` checks imports, `process` and `Buffer`.
- **Money is integers.** Minor units, safe integers, no float math on amounts. Sums go through `addMinor`. A net is never negative and never above its gross. Keep the property test in `tests/totals.test.ts` passing.
- **Anonymous stays anonymous.** Nothing that builds public output (`topDonors`, `publicDonation`) may carry an anonymous donor's name, id or message, or any `externalId`.
- **Schemas stay extendable.** No `.refine` or `.superRefine` on exported object schemas. Cross-field rules live in functions and throw `CrowdfundError`.
- **Public API is pinned** by `tests/api.test.ts`, per subpath. Adding or removing an export is a semver decision: say so in `CHANGELOG.md`. Keep the README's API section in step with `src/`.
- **Test first.** A behavior change starts as a failing case in the matching test file.
- **Changelog.** A change users can see gets a line under `## [Unreleased]` in `CHANGELOG.md` ([Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)). Never rewrite a released entry. While on 0.x, a change to a schema or to how totals are computed is a minor version.
- **Releases are cut by the maintainers.** Don't bump the version, tag, push or publish unless a maintainer asks.
- Code style: Biome (2 spaces, double quotes, 100 columns). Every file starts with the `@file / @desc / @author / @created / @modified` header. Functions exported from a file in `src/` get a JSDoc block with `@function`, `@param` and `@returns` (and `@throws`). Keep files under 250 lines (`tests/api.test.ts` checks).
- Imports inside `src/` use `.js` extensions (Node ESM).
- Docs are for their readers: `README.md` for users, `CONTRIBUTING.md` for contributors, this file for agents. No maintainer notes in any of them.

## Layout

| Path | What's there |
| --- | --- |
| `src/index.ts` | The root exports. |
| `src/errors.ts` | `CrowdfundError` and its codes. |
| `src/schemas.ts` | Every zod schema and its type. |
| `src/money.ts` | `currencyExponent`, `toMinorUnits`, `addMinor` (internal), `netAmount`, `isRefunded`, `refundDonation`. |
| `src/totals.ts` | `valueIn` (internal), `totalsByCurrency`, `totalsFor`, the `Convert` type. |
| `src/goals.ts` | `goalProgress`, `unlockedTiers`, `nextTier`. |
| `src/donors.ts` | `topDonors`, `publicDonation`. |
| `src/dedupe.ts` | `donationKey`, `dedupeDonations`, `hasDonation`. |
| `src/kofi/` | `./kofi`: `index.ts` (schema, parsing, mapping, transaction ids), `token.ts` (`verifyKofiToken`). |
| `tests/` | Vitest, one file per `src/` module plus `api`; `fixtures/` has builders and a Ko-fi payload with a fake token. |
| `scripts/smoke.mjs` | Imports the built package through its exports map (`bun run test:dist`). |
| `scripts/check-consumer.mjs` | Packs the package, installs it with a given zod version in a temp project, then typechecks and runs a strict consumer (`bun run check:consumer <zod version>`). |
| `.github/workflows/` | `ci.yml` (checks, coverage, dist on Node 22.12 and 24, consumer on zod 4.0.16 and latest) and `release.yml` (publishes on a GitHub release). |

## Before calling a change done

```sh
bun run check && bun run typecheck && bun run test && bun run test:dist
```

CI also runs `bun run test:coverage` (95% floor on `src/`) and `bun run check:consumer`.
