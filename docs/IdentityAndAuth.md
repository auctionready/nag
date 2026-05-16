# Identity, Auth, and Account Lifecycle

This doc covers everything authentication-related in the Nag stack —
the on-wire token shapes the server accepts, how each token is
verified, how tenant scoping falls out of the verified claims, and the
account-lifecycle flows that move a device between auth states.

Two halves:

1. **[How a request gets authenticated](#how-a-request-gets-authenticated)** —
   token shapes, the authentication handler, device HMAC + Clerk JWT
   verification, tenant resolution, token refresh, dev-auth bypass.
2. **[Account lifecycle flows](#account-lifecycle-flows)** — sign-in,
   sign-out, switching providers, disconnect-from-cloud, multi-device,
   delete account. Sequence diagram per flow.

If you're hunting for the implementation:

- **Server auth:** `backend/Nag.Api/Auth/NagAuthenticationHandler.cs` +
  `DeviceTokenService.cs` + `ClerkTokenVerifier.cs` +
  `DeviceAccountResolver.cs`.
- **Server registration:**
  `backend/Nag.Api/Configuration/AuthenticationExtensions.cs` (wires the
  scheme + verifiers + the memory cache) and
  `MartenExtensions.cs#AddMartenTenancyDetection` (links the
  `account_id` claim to Marten's conjoined tenancy).
- **Server endpoints:** `backend/Nag.Api/Endpoints/DevicesEndpoints.cs`
  - `AccountsEndpoints.cs`.
- **App-side orchestration:** `app/src/components/account/SignedInOrOut.tsx`
  - `app/src/components/account/conflictResolution.ts`.
- **Core helpers:** `packages/core/src/identity/identity.ts` —
  `ensureDeviceRegistered`, `refreshDeviceToken`, `clearLocalAuth`,
  `resetLocalAccount`, `disconnectFromCloud`, `switchLocalAccount`.
- **Token storage on device:** `app/src/infrastructure/tokenStore.ts`
  (Keychain on iOS / EncryptedSharedPreferences on Android via
  `expo-secure-store`) and `app/src/infrastructure/clerk.ts` (Clerk
  token cache).

# How a request gets authenticated

Every authenticated request carries `Authorization: Bearer <token>`.
The server's single ASP.NET Core authentication scheme inspects the
token shape, dispatches to one of two validators, and produces a
`ClaimsPrincipal` with an `account_id` claim that downstream code
(authorization, Marten tenancy, endpoint handlers) keys off.

## Token shapes

Two token types are accepted. They're disambiguated by dot count, not
by a prefix, so the wire is compact and the client doesn't have to
declare its auth method.

| Tokens          | Dots | Wire format                          | Issued by                                                                          | Validated by                     |
| --------------- | ---- | ------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------- |
| **Device HMAC** | 1    | `base64url(payload).base64url(hmac)` | the Nag server itself, on every successful `/devices/register` and `/devices/pair` | `DeviceTokenService.Validate`    |
| **Clerk JWT**   | 2    | `header.payload.signature`           | Clerk (the IdP), as a session token issued to the mobile client                    | `ClerkTokenVerifier.VerifyAsync` |

`NagAuthenticationHandler.HandleAuthenticateAsync` reads the header,
strips the `Bearer ` prefix, counts dots, and dispatches. Anything
else 401s with `"token format not recognized"`. See
[`NagAuthenticationHandler.cs`](../backend/Nag.Api/Auth/NagAuthenticationHandler.cs#L41-L46).

## Device HMAC token

The post-pairing credential — every authenticated mobile request to
the API uses this, after the initial register/pair handshake.

**Payload (40 bytes, fixed):**

```
deviceId    : 16 bytes  (UUID, big-endian)
accountId   : 16 bytes  (UUID, big-endian)
expiryUnix  :  8 bytes  (int64, big-endian, seconds since epoch)
```

**Signature:** `HMACSHA256(secret, payload)` → 32 bytes.

**Wire:** `base64url(payload) "." base64url(mac)` — one dot. Big-endian
GUIDs were a deliberate choice for cross-platform stability
([`DeviceTokenService.cs`](../backend/Nag.Api/Auth/DeviceTokenService.cs#L86-L92)).

**Lifetime:** configured via `Nag:DeviceToken:Lifetime`. The token
expires; the client refreshes on 401 — see
[Token refresh on 401](#token-refresh-on-401).

**Secret rotation:** the HMAC secret comes from
`Nag:DeviceToken:Secret` (env `DEVICE_TOKEN_SECRET`). Rotating it
invalidates every issued token simultaneously and forces every device
through the refresh flow. There's no cross-secret grace period — the
refresh path on the client treats secret rotation and individual
expiry identically.

**Validation steps** ([`DeviceTokenService.Validate`](../backend/Nag.Api/Auth/DeviceTokenService.cs#L45-L82)):

1. Parse the dot-split shape; reject anything malformed.
2. Length-check both halves (40 + 32 bytes).
3. Recompute HMAC over the payload and compare in constant time
   (`CryptographicOperations.FixedTimeEquals`) so a forged MAC can't
   leak timing.
4. Decode `expiryUnix`; reject if `<= now`.

On success the handler builds a `ClaimsIdentity` with:

| Claim                                      | Value                                                            |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `NagClaimTypes.AccountId` (`account_id`)   | the decoded accountId, formatted `D` (lowercase hex with dashes) |
| `NagClaimTypes.DeviceId` (`device_id`)     | the decoded deviceId, same format                                |
| `NagClaimTypes.AuthMethod` (`auth_method`) | `"device"`                                                       |

**Live-account check.** After a successful HMAC validation the handler
calls `IDeviceAccountResolver.AccountExists(accountId)` and fails the
authentication if the row is gone. Without this, an out-of-band
`DELETE /accounts/me` would leave the token authenticating against an
orphan tenant id and the dispatcher would happily append events under
that dead tenant. The resolver caches the boolean for 5 minutes, and
the delete endpoints (`/accounts/me`, `/devices/me`) explicitly call
`InvalidateAccount` after the cascade so the next request after
delete fails fast.

## Clerk JWT

Used only on the pre-pairing endpoints: `POST /accounts/me/identity`
(in some places — also accepts device tokens), `POST /devices/pair`,
`DELETE /accounts/by-clerk-identity`. The mobile client gets it from
the Clerk SDK (`getToken()`).

**Validation** ([`ClerkTokenVerifier.cs`](../backend/Nag.Api/Auth/ClerkTokenVerifier.cs)):

- Pulls Clerk's JWKS from `{ClerkIssuer}/.well-known/openid-configuration`
  via `Microsoft.IdentityModel.Protocols.OpenIdConnect`. The
  `IConfigurationManager<OpenIdConnectConfiguration>` is a singleton
  with built-in refresh; we don't manage the JWKS cache directly.
- A hosted `JwksWarmupService` fetches the JWKS at startup so the
  first authenticated request after a cold Lambda boot doesn't have to
  pay the ~hundreds-of-ms metadata fetch.
- `JsonWebTokenHandler.ValidateTokenAsync` checks:
  - **Issuer** must equal `Nag:ClerkIssuer` (pinning the token to our
    Clerk instance).
  - **Signing key** must be one of the JWKS keys.
  - **Lifetime** with a 2-minute clock skew tolerance.
  - **Audience** is _not_ validated — Clerk session tokens don't
    always carry an `aud`, and the issuer pin already binds the token
    to this Nag instance.
- Returns the `sub` claim (`user_xxx`) on success.

**Resolving the account.** The handler then calls
`IDeviceAccountResolver.AccountIdForSubject(sub)` which queries
`SELECT id FROM accounts WHERE idp_subject = $sub` (Marten). Result
cached for 5 minutes. `null` (no account bound) fails the
authentication with `"no account is bound to this Clerk identity"`.

On success, the handler builds the `ClaimsIdentity` with:

| Claim                                      | Value                  |
| ------------------------------------------ | ---------------------- |
| `NagClaimTypes.Subject` (`sub`)            | the Clerk subject      |
| `NagClaimTypes.AccountId` (`account_id`)   | the resolved accountId |
| `NagClaimTypes.AuthMethod` (`auth_method`) | `"clerk"`              |

Note there's **no `device_id` claim** on Clerk-authenticated requests
— it doesn't exist yet (the device-token handshake is what assigns
one). Endpoints that need a deviceId require device-token auth.

## Authorization model

Authentication is mandatory by default. In
[`AuthenticationExtensions.cs`](../backend/Nag.Api/Configuration/AuthenticationExtensions.cs):

```csharp
builder.Services.AddAuthorization(opts =>
{
    // Every endpoint requires authentication unless explicitly [AllowAnonymous].
    opts.FallbackPolicy = opts.DefaultPolicy;
});
```

So the failure mode is opt-in-only — forgetting an attribute on a new
endpoint blocks the request, doesn't leak it. The bootstrap endpoints
explicitly opt out:

| Endpoint                 | Why anonymous                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `POST /devices/register` | first contact; no token to present yet                                              |
| `POST /devices/pair`     | verifies an IdP token in the body instead — the caller has no device token          |
| `GET /health`            | liveness probe                                                                      |
| `GET /dev/token`         | local dev only; stripped from prod bundle (see [Dev-auth bypass](#dev-auth-bypass)) |

## Multi-tenancy: `account_id` → Marten

Every authenticated request carries an `account_id` claim. Marten's
conjoined tenancy is wired to read it directly:

```csharp
// MartenExtensions.cs
builder.Services.AddMartenTenancyDetection(opts =>
{
    opts.IsClaimTypeNamed(NagClaimTypes.AccountId);
});
```

The `IDocumentSession`/`IQuerySession` that gets injected into a
request handler is automatically tenanted by the caller's account.
Conjoined-tenant document types (`HomeBoard`, `CheckInState`,
`MonthlyCheckInSummary`, `WeeklyCheckInSummary`,
`HabitComplianceHistory`, `ProcessedEnvelope`) and the event store all
get a `WHERE tenant_id = $account_id` filter for free. Cross-tenant
reads are impossible by construction unless a handler explicitly opens
a `LightweightSession(tenantId)` against a different tenant (which
only happens in the cascade-delete paths, scoped to the _caller's own_
account).

A handful of endpoints don't operate on tenant-scoped data —
`/accounts/me`, `/accounts/me/identity`, `/devices/{id}`,
`/devices/me`, `/health`. These carry the `[NotTenanted]` attribute so
Marten's tenancy detection skips the claim lookup; they operate on the
single-tenant `Account` and `Device` document types (which are _how_
we find the tenant in the first place, so they can't themselves be
tenant-scoped).

## Token refresh on 401

The Zodios HTTP client wraps every request in an
`onUnauthorized` handler ([`apiClient.ts`](../app/src/infrastructure/apiClient.ts#L74-L90)):

```mermaid
sequenceDiagram
    autonumber
    participant App as App
    participant TS as tokenStore
    participant Server as Nag backend

    App->>Server: GET /home-board<br/>Bearer: device-token-X
    Server-->>App: 401 (token expired or secret rotated)
    App->>App: onUnauthorized() → refreshDeviceToken()
    App->>TS: read deviceId
    App->>Server: POST /devices/register {deviceId}
    Note over Server: idempotent on deviceId<br/>(returns same accountId, new HMAC)
    Server-->>App: 200 {accountId, deviceToken: device-token-X+1}
    App->>TS: set("device-token-X+1")
    App->>App: clearHalted() — a working credential<br/>means any earlier 4xx halt can lift
    App->>Server: GET /home-board<br/>Bearer: device-token-X+1<br/>(automatic Zodios retry)
    Server-->>App: 200
```

The refresh path reuses `/devices/register` because the endpoint is
idempotent on `deviceId` — re-registering an existing device returns
the same `accountId` paired with a freshly-signed token. If the
re-register itself fails the request gives up and propagates the 401
to the caller. There's no retry storm — Zodios only retries the
original request once after a successful refresh.

## Dev-auth bypass

For local development and the Swagger UI, a parallel `GET /dev/token`
endpoint mints a device HMAC bound to a fixed dev account+device GUID
pair (no Clerk involvement). The Swagger UI's pre-request interceptor
calls it on first request and stores the token, so "Try it out" works
without any sign-in ceremony.

**Strict prod safety:** the dev-auth endpoint and `SwaggerDevAuth`
class are compiled with `#if DEBUG` so they're stripped from the
release bundle entirely. The OpenAPI generator runs against the Debug
build (see `backend/scripts/generate-openapi.sh`), so the dev-auth
operations appear in the local spec but not in any prod-deployed
artifact.

On the mobile side `packages/core/src/identity/devAuth.ts` provides
an `ensureDevAuthRegistered` analogue of `ensureDeviceRegistered` that
hits `/dev/token` instead of going through Clerk. Wired up in
`DevAuthAccountPanel.tsx`. The whole module tree is gated by
`__DEV__` so it doesn't ship to prod either.

## Server endpoint reference

| Verb              | Path                          | Auth                             | `[NotTenanted]` | Used by                                                         |
| ----------------- | ----------------------------- | -------------------------------- | --------------- | --------------------------------------------------------------- |
| `POST`            | `/devices/register`           | anonymous                        | ✓               | First-launch register + the 401-refresh path                    |
| `POST`            | `/devices/pair`               | anonymous (IdP token in body)    | ✓               | `runReplaceLocal` (server-data branch)                          |
| `GET`             | `/devices/{id}`               | device token                     | —               | route only; not called from client                              |
| `DELETE`          | `/devices/me`                 | device token                     | ✓               | "Start a new account" branch of `runIdentityMismatch`           |
| `POST`            | `/accounts/me/identity`       | device token                     | ✓               | First-time bind + re-bind after `Switch this account`           |
| `GET`             | `/accounts/me/identity`       | device token                     | ✓               | not currently called from client                                |
| `DELETE`          | `/accounts/me/identity`       | device token                     | ✓               | `Switch this account` (unbind before re-POST)                   |
| `DELETE`          | `/accounts/by-clerk-identity` | device token + IdP token in body | ✓               | `runReplaceServer` (take-over branch)                           |
| `DELETE`          | `/accounts/me`                | device token                     | ✓               | `confirmAndDeleteAccount` + `confirmAndDisconnectFromCloud`     |
| `GET`             | `/dev/token`                  | anonymous (DEBUG only)           | ✓               | dev-auth panel + Swagger UI auto-authorize                      |
| `GET`             | `/health`                     | anonymous                        | ✓               | liveness probe                                                  |
| (everything else) | various                       | device token                     | tenanted        | normal authenticated endpoints — events, sync, home-board, etc. |

See [#212](https://github.com/auctionready/nag/issues/212) for the
proposed REST-correct reshape of the `POST /devices/*` endpoints
under `/accounts/me/devices`.

# Account lifecycle flows

The rest of this doc walks through the user-facing states a device
moves between: how it first contacts the server, how it leaves a
signed-in state in any of four different ways, and how a subsequent
sign-in finds its way back.

## Mental model

Three entities matter; pin these down before tracing any flow.

| Entity           | Lives where                                                              | Identity                                                                                        |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Device**       | one row server-side + one matching row in `identity` locally             | `deviceId` (UUID, generated locally on first launch, never changes for the life of the install) |
| **Account**      | one row server-side; mirror of its `accountId` in local `identity`       | `accountId` (UUID, generated server-side on first contact)                                      |
| **IdP identity** | Clerk-managed; the server stores it as `Account.IdpSubject` (`user_xxx`) | the `sub` claim of a verified Clerk JWT                                                         |

A device authenticates server requests with a **device HMAC token**
(`{accountId, deviceId}` signed by the server). The IdP token is only
ever used to bind/unbind identity and to pair new devices.

Two other pieces of local state matter:

- **`outbox`** — past-tense events the local app has committed but the
  server hasn't acked yet. The dispatcher ships rows where
  `status='pending'` against the current `accountId`. `'sent'` rows are
  retained for replay (`NAG_SENT_OUTBOX_RETAIN=-1` by default).
- **`sync_state.highestServerSequence`** — high-water mark for pull-sync.
  Reset to 0 when the device moves to a brand-new server account.

> **Anonymous = local only.** The server never persists an account
> without an `IdpSubject` bound to it (a brand-new
> `POST /devices/register` row is bound the same request via
> `/accounts/me/identity`). "Anonymous" in this doc always refers to a
> device with no server state at all — purely local data.

## Exits from a signed-in state

There are **four** ways to leave a signed-in state. They differ on
what they preserve.

| Exit                                                       | Server account    | Server data | Local `identity`                                                 | Local data + outbox                                                                      |
| ---------------------------------------------------------- | ----------------- | ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Soft sign-out**                                          | preserved         | preserved   | `accountId`/`idpSubject`/token cleared; `deviceId` kept          | preserved                                                                                |
| **Disconnect from cloud**                                  | deleted (cascade) | deleted     | same as soft sign-out + `sync_state.highestServerSequence` reset | **preserved**, plus all `'sent'` outbox rows reverted to `'pending'` for re-ship         |
| **Start a new account** (from the sign-in conflict prompt) | deleted (cascade) | deleted     | `accountId`/`idpSubject`/token cleared                           | **wiped** (`habit`/`goal`/`schedule`/`checkIn`/`outbox` all dropped, `sync_state` reset) |
| **Delete account**                                         | deleted (cascade) | deleted     | wiped on next launch via `resetDatabaseSchema()`                 | wiped                                                                                    |

The first three are reversible at the user level — they keep enough
state on the device to keep using the app and to eventually re-sync.
Delete account is the only one that's truly final.

## Sign-in flow on a fresh device

Anonymous local state, never contacted the server. User signs in with
Clerk for the first time. The happy path: register a server account
and bind it to the verified identity in one ceremony.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as App<br/>(SignedInOrOut)
    participant Clerk as Clerk SDK
    participant Server as Nag backend

    U->>Clerk: Sign in with Apple / Google / email
    Clerk-->>App: isSignedIn=true, user.id=apple_sub
    App->>Clerk: getToken()
    Clerk-->>App: idpToken
    App->>Server: POST /devices/register {deviceId}
    Server-->>App: 201 {accountId, deviceToken}
    App->>Server: POST /accounts/me/identity {idpToken}<br/>(Bearer: deviceToken)
    Note over Server: Account.IdpSubject is null<br/>and sub is not bound elsewhere
    Server-->>App: 201 {idpSubject, upgradedAt}
    App->>App: setIdpSubject(apple_sub)
    App->>App: kickSync("post-upgrade")
```

After this, the local `identity` row is fully populated
(`deviceId`, `accountId`, `idpSubject`), the token store has a valid
device HMAC, and the dispatcher can start shipping any locally-queued
events (e.g. habits the user created while offline).

## Soft sign-out

The default sign-out path. The server-side account stays alive, bound
to the same `IdpSubject`. The device just forgets it's signed in.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as App
    participant Local as Local SQLite + tokenStore
    participant Clerk as Clerk SDK
    participant Server as Nag backend

    U->>App: Tap "Sign out"
    App->>Local: clearLocalAuth()<br/>(null accountId/registeredAt/idpSubject,<br/>clear deviceToken)
    Note over Local: deviceId, habits, goals, outbox<br/>all preserved
    App->>Clerk: signOut()
    Note over Server: Account row untouched.<br/>Server doesn't know we signed out.
```

What's left after sign-out:

- Local: `deviceId` is preserved, replicated data is preserved, outbox
  is preserved. `accountId`/`idpSubject`/`registeredAt` are nulled and
  the device token is cleared.
- Server: nothing changes. The account row is still bound to the old
  `IdpSubject`. Other devices paired into the same account keep working.

## Sign in again — same identity

The cheapest case: same Clerk user, same device. The cold-start
short-circuit at `SignedInOrOut.tsx` line 101-112 (note: actual line
numbers may have drifted — search for `persisted.idpSubject`) skips
the upgrade round-trip once the local cache is rebuilt.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as App
    participant Server as Nag backend

    U->>App: Sign in with Apple (same as before)
    App->>Server: POST /devices/register {deviceId}
    Note over Server: deviceId already exists.<br/>Returns same accountId (idempotent).
    Server-->>App: 200 {accountId, deviceToken}
    App->>Server: POST /accounts/me/identity {idpToken: apple}
    Note over Server: Account.IdpSubject == apple_sub<br/>(same as request).
    Server-->>App: 200 {idpSubject, upgradedAt}<br/>(Content-Location set)
    App->>App: setIdpSubject(apple_sub)
```

If the local `identity.idpSubject` was already populated on cold start
and matches Clerk's `user.id`, the app skips both round trips
entirely — the device is already known to be bound to that identity.

## Sign in with a _different_ identity after sign-out

**This is the flow PR #211 fixed.** After a soft sign-out, the server
still thinks the device's account is bound to the old identity. When
the user signs in with a new identity, `POST /accounts/me/identity`
returns a 409 with the message _"account is already bound to a
different identity"_, and the client routes to `runIdentityMismatch`
with three branches.

### The fork

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as App
    participant Server as Nag backend

    U->>App: Sign in with Google<br/>(after signing out from Apple)
    App->>Server: POST /devices/register {deviceId}
    Server-->>App: 200 {accountId: <same as before>,<br/>deviceToken}
    App->>Server: POST /accounts/me/identity {idpToken: google}
    Note over Server: Account.IdpSubject == apple_sub<br/>(not google_sub).
    Server-->>App: 409 "account is already bound<br/>to a different identity"
    App->>App: runIdentityMismatch()<br/>show Alert with 3 choices
    Note over U,App: User picks Switch / Fresh / Cancel
```

### Branch 1 — _Switch this account to this login_

Re-points the device's existing account at the new identity. The
account row, its data, and any other paired devices keep working.

```mermaid
sequenceDiagram
    autonumber
    participant App as App
    participant Server as Nag backend

    App->>Server: DELETE /accounts/me/identity
    Note over Server: Account.IdpSubject = null<br/>(transient anonymous state).
    Server-->>App: 204
    App->>Server: POST /accounts/me/identity {idpToken: google}
    Note over Server: No other account claims google_sub.<br/>Bind it here.
    Server-->>App: 201 {idpSubject: google_sub}
    App->>App: setIdpSubject(google_sub)<br/>kickSync("post-switch-identity")
```

> The "transient anonymous state" in step 1 between DELETE and POST is
> the only window where the server holds an unbound account. If the
> POST fails, the next sign-in attempt with _any_ identity will succeed
> (a freshly anonymous account accepts any non-conflicting sub).

### Branch 2 — _Start a new account_

Abandons the existing account entirely. The server cascade-deletes
everything, then we re-bootstrap with a brand-new server account.
Local data is wiped — the user explicitly chose to start fresh.

```mermaid
sequenceDiagram
    autonumber
    participant App as App
    participant Local as Local SQLite + tokenStore
    participant Server as Nag backend

    App->>Server: DELETE /devices/me
    Note over Server: Unpair device.<br/>Last device → cascade-delete account,<br/>events, devices, projections.
    Server-->>App: 204
    App->>Local: resetLocalAccount()<br/>(wipe habit/goal/schedule/checkIn/outbox,<br/>reset sync_state, clear identity row)
    App->>Server: POST /devices/register {deviceId}
    Note over Server: Old device row is gone.<br/>Create new device + new account.
    Server-->>App: 201 {accountId: <new>, deviceToken: <new>}
    App->>Server: POST /accounts/me/identity {idpToken: google}
    Server-->>App: 201 {idpSubject: google_sub}
```

### Branch 3 — _Cancel_

```mermaid
sequenceDiagram
    autonumber
    participant App as App
    participant Clerk as Clerk SDK

    App->>Clerk: signOut()
    Note over App: status → idle.<br/>Server-side state unchanged.
```

## Sign in with an identity that already owns _another_ account

A different 409 from the same endpoint, with the message _"this
identity is already bound to a different account"_. Typical trigger:
the user has another device paired to that identity, and this device
is on a fresh anonymous-account install. The client routes to
`runPairFallback` (the original sign-in conflict flow, pre-dates
PR #211).

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as App
    participant Server as Nag backend

    U->>App: Sign in with Google
    App->>Server: POST /devices/register {deviceId}
    Server-->>App: 201 {accountId: A_new, deviceToken}
    App->>Server: POST /accounts/me/identity {idpToken: google}
    Note over Server: google_sub is bound to A_other<br/>(a different account on another device).
    Server-->>App: 409 "this identity is already bound<br/>to a different account"
    App->>App: runPairFallback()
    alt no local habits
        App->>App: silent: runReplaceLocal()
    else local habits exist
        App->>U: Prompt: Cancel /<br/>Use server data /<br/>Use this device's data
    end
```

### Branch — _Use server data_ (`runReplaceLocal`)

Pair this device into the existing account, wipe local replicated
tables so pull-sync rehydrates from the server snapshot.

```mermaid
sequenceDiagram
    autonumber
    participant App as App
    participant Local as Local SQLite
    participant Server as Nag backend

    App->>Server: POST /devices/pair {deviceId, idpToken}
    Note over Server: Re-parent device onto<br/>A_other (Google's existing account).
    Server-->>App: 200/201 {accountId: A_other, deviceToken: <new>}
    App->>Local: switchLocalAccount()<br/>(wipe data + outbox, set new accountId)
    App->>App: setIdpSubject(google_sub)<br/>kickSync("post-pair")
```

### Branch — _Use this device's data_ (`runReplaceServer`)

Take over the identity from A_other and bind it to this device's
account. A_other is left anonymous on the server (transient — see
Branch 1 of runIdentityMismatch for the same pattern).

```mermaid
sequenceDiagram
    autonumber
    participant App as App
    participant Server as Nag backend

    App->>Server: DELETE /accounts/by-clerk-identity {idpToken: google}
    Note over Server: Find A_other, set its<br/>IdpSubject = null.
    Server-->>App: 204
    App->>Server: POST /accounts/me/identity {idpToken: google}
    Note over Server: This device's account claims<br/>google_sub now.
    Server-->>App: 201 {idpSubject}
    App->>App: setIdpSubject(google_sub)<br/>kickSync("post-take-over")
```

## Disconnect from cloud

The "I want to go local-only without losing my data" path. The
Account-screen action above _Delete account_. Wipes the server-side
account but keeps every habit, check-in, and outbox row on the device.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as App
    participant Local as Local SQLite + tokenStore
    participant Clerk as Clerk SDK
    participant Server as Nag backend

    U->>App: Tap "Disconnect from cloud" → confirm
    App->>Server: DELETE /accounts/me
    Note over Server: Cascade: account row,<br/>devices, events, streams, projections.
    Server-->>App: 204
    App->>Local: disconnectFromCloud()
    Note over Local: Clear accountId/registeredAt/idpSubject,<br/>clear deviceToken,<br/>reset sync_state.highestServerSequence,<br/>UPDATE outbox SET status='pending'<br/>WHERE status='sent'
    Note over Local: habit, goal, schedule, checkIn:<br/>all preserved.
    App->>Clerk: clearAllClerkTokens()
```

After this the device is genuinely anonymous (no server presence)
with all data intact. The app keeps working offline; the dispatcher
no-ops because `accountId` is null.

## Reconnect after disconnect

The follow-up: user signs in again later, with the same identity or
a new one. There's no server-side account to find (we deleted it), so
`POST /devices/register` creates a fresh one. The previously-sent
outbox rows — re-marked `'pending'` during disconnect — flush into the
new account, faithfully reconstructing the user's state.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as App
    participant Local as Local SQLite
    participant Server as Nag backend

    U->>App: Sign in with Apple (or Google)
    App->>Server: POST /devices/register {deviceId}
    Note over Server: deviceId is unknown<br/>(old row was cascaded out).<br/>Create fresh device + account.
    Server-->>App: 201 {accountId: A_new, deviceToken: <new>}
    App->>Server: POST /accounts/me/identity {idpToken}
    Note over Server: A_new.IdpSubject is null<br/>and the sub is not bound elsewhere.
    Server-->>App: 201
    App->>App: setIdpSubject() · kickSync()
    loop dispatcher ticks
        App->>Local: SELECT FROM outbox WHERE status='pending'
        Local-->>App: every event (incl. previously-sent ones,<br/>re-marked at disconnect time)
        App->>Server: POST /events {envelope}
        Server-->>App: 200/201
        App->>Local: UPDATE outbox SET status='sent', server_sequence=…
    end
```

The envelope `id` of each outbox row is preserved across the
disconnect, so the re-ship hits the server's idempotency dedupe with
the same key. If the user has another (Google-bound) account
elsewhere and signs in with Google here, that's the
`runPairFallback` 409 case above — we don't end up doubling data,
the user picks server-or-device.

## Multi-device pairing

The "second device" flow. Same identity, fresh install on a new
phone. `/devices/pair` does the work — `/devices/register` would just
create a new anonymous account and we'd hit a 409 on upgrade
afterward, so the client goes to pair directly.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant Phone2 as Phone 2 (fresh install)
    participant Server as Nag backend

    U->>Phone2: First launch + sign in with Apple
    Phone2->>Server: POST /devices/register {deviceId}
    Server-->>Phone2: 201 {accountId: A_phone2_anon, deviceToken}
    Phone2->>Server: POST /accounts/me/identity {idpToken: apple}
    Note over Server: apple_sub is already bound to<br/>A_phone1 (the other device's account).
    Server-->>Phone2: 409 "this identity is already bound<br/>to a different account"
    Phone2->>Phone2: runPairFallback() · no local habits<br/>→ silent runReplaceLocal()
    Phone2->>Server: POST /devices/pair {deviceId, idpToken: apple}
    Note over Server: Source account (A_phone2_anon)<br/>is anonymous → re-parent device<br/>onto A_phone1.
    Server-->>Phone2: 200 {accountId: A_phone1, deviceToken: <new>}
    Phone2->>Phone2: switchLocalAccount(A_phone1)<br/>(wipe transient local rows)
    Phone2->>Server: GET /sync?since=0
    Server-->>Phone2: every event for A_phone1
```

The silent `runReplaceLocal` branch fires because the second device
has nothing the user would mind losing — no habits yet — so the prompt
would just be friction.

## Delete account

The hard exit. Nuke the server account, wipe local SQLite, reset the
secure-store keys. The app reloads back to a fresh first-install state.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant App as App
    participant Local as Local SQLite + tokenStore + Clerk store
    participant Clerk as Clerk SDK
    participant Server as Nag backend

    U->>App: Tap "Delete account" → confirm
    App->>Server: DELETE /accounts/me
    Server-->>App: 204
    App->>Local: tokenStore.clear()<br/>clearAllClerkTokens()<br/>resetDatabaseSchema()
    Note over App: __DEV__ → DevSettings.reload()<br/>prod → show "Account deleted" alert
```

## Sign-in conflict decision tree

When `POST /accounts/me/identity` returns 409, the server's message
field discriminates the two cases. Match on substring; the messages
are documented and stable.

```mermaid
flowchart TD
    A[POST /accounts/me/identity] --> B{Response status?}
    B -- 201/200 --> OK[Bound · setIdpSubject · kickSync]
    B -- 409 --> C{Message includes<br/>'account is already bound<br/>to a different identity'?}
    C -- yes --> D[runIdentityMismatch · prompt:<br/>Switch / Fresh / Cancel]
    C -- no --> E[Message includes<br/>'this identity is already bound<br/>to a different account']
    E --> F[runPairFallback]
    F --> G{Local habits exist?}
    G -- no --> H[silent runReplaceLocal]
    G -- yes --> I[prompt:<br/>Cancel / Use server data / Use this device's data]
    B -- other --> X[status: fail · message]
```

## Backend endpoint reference

| Verb     | Path                          | Auth                                         | Used by                                                     |
| -------- | ----------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `POST`   | `/devices/register`           | none (anonymous)                             | First-launch register + the 401-refresh path                |
| `POST`   | `/devices/pair`               | none (anonymous; verifies IdP token in body) | `runReplaceLocal` (server-data branch)                      |
| `DELETE` | `/devices/me`                 | device token                                 | "Start a new account" branch of `runIdentityMismatch`       |
| `GET`    | `/devices/{id}`               | device token                                 | route only; not called from client                          |
| `POST`   | `/accounts/me/identity`       | device token                                 | First-time bind + re-bind after `Switch this account`       |
| `GET`    | `/accounts/me/identity`       | device token                                 | not currently called from client                            |
| `DELETE` | `/accounts/me/identity`       | device token                                 | `Switch this account` (unbind before re-POST)               |
| `DELETE` | `/accounts/by-clerk-identity` | device token + IdP token in body             | `runReplaceServer` (take-over branch)                       |
| `DELETE` | `/accounts/me`                | device token                                 | `confirmAndDeleteAccount` + `confirmAndDisconnectFromCloud` |

> See [#212](https://github.com/auctionready/nag/issues/212) for the
> proposed REST-correct shape: moving the device endpoints under
> `/accounts/me/devices`. Not blocking anything but tracked.

## State summary

The local `identity` row is the durable record of "what state is this
device in". Four reachable states:

```mermaid
stateDiagram-v2
    [*] --> Fresh : first launch

    Fresh --> Signed_in : sign in (register + upgrade)
    Signed_in --> Signed_out_soft : Sign out

    Signed_out_soft --> Signed_in : sign in (same identity)
    Signed_out_soft --> Signed_in : sign in (different identity)<br/>→ Switch this account
    Signed_out_soft --> Anonymous_local : sign in → Start a new account<br/>(via DELETE /devices/me)
    Signed_out_soft --> Anonymous_local : Disconnect from cloud

    Signed_in --> Anonymous_local : Disconnect from cloud

    Anonymous_local --> Signed_in : sign in (any identity)<br/>fresh register + upgrade

    Signed_in --> [*] : Delete account
    Signed_out_soft --> [*] : Delete account<br/>(if user signs back in first)
    Anonymous_local --> [*] : Delete account<br/>(via the dev menu or a re-sign-in)
```

`Fresh` and `Anonymous_local` look the same from the device's
perspective — no `accountId`, no token, no server presence. The
difference is the presence of local data: `Anonymous_local` has habits
and an outbox carrying their history; `Fresh` is empty.
