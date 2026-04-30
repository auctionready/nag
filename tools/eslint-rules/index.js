import { rule as noUnstableLiveQueryDeps } from "./no-unstable-live-query-deps.js";

export default {
  meta: { name: "nag-eslint-rules" },
  rules: {
    "no-unstable-live-query-deps": noUnstableLiveQueryDeps,
  },
};
