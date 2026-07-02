jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

// Device-clock detection is exercised in deviceClock.test.ts; here we mock it
// so preferences tests can drive the device convention directly.
jest.mock("../deviceClock", () => ({
  deviceUses24HourClock: jest.fn(() => false),
}));

type Prefs = typeof import("../preferences");
type Store = {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
};
type DeviceClock = {
  deviceUses24HourClock: jest.Mock;
};

describe("preferences", () => {
  let prefs: Prefs;
  let store: Store;
  let deviceClock: DeviceClock;

  // Module-level cache means each scenario needs a fresh module instance —
  // and a fresh module sees a fresh copy of the SecureStore mock, so the
  // handles have to be re-required alongside it.
  beforeEach(() => {
    jest.resetModules();
    store = require("expo-secure-store") as Store;
    deviceClock = require("../deviceClock") as DeviceClock;
    deviceClock.deviceUses24HourClock.mockReturnValue(false);
    prefs = require("../preferences") as Prefs;
  });

  describe("before bootstrap", () => {
    it("defaults to the board view", () => {
      expect(prefs.getDefaultView()).toBe("board");
    });

    it("defaults to the 12-hour clock", () => {
      expect(prefs.get24HourClock()).toBe(false);
    });
  });

  describe("bootstrapPreferences", () => {
    it("loads a stored 'day' preference", async () => {
      store.getItemAsync.mockResolvedValue("day");
      await prefs.bootstrapPreferences();
      expect(prefs.getDefaultView()).toBe("day");
    });

    it("ignores unknown stored values", async () => {
      store.getItemAsync.mockResolvedValue("bogus");
      await prefs.bootstrapPreferences();
      expect(prefs.getDefaultView()).toBe("board");
    });

    it("falls back to defaults when SecureStore read fails", async () => {
      store.getItemAsync.mockRejectedValue(new Error("keychain unavailable"));
      await prefs.bootstrapPreferences();
      expect(prefs.getDefaultView()).toBe("board");
    });

    it("seeds the clock from the device when nothing is stored", async () => {
      deviceClock.deviceUses24HourClock.mockReturnValue(true);
      await prefs.bootstrapPreferences();
      expect(prefs.get24HourClock()).toBe(true);
    });

    it("prefers a stored clock value over the device convention", async () => {
      deviceClock.deviceUses24HourClock.mockReturnValue(true);
      store.getItemAsync.mockImplementation((key: string) =>
        Promise.resolve(
          key === "nag.preference.use24HourClock" ? "false" : null,
        ),
      );
      await prefs.bootstrapPreferences();
      expect(prefs.get24HourClock()).toBe(false);
    });

    it("keeps the device convention when SecureStore read fails", async () => {
      deviceClock.deviceUses24HourClock.mockReturnValue(true);
      store.getItemAsync.mockRejectedValue(new Error("keychain unavailable"));
      await prefs.bootstrapPreferences();
      expect(prefs.get24HourClock()).toBe(true);
    });
  });

  describe("setDefaultView", () => {
    it("updates the cache synchronously and persists", () => {
      prefs.setDefaultView("day");
      expect(prefs.getDefaultView()).toBe("day");
      expect(store.setItemAsync).toHaveBeenCalledWith(
        "nag.preference.defaultView",
        "day",
      );
    });
  });

  describe("set24HourClock", () => {
    it("updates the cache synchronously and persists", () => {
      prefs.set24HourClock(true);
      expect(prefs.get24HourClock()).toBe(true);
      expect(store.setItemAsync).toHaveBeenCalledWith(
        "nag.preference.use24HourClock",
        "true",
      );
    });
  });
});
