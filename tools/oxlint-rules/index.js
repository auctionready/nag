import { rule as noUnstableLiveQueryDeps } from "./no-unstable-live-query-deps.js";

// oxlint loads this as a JS plugin (`jsPlugins` in oxlint.config.js). The
// plugin name (`meta.name`) is the rule namespace, so rules are referenced as
// `nag/<rule>`. The rule objects use the ESLint-compatible rule API that
// oxlint's JS plugin runtime supports.
export default {
  meta: { name: "nag" },
  rules: {
    "no-unstable-live-query-deps": noUnstableLiveQueryDeps,
  },
};
