// Which sign-in providers to surface in the UI. Baked at build time from
// EXPO_PUBLIC_SIGNIN_PROVIDERS (CSV; e.g. "email,apple,google,phone").
// When the env var is unset (local dev) we show everything; production
// builds set this to just "email" so testers can't tap providers that
// aren't fully configured against the prod Clerk instance.

const ALL_PROVIDERS = ["apple", "google", "email", "phone"] as const;
export type Provider = (typeof ALL_PROVIDERS)[number];

export const enabledProviders: ReadonlySet<Provider> = (() => {
  const raw = process.env.EXPO_PUBLIC_SIGNIN_PROVIDERS;
  if (!raw) return new Set(ALL_PROVIDERS);
  return new Set(
    raw
      .split(",")
      .map((v) => v.trim())
      .filter((v): v is Provider =>
        (ALL_PROVIDERS as readonly string[]).includes(v),
      ),
  );
})();
