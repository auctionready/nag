const path = require("node:path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getSentryExpoConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Resolve modules from both app and monorepo node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Enable symlink support for pnpm
config.resolver.unstable_enableSymlinks = true;

// Resolve package.json "exports" fields (needed for ESM packages like @nag/schema)
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["import", "require"];

// Allow importing .sql files for Drizzle migrations (inlined by babel-plugin-inline-import)
config.resolver.sourceExts.push("sql");

module.exports = config;
