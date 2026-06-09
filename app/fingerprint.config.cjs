/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  // Skip the runtimeVersion field itself. app.config.ts reads the computed hash
  // back out of fingerprint.generated.json and pins it as a string
  // runtimeVersion; without this skip that value would feed into its own hash
  // (the separate-script indirection would be circular / unstable). With it, the
  // hash is identical whether or not the file exists yet.
  //
  // PackageJsonAndroidAndIosScriptsIfNotContainRun is the upstream default skip —
  // keep it, since passing sourceSkips here replaces the default rather than
  // merging.
  //
  // Rule of thumb for what belongs here: only inputs that change the JS<->native
  // compatibility contract should move the runtimeVersion. Things that don't are
  // skipped below so they can't force a spurious rebuild:
  //   - GitIgnore: .gitignore never affects native code.
  sourceSkips: [
    "PackageJsonAndroidAndIosScriptsIfNotContainRun",
    "ExpoConfigRuntimeVersionIfString",
    "GitIgnore",
  ],
  ignorePaths: [
    // The generated file is an OUTPUT of fingerprinting, never an input.
    "fingerprint.generated.json",
    // eas.json is CI/submit config (appleId, ascAppId, autoIncrement, node,
    // channel). Its only native-relevant part — APP_VARIANT -> bundle id —
    // already flows through expoConfig. Safe to skip unless a config plugin
    // starts baking an eas.json profile env var into native config at prebuild.
    "eas.json",
  ],
};
