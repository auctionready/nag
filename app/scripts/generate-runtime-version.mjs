// Computes the native runtime fingerprint with @expo/fingerprint and writes it
// to fingerprint.generated.json (gitignored). app.config.ts reads that file and
// pins `runtimeVersion` to the hash.
//
// Run this BEFORE `eas build` / `eas update` so build-time and update-time
// runtimeVersions are byte-identical. Replacing the inline
// `runtimeVersion: { policy: "fingerprint" }` (which EAS recomputes on its own
// servers at build time and again locally at update time) with a single
// pre-computed value removes that recompute drift. See docs/eas-update.md.
//
// Tuning of what counts as a native change lives in fingerprint.config.cjs
// (ignorePaths / sourceSkips), not here.
import { createFingerprintAsync } from "@expo/fingerprint";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(appRoot, "fingerprint.generated.json");

// iOS-only app (see app.config.ts `platforms`). APP_VARIANT changes native
// config (bundle id), so it legitimately moves the fingerprint — capture it for
// traceability and so each variant gets its own runtime version.
const platforms = ["ios"];
const appVariant = process.env.APP_VARIANT ?? "production";

const { hash, sources } = await createFingerprintAsync(appRoot, { platforms });

writeFileSync(
  outFile,
  `${JSON.stringify({ runtimeVersion: hash, platforms, appVariant, sourceCount: sources.length }, null, 2)}\n`,
);

console.log(
  `runtimeVersion ${hash} (${sources.length} sources, APP_VARIANT=${appVariant})`,
);
