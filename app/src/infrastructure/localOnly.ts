// Build-time flag: when `EXPO_PUBLIC_LOCAL_ONLY` is "true" the app runs
// entirely on-device — no sign-in, no account, no backend sync, no Clerk.
// Production App Store builds set this (see eas.json) so the shipped binary
// is local-only and captures no data; dev/preview leave it unset to exercise
// the account + sync paths.
//
// `EXPO_PUBLIC_`-prefixed vars are inlined by Metro at bundle time, so this
// folds to a constant in the production bundle (dead account/sync branches
// are tree-shaken where the check guards an import).
export const isLocalOnly = (): boolean =>
  process.env.EXPO_PUBLIC_LOCAL_ONLY === "true";
