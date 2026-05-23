import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSentryExpoConfig } from "@sentry/react-native/metro.js";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getSentryExpoConfig(projectRoot);

// Only watch app/**, packages/**, and the root node_modules (for resolution).
// Expo auto-includes every pnpm workspace (backend/, individual packages/*) —
// strip those and replace with the packages/ parent so we have one watch root.
const allowedWatchRoots = new Set([
  projectRoot,
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(monorepoRoot, "packages"),
]);
config.watchFolders = [
  ...new Set([
    ...(config.watchFolders ?? []).filter((p) => allowedWatchRoots.has(p)),
    ...allowedWatchRoots,
  ]),
];

// Resolve modules from both app and monorepo node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Resolve package.json "exports" fields (needed for ESM packages like @nag/schema)
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["import", "require"];

// Allow importing .sql files for Drizzle migrations (inlined by babel-plugin-inline-import)
config.resolver.sourceExts.push("sql");

export default config;
