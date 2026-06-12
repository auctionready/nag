/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  // Tuning for the EAS Update runtimeVersion fingerprint policy
  // (`runtimeVersion: { policy: "fingerprint" }` in app.config.ts). EAS reads
  // this file both server-side at build time and at `eas update` time, so the
  // skips below apply consistently to every computation.
  //
  // PackageJsonAndroidAndIosScriptsIfNotContainRun is the upstream default skip —
  // keep it, since passing sourceSkips here replaces the default rather than
  // merging.
  //
  // Rule of thumb for what belongs here: only inputs that change the JS<->native
  // compatibility contract should move the runtimeVersion. Things that don't are
  // skipped below so they can't force a spurious rebuild:
  //   - GitIgnore: .gitignore never affects native code.
  //   - ExpoConfigExtraSection: app.config.ts feeds env vars into `extra`
  //     (apiBaseUrl from NAG_API_BASE_URL, clerkPublishableKey from
  //     EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY). Those are JS-runtime config, not a
  //     native-compatibility input, AND they differ between where the fingerprint
  //     is computed locally / in CI and where EAS recomputes it server-side after
  //     applying the profile's hosted env. Hashing `extra` therefore made the
  //     same build produce two different runtimeVersions ("Runtime version
  //     calculated on local machine not equal to runtime version calculated
  //     during build"). Skipping the section drops that env-dependent input so
  //     the hash is identical regardless of which env happens to be set. The
  //     only other thing in `extra` is the constant `eas.projectId`, which never
  //     varies, so excluding the whole section costs no real signal.
  sourceSkips: [
    "PackageJsonAndroidAndIosScriptsIfNotContainRun",
    "GitIgnore",
    "ExpoConfigExtraSection",
  ],
  ignorePaths: [
    // eas.json is CI/submit config (appleId, ascAppId, autoIncrement, node,
    // channel). Its only native-relevant part — APP_VARIANT -> bundle id —
    // already flows through expoConfig. Safe to skip unless a config plugin
    // starts baking an eas.json profile env var into native config at prebuild.
    "eas.json",
  ],
};
