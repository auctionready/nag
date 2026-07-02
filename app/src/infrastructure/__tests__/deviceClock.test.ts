import { requireOptionalNativeModule } from "expo-modules-core";
import { deviceUses24HourClock } from "../deviceClock";

jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: jest.fn(),
}));

const mockRequire = requireOptionalNativeModule as jest.Mock;

describe("deviceUses24HourClock", () => {
  beforeEach(() => {
    mockRequire.mockReset();
  });

  const withCalendars = (calendars: unknown[]) =>
    mockRequire.mockReturnValue({ getCalendars: () => calendars });

  it("returns true when the device reports a 24-hour clock", () => {
    withCalendars([{ uses24hourClock: true }]);
    expect(deviceUses24HourClock()).toBe(true);
  });

  it("returns false when the device reports a 12-hour clock", () => {
    withCalendars([{ uses24hourClock: false }]);
    expect(deviceUses24HourClock()).toBe(false);
  });

  it("falls back to 12-hour when the convention is unknown (null)", () => {
    withCalendars([{ uses24hourClock: null }]);
    expect(deviceUses24HourClock()).toBe(false);
  });

  it("falls back to 12-hour when there are no calendars", () => {
    withCalendars([]);
    expect(deviceUses24HourClock()).toBe(false);
  });

  // The iOS Simulator can leave ExpoLocalization unregistered; the optional
  // getter returns null instead of throwing, and we must not crash bootstrap.
  it("falls back to 12-hour when the native module is unavailable", () => {
    mockRequire.mockReturnValue(null);
    expect(deviceUses24HourClock()).toBe(false);
  });

  it("falls back to 12-hour when reading calendars throws", () => {
    mockRequire.mockReturnValue({
      getCalendars: () => {
        throw new Error("boom");
      },
    });
    expect(deviceUses24HourClock()).toBe(false);
  });
});
