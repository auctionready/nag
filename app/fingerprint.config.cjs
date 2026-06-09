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
  sourceSkips: [
    "PackageJsonAndroidAndIosScriptsIfNotContainRun",
    "ExpoConfigRuntimeVersionIfString",
  ],
  // The generated file is an OUTPUT of fingerprinting, never an input.
  ignorePaths: ["fingerprint.generated.json"],
};
