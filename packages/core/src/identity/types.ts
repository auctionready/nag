/**
 * Result of a single `POST /devices/register` attempt. Mirrors `PostResult`
 * from sync — same transient/non-retriable split — so the app can translate
 * axios/Zodios errors into one shape regardless of which call failed.
 */
export type RegisterDeviceResult =
  | { ok: true; accountId: string; registeredAt: Date }
  | { ok: false; kind: "non-retriable"; status: number; message: string }
  | { ok: false; kind: "transient"; message: string };

export type RegisterDeviceFn = (request: {
  deviceId: string;
}) => Promise<RegisterDeviceResult>;
