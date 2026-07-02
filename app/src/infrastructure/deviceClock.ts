import { requireOptionalNativeModule } from "expo-modules-core";
import { log } from "./log";

const logger = log("deviceClock");

interface LocalizationNativeModule {
  getCalendars(): { uses24hourClock?: boolean | null }[];
}

/**
 * Whether the device is configured for a 24-hour clock.
 *
 * Read straight from the `ExpoLocalization` native module via the optional
 * getter, which returns `null` (instead of throwing) when the module isn't
 * registered. We deliberately do NOT import the `expo-localization` JS wrapper:
 * it binds its native module eagerly at import time, so a missing/unregistered
 * native module would crash app bootstrap with an uncaught
 * "Cannot find native module 'ExpoLocalization'".
 *
 * Falls back to a 12-hour clock; users can still toggle 24-hour in Appearance.
 */
export const deviceUses24HourClock = (): boolean => {
  const mod =
    requireOptionalNativeModule<LocalizationNativeModule>("ExpoLocalization");
  if (!mod) {
    logger.warn("ExpoLocalization native module unavailable; assuming 12-hour");
    return false;
  }
  try {
    return mod.getCalendars()[0]?.uses24hourClock ?? false;
  } catch (error) {
    logger.warn("expo-localization read failed; assuming 12-hour clock", error);
    return false;
  }
};
