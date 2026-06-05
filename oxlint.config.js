import { defineConfig } from "oxlint";
import native from "oxlint-config-universe/native";

// `oxlint-config-universe/native` is the oxlint equivalent of the Expo
// (eslint-config-expo -> eslint-config-universe) preset: core + typescript +
// react/rules-of-hooks rules tuned for React Native / Expo. Formatting rules
// are intentionally omitted — oxfmt handles those (see .oxfmtrc.json).
export default defineConfig({
  extends: [native],
  // Local JS plugin (ESLint-compatible rule API) — see tools/oxlint-rules/.
  jsPlugins: ["./tools/oxlint-rules/index.js"],
  rules: {
    // Zod convention: same name for schema + inferred type.
    "typescript/no-redeclare": "off",
    // Braces on single-statement ifs are not enforced here (team preference).
    curly: "off",
    // Allow `void somePromise();` as a statement to mark an intentionally
    // un-awaited (fire-and-forget) promise; still flag `void` inside
    // expressions, which is almost always a mistake.
    "no-void": ["warn", { allowAsStatement: true }],
    // Catch fresh-each-render values (Date, {}, [], conditional-with-call)
    // passed to useLiveQuery deps. exhaustive-deps can't help here because
    // useLiveQuery's first arg is a query object rather than a callback,
    // so the analyzer can't introspect what the deps need to cover.
    "nag/no-unstable-live-query-deps": "warn",
  },
  ignorePatterns: [
    "**/node_modules/",
    "**/dist/",
    "**/.expo/",
    "**/drizzle/",
    "app/expo-env.d.ts",
    "infra/",
    "infra-bootstrap/",
    "blog/",
  ],
});
