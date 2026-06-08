// @ts-check
/**
 * Computes a stable Expo `runtimeVersion` for OTA updates.
 *
 * Why this exists: the `fingerprint` runtime policy hashes the Expo/RN
 * autolinking inputs, which on pnpm include the virtual-store peer-dependency
 * hash (`.pnpm/<name>@<ver>_<32hex>/node_modules/...`). Any lockfile re-resolve
 * flips those hashes for ~every native package, so the fingerprint changes even
 * though nothing native actually changed — and EAS then refuses to deliver the
 * OTA update to existing builds.
 *
 * We reuse Expo's own fingerprint (so new plugins, SDK bumps, native file edits,
 * and version bumps are all still detected) but re-hash its `sources` after
 * stripping the pnpm peer-hash path segment. Result: stable across installs,
 * still correct on real native changes.
 */
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");

/**
 * Strips pnpm's volatile virtual-store peer-dependency hash from a path while
 * keeping the package's `name@version` (a version bump IS a real native change).
 *   .pnpm/expo-router@56.2.9_f4bb4364.../node_modules/expo-router/ios
 *     -> .pnpm/expo-router@56.2.9/node_modules/expo-router/ios
 *   .pnpm/@expo+ui@56.0.16_54d762f2.../node_modules/@expo/ui/ios
 *     -> .pnpm/@expo+ui@56.0.16/node_modules/@expo/ui/ios
 */
const PNPM_SEG =
  /\.pnpm\/((?:@[^/+]+\+)?[^/]+?@[0-9][^_/]*)(?:_[^/]*)?\/node_modules\//g;

/** @param {string} s */
const normalizePnpm = (s) => s.replace(PNPM_SEG, ".pnpm/$1/node_modules/");

const sha1 = (/** @type {string} */ s) =>
  crypto.createHash("sha1").update(s).digest("hex");

/**
 * Re-hash fingerprint sources after removing pnpm path churn.
 * @param {ReadonlyArray<any>} sources
 */
function normalizedHash(sources) {
  const parts = sources.map((s) => {
    const id = normalizePnpm(String(s.id ?? s.filePath ?? ""));
    let body = String(s.hash ?? "");
    if (s.contents != null) {
      const c = Buffer.isBuffer(s.contents)
        ? s.contents.toString("utf8")
        : typeof s.contents === "string"
          ? s.contents
          : JSON.stringify(s.contents);
      // contents (autolinking config) embed the same pnpm paths -> normalize too
      body = sha1(normalizePnpm(c));
    }
    return `${s.type}:${id}:${body}`;
  });
  parts.sort();
  return sha1(parts.join("\n"));
}

/**
 * @param {string} projectRoot
 * @returns {Promise<{ runtimeVersion: string, rawFingerprint: string }>}
 */
async function computeRuntimeVersionAsync(projectRoot) {
  const req = createRequire(path.join(projectRoot, "noop.js"));
  const { createFingerprintAsync } = req("@expo/fingerprint");
  const fp = await createFingerprintAsync(projectRoot);
  return {
    runtimeVersion: normalizedHash(fp.sources).slice(0, 16),
    rawFingerprint: fp.hash,
  };
}

module.exports = { computeRuntimeVersionAsync, normalizedHash, normalizePnpm };

if (require.main === module) {
  computeRuntimeVersionAsync(process.cwd())
    .then((r) => console.log(r.runtimeVersion))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
