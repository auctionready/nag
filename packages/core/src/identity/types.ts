import type { RegisterDeviceResult } from "@nag/api-client";

/**
 * Re-exported from `@nag/api-client` so consumers can keep importing from
 * `@nag/core`. The shape lives next to the HTTP wrapper that produces it.
 */
export type { RegisterDeviceResult };

export type RegisterDeviceFn = (request: {
  deviceId: string;
}) => Promise<RegisterDeviceResult>;

/**
 * Result of fetching a dev-auth device token from the backend's
 * `GET /dev/token` endpoint (DEBUG-only, used by SwaggerDevAuth and
 * mirrored by the Expo app's dev-auth mode). The endpoint mints an
 * HMAC device token for a fixed account/device GUID pair, so unlike
 * `RegisterDevice` the deviceId is server-supplied — the local
 * identity row is overwritten to match.
 */
export type DevTokenResult =
  | {
      ok: true;
      accountId: string;
      deviceId: string;
      deviceToken: string;
    }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

export type FetchDevTokenFn = () => Promise<DevTokenResult>;
