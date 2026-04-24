import type { RegisterDeviceResult } from "@nag/api-client";

/**
 * Re-exported from `@nag/api-client` so consumers can keep importing from
 * `@nag/core`. The shape lives next to the HTTP wrapper that produces it.
 */
export type { RegisterDeviceResult };

export type RegisterDeviceFn = (request: {
  deviceId: string;
}) => Promise<RegisterDeviceResult>;
