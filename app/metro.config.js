const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

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

// Allow importing .sql files for Drizzle migrations
config.resolver.sourceExts = [...config.resolver.sourceExts, "sql"];

module.exports = config;
