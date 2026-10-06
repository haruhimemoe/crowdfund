/**
 * @file tests/api.test.ts
 * @desc The public surface per subpath (an added or removed export is a visible semver\n *       question), the exports map, and that src/ stays browser-safe and small.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as root from "../src/index.js";
import * as kofi from "../src/kofi/index.js";

const ROOT = [
  "CrowdfundError",
  "currencyCodeSchema",
  "currencyExponent",
  "dedupeDonations",
  "donationKey",
  "donationSchema",
  "fundingGoalSchema",
  "goalProgress",
  "goalTierSchema",
  "hasDonation",
  "isRefunded",
  "minorUnitsSchema",
  "netAmount",
  "nextTier",
  "positiveMinorUnitsSchema",
  "publicDonation",
  "refundDonation",
  "refundSchema",
  "settledSchema",
  "toMinorUnits",
  "topDonors",
  "totalsByCurrency",
  "totalsFor",
  "unlockedTiers",
];
const KOFI = [
  "KOFI_TYPES",
  "extractKofiTransactionId",
  "kofiPayloadSchema",
  "kofiToDonation",
  "parseKofiBody",
  "verifyKofiToken",
];

describe("exports", () => {
  it.each([
    [".", root, ROOT],
    ["./kofi", kofi, KOFI],
  ])("%s exports exactly its API", (_path, mod, names) => {
    expect(Object.keys(mod).sort()).toEqual([...names].sort());
  });

  it("maps every subpath in package.json and has no runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(Object.keys(pkg.exports)).toEqual([".", "./kofi", "./package.json"]);
    expect(pkg.dependencies).toBeUndefined();
    expect(Object.keys(pkg.peerDependencies)).toEqual(["zod"]);
  });
});

describe("src", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
    );

  it.each(files("src"))("%s is browser-safe, headed and under 250 lines", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/from "node:|require\(|process\.|Buffer\b/);
    expect(source).not.toMatch(/—/);
    expect(source.startsWith(`/**\n * @file ${file}\n`)).toBe(true);
    expect(source.split("\n").length).toBeLessThan(250);
  });

  it("only imports zod and its own files", () => {
    for (const file of files("src")) {
      for (const [, spec] of readFileSync(file, "utf8").matchAll(/from "([^"]+)"/g)) {
        expect(spec === "zod" || spec?.startsWith(".")).toBe(true);
      }
    }
  });
});
