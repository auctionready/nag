import expoConfig from "eslint-config-expo/flat.js";
import prettierConfig from "eslint-config-prettier";
import reactCompiler from "eslint-plugin-react-compiler";
import nagRules from "./tools/eslint-rules/index.js";

export default [
  ...expoConfig,
  {
    plugins: {
      "react-compiler": reactCompiler,
    },
    rules: {
      "react-compiler/react-compiler": "warn",
    },
  },
  {
    plugins: { nag: nagRules },
    rules: {
      // Zod convention: same name for schema + inferred type
      "@typescript-eslint/no-redeclare": "off",
      // Catch fresh-each-render values (Date, {}, [], conditional-with-call)
      // passed to useLiveQuery deps. exhaustive-deps can't help here because
      // useLiveQuery's first arg is a query object rather than a callback,
      // so the analyzer can't introspect what the deps need to cover.
      "nag/no-unstable-live-query-deps": "warn",
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
  prettierConfig,
];
