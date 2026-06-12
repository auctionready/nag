# Deploy readiness: dev/prod split + iOS TestFlight (internal)

## Goal

Stand up a proper **dev** and **prod** backend environment, then ship the iOS
app to **internal TestFlight** so a small group of testers can use the prod
backend end-to-end.

Today there's a single `prod` Pulumi stack at `nagapi.auctionready.co.nz` (AWS
Lambda + Neon + API Gateway), but it's being used as dev/test — it points at a
dev Clerk instance (`feasible-lynx-68.clerk.accounts.dev`) and its Neon DB has
test data.

The split is:

- New `dev` Pulumi stack at **`nagapi-dev.auctionready.co.nz`** → reuses the
  **existing** Neon project + **existing** dev Clerk. Day-to-day environment
  for the team.
- Existing `prod` Pulumi stack stays at **`nagapi.auctionready.co.nz`** but
  gets a **new** Neon project, a **new** production Clerk instance, and a
  rotated `deviceTokenSecret`. TestFlight points at this.

Full App Store submission (Beta App Review, external testers, Android) is
**out of scope** for this round.

---

## Part A — Stand up the `dev` stack (reuses existing DB + Clerk)

**Critical files:**

- `infra/Pulumi.yaml`
- `infra/src/database.ts` — currently provisions Neon project; needs a
  "reference existing" path
- `infra/src/domain.ts` — derives subdomain from stack
- `infra/Pulumi.prod.yaml` — copy as template for new `Pulumi.dev.yaml`

**Tasks:**

1. **Decouple Neon project ownership.** Today `infra/src/database.ts`
   provisions a Neon project as part of the stack. To let two stacks point at
   the same Neon project, pick one:
   - Make Neon project creation conditional on a stack config flag (e.g.
     `nag:neonProjectId` — if set, look up; if unset, create). Dev stack sets
     it to the existing project ID; prod stack leaves it unset and provisions
     fresh. **Preferred.**
   - Alternative: `pulumi import` the existing Neon project into the new
     `dev` stack and `pulumi state delete` it from `prod`. More disruptive.
2. **Create `infra/Pulumi.dev.yaml`** mirroring `Pulumi.prod.yaml` with
   overrides:
   - `nag:domainName: nagapi-dev.auctionready.co.nz`
   - `nag:clerkIssuer: https://feasible-lynx-68.clerk.accounts.dev` (existing
     dev value)
   - `nag:neonProjectId: <existing project id>` (from chosen approach above)
   - `nag:sentryEnvironment: dev`
   - `nag:sentryDsn`: same as prod (or a separate dev DSN — preferred so
     events don't co-mingle)
   - `nag:deviceTokenSecret`: generate a new one for dev with
     `pulumi config set --secret`
   - Lambda memory can drop to ~512 MB to save cost
3. **Verify domain wiring** in `infra/src/domain.ts` reads `domainName` from
   config (not hardcoded) and that the Route 53 hosted zone
   `auctionready.co.nz` already exists — it does (used by prod).
4. **`pulumi stack init dev`** in `infra/`, set config above, run
   **`pulumi up --stack dev`** manually first time.
5. **Add a `Deploy backend (dev)` GitHub Actions workflow** — either
   parameterize `.github/workflows/deploy-backend.yml` with a `stack` input
   (`dev`|`prod`), or copy it. Both need `AWS_DEPLOY_ROLE_ARN` and
   `PULUMI_ACCESS_TOKEN`. The OIDC trust policy in `infra-bootstrap`
   currently restricts the role to environment `prod`; **extend it to also
   allow environment `dev`**.
6. **Smoke test:** `curl -sf https://nagapi-dev.auctionready.co.nz/health`
   returns 200; CloudWatch shows clean cold start.

---

## Part B — Promote the existing `prod` stack to real prod

**Critical files:**

- `infra/Pulumi.prod.yaml`
- `backend/scripts/apply-db-migrations.sh`

**Tasks:**

1. **Create a production Clerk instance** in the Clerk dashboard (separate
   from `feasible-lynx-68`); capture issuer URL.
2. **Update prod stack config:**
   - `nag:clerkIssuer`: production Clerk issuer URL
     (`pulumi config set --stack prod`)
   - `nag:neonProjectId`: leave **unset** so prod provisions a fresh Neon
     project (per Part A.1)
   - `nag:deviceTokenSecret`: rotate (`openssl rand -base64 48`)
   - `nag:sentryEnvironment: prod` (verify)
3. **Provision the new prod Neon project:** `pulumi up --stack prod` will
   create it (since dev now owns the old one). Migrations resource
   (`infra/src/migrations.ts`) automatically applies the Marten schema to the
   new empty DB.
4. **Smoke-test prod** via `curl` + Sentry release event + CloudWatch logs
   (same checks as Part A).
5. **Verify** that `nagapi.auctionready.co.nz` still resolves and points to
   the (newly redeployed) prod Lambda.

---

## Part C — iOS app: get a build into TestFlight (internal)

**Critical files:**

- `app/app.config.ts` — bundle id, permissions, icons, version
- `app/eas.json` — build & submit profiles
- `app/src/infrastructure/apiClient.ts` — API base URL
- `.github/workflows/eas-build.yml` — EAS build CI (no production path today)

**Tasks:**

### C1. Wire backend URLs into builds per variant

- `app.config.ts:76` reads `NAG_API_BASE_URL` from env; map it per EAS
  profile in `eas.json`:
  - `production.env.NAG_API_BASE_URL = https://nagapi.auctionready.co.nz`
  - `preview.env.NAG_API_BASE_URL = https://nagapi-dev.auctionready.co.nz`
  - `development` already runs against local dev server — leave as is.
- Similarly set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` per profile: production
  Clerk key for `production`, dev key for `preview`/`development`.

### C2. Fill in EAS submit credentials

`app/eas.json:32-38` `submit.production.ios`:

- `appleId`: replace `"alan@"` placeholder with the real Apple ID email.
- `ascAppId`: replace `"your_app_id"` with the numeric ASC app ID (created in
  C3).
- `appleTeamId` (`QNWX2YN6C5`): confirm it matches the team that owns the ASC
  app.

### C3. Create the App Store Connect app record

- ASC → New App → Platform iOS → Bundle ID `com.auctionready.nag.app`
  (matches production variant in `app.config.ts:6-9`) → SKU.
- Copy the numeric **App ID** back into `eas.json` (C2).
- TestFlight tab → Internal Testing → add internal testers (must already be
  in the Apple Developer team).

### C4. Declare permission usage strings (Info.plist)

`app.config.ts:36-39` only sets `ITSAppUsesNonExemptEncryption=false`. Audit
`app/src` for permission APIs (`expo-camera`, `expo-image-picker`,
`expo-location`, `expo-contacts`, `expo-tracking-transparency`, etc.) and for
each that's actually used, add a matching `NS*UsageDescription` to
`ios.infoPlist`. Apple rejects uploads when a linked permission API is
missing its usage string. `expo-notifications` does not need a usage string.

### C5. Add a production iOS build + submit path

Extend `.github/workflows/eas-build.yml`:

- Add `production` to the `environment` input.
- Final step: `eas submit --platform ios --profile production --non-interactive`.
- Requires `EXPO_TOKEN` (already used for existing builds) and an EAS-stored
  App Store Connect API key (configured once via `eas credentials`).
- Acceptable shortcut for first cut: run
  `eas build --platform ios --profile production --auto-submit` from a
  laptop; wire CI after.

### C6. Sanity checks before submitting

- `app.config.ts:22` version `1.0.0` is fine for TestFlight;
  `eas.json:30` `autoIncrement: true` handles build number.
- `app/assets/icon.png` must be 1024×1024 with no alpha — verify.
- Run the app locally against `nagapi.auctionready.co.nz` with the
  **production Clerk key** to confirm device-pair + token refresh works
  end-to-end.

### C7. Submit and invite

- Trigger production build → EAS submits → wait for ASC processing
  (~10–30 min) → build appears under TestFlight → Internal Testing group →
  testers get invite emails.

**Explicitly deferred (NOT in scope):**

- External TestFlight / Beta App Review (privacy policy URL, test notes,
  login info)
- Full App Store submission (screenshots, marketing copy, age rating,
  data-collection disclosures)
- Android / Google Play (keystore, FCM, `platforms: ["ios"]` → add
  `"android"`, separate submit profile)
- Universal links / AASA
- Remote push notifications (APNs key, server-side push)
- Privacy policy / terms of service pages
- CloudWatch alarms, on-call runbook, CHANGELOG/RELEASING.md

---

## Verification

**Dev backend:**

- `curl -sf https://nagapi-dev.auctionready.co.nz/health` → 200.
- New device pairs successfully against dev Clerk.
- Sentry events tagged `environment=dev`.
- DB writes land in the same Neon project the team has been using.

**Prod backend:**

- `curl -sf https://nagapi.auctionready.co.nz/health` → 200.
- New device pairs against the **production** Clerk instance (not
  `feasible-lynx-68`).
- CloudWatch `/aws/lambda/nag-api` shows clean cold start with new Neon DB;
  `applyMigrations` resource ran without errors.
- Sentry release event tagged `environment=prod`.

**iOS / TestFlight:**

- `eas build --platform ios --profile production` finishes green.
- `eas submit` reports "Submitted to App Store Connect".
- ASC shows build under TestFlight → Internal Testing, no "Missing
  Compliance".
- Internal tester installs from TestFlight, signs in via prod Clerk,
  completes device pairing, schedules a check-in, notification fires.
- Sentry receives an iOS event tagged with the prod build's release.

## Rollback

- Backend: `pulumi stack history --stack <stack>` → redeploy previous Lambda
  zip. Migrations are forward-only; DB rollback would be manual.
- iOS: expire the TestFlight build in ASC; testers fall back to the previous
  internal build (or uninstall).
