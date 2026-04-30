import expoConfig from "eslint-config-expo/flat.js";
import prettierConfig from "eslint-config-prettier";
import reactCompiler from "eslint-plugin-react-compiler";

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
    rules: {
      // Zod convention: same name for schema + inferred type
      "@typescript-eslint/no-redeclare": "off",
      // Catch missing/stale deps in drizzle's useLiveQuery the same way
      // exhaustive-deps catches them in useEffect/useMemo.
      "react-hooks/exhaustive-deps": [
        "warn",
        { additionalHooks: "(useLiveQuery)" },
      ],
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
    ],
  },
  prettierConfig,
];
