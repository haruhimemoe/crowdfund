/**
 * @file scripts/check-consumer.mjs
 * @desc Installs the packed package with a given zod version into a throwaway project, then
 *       typechecks a consumer strictly (no skipLibCheck, so broken .d.ts can't hide as `any`) and
 *       runs it. Proves the zod peer range's floor. Usage: node scripts/check-consumer.mjs <zod
 *       version> (after `bun run build`). Needs the npm registry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const zod = process.argv[2];
if (!zod) throw new Error("usage: node scripts/check-consumer.mjs <zod version>");
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dir = mkdtempSync(path.join(tmpdir(), "crowdfund-consumer-"));
const run = (command, args, cwd = dir) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

try {
  const tarball = run("npm", ["pack", "--silent", "--pack-destination", dir], root).trim();
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module", private: true }));
  run("npm", [
    "install",
    "--silent",
    "--no-audit",
    "--no-fund",
    path.join(dir, tarball),
    `zod@${zod}`,
  ]);
  writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        exactOptionalPropertyTypes: true,
        noEmit: true,
        skipLibCheck: false,
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "ES2023",
        lib: ["ES2023", "DOM"],
        types: [],
      },
      files: ["consumer.ts"],
    }),
  );
  writeFileSync(
    path.join(dir, "consumer.ts"),
    `import { z } from "zod";
import { type CrowdfundErrorCode, type Donation, donationSchema, goalProgress, type GoalProgress, topDonors } from "@haruhimemoe/crowdfund";
import { kofiToDonation, parseKofiBody, verifyKofiToken } from "@haruhimemoe/crowdfund/kofi";

const stored = donationSchema.extend({ editionId: z.string() });
type Stored = z.infer<typeof stored>;
const body = new URLSearchParams({ data: JSON.stringify({
  verification_token: "t", message_id: "m", timestamp: "2026-04-23T12:00:00Z", type: "Donation",
  is_public: false, from_name: "a", amount: "5.00", url: "https://ko-fi.com/", currency: "USD",
  kofi_transaction_id: "x", is_subscription_payment: false, is_first_subscription_payment: false,
}) }).toString();
const payload = parseKofiBody(body);
if (!verifyKofiToken(payload.verification_token, "t")) throw new Error("token");
const donation: Donation | null = kofiToDonation(payload, { id: "d1" });
if (!donation) throw new Error("mapping");
const value: Stored = { ...donation, editionId: "e1" };
if (!stored.safeParse(value).success) throw new Error("extend");
const progress: GoalProgress = goalProgress({ id: "g", label: "g", description: null, amount: 1000, currency: "USD" }, [donation]);
if (progress.raised !== 500) throw new Error("progress");
if (topDonors([donation], { currency: "USD" })[0]?.donorName !== "Anonymous") throw new Error("anonymity");
// @ts-expect-error an unknown code must not typecheck (it would if types were any)
const bad: CrowdfundErrorCode = "nonsense";
void bad;
console.log("consumer: ok");
`,
  );
  run(path.join(root, "node_modules", ".bin", "tsc"), ["-p", dir]);
  run(process.execPath, ["--experimental-strip-types", "--no-warnings", "consumer.ts"]);
  console.log(`zod ${zod}: ok`);
} catch (error) {
  console.error(`zod ${zod}: FAILED\n${error.stdout ?? ""}${error.stderr ?? error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
