/**
 * Dev-only entry point — exposes the dev-auth bootstrap path that
 * mints HMAC device tokens via the backend's DEBUG-only `/dev/token`
 * endpoint. Kept off the main `@nag/core` index so that release
 * bundles for app consumers don't pull `ensureDevAuthRegistered` (or
 * its `/dev/token`-shaped error messages) in just because some other
 * production code imports from `@nag/core`.
 *
 * App code must reach for this via `@nag/core/dev` from inside an
 * `if (__DEV__) { require(...) }` (or equivalent statically-dead)
 * block — see `app/src/infrastructure/init.ts` for the working
 * pattern.
 */
export {
  ensureDevAuthRegistered,
  type EnsureDevAuthRegisteredOptions,
  type EnsureDevAuthRegisteredResult,
} from "./identity/devAuth";
