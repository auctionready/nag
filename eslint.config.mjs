import reactHooks from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";

// Dedicated, minimal ESLint pass for the React Hooks / React Compiler rules
// that oxlint does not cover.
//
// oxlint (oxlint.config.js) is the primary linter, but the Expo oxlint preset
// only enforces `react/rules-of-hooks` and turns `exhaustive-deps` off — it has
// none of the React Compiler rules (set-state-in-effect, refs, purity,
// immutability, etc.). Those live in eslint-plugin-react-hooks v7
// (`recommended-latest`), which oxlint cannot run (the rules need ESLint's
// Babel/parser services). We keep the React Compiler itself disabled — this
// only restores the lint rules that flag Rules-of-React violations.
//
// `rules-of-hooks` is intentionally turned off here because oxlint already
// owns it, avoiding duplicate diagnostics. No other rules are enabled, so this
// pass never overlaps with oxlint's ruleset.
export default [
  {
    // React only lives in `app`; the `packages/*` (core algorithms, drizzle
    // schema, api client) are non-React, so these rules don't apply there.
    files: ["app/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs["recommended-latest"].rules,
      // Owned by oxlint (oxlint-config-universe/native).
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/.expo/",
      "**/drizzle/",
      "app/expo-env.d.ts",
      "infra/",
      "infra-bootstrap/",
      "blog/",
    ],
  },
];
