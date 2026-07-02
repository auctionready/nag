jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-localization", () => ({
  getCalendars: jest.fn(() => [{ uses24hourClock: false }]),
}));

type Prefs = typeof import("../preferences");
type Store = {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
};
type Localization = {
  getCalendars: jest.Mock;
};

describe("preferences", () => {
  let prefs: Prefs;
  let store: Store;
  let localization: Localization;

  // Module-level cache means each scenario needs a fresh module instance —
  // and a fresh module sees a fresh copy of the SecureStore mock, so the
  // handles have to be re-required alongside it.
  beforeEach(() => {
    jest.resetModules();
    store = require("expo-secure-store") as Store;
    localization = require("expo-localization") as Localization;
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
      localization.getCalendars.mockReturnValue([{ uses24hourClock: true }]);
      await prefs.bootstrapPreferences();
      expect(prefs.get24HourClock()).toBe(true);
    });

    it("prefers a stored clock value over the device convention", async () => {
      localization.getCalendars.mockReturnValue([{ uses24hourClock: true }]);
      store.getItemAsync.mockImplementation((key: string) =>
        Promise.resolve(
          key === "nag.preference.use24HourClock" ? "false" : null,
        ),
      );
      await prefs.bootstrapPreferences();
      expect(prefs.get24HourClock()).toBe(false);
    });

    it("keeps the device convention when SecureStore read fails", async () => {
      localization.getCalendars.mockReturnValue([{ uses24hourClock: true }]);
      store.getItemAsync.mockRejectedValue(new Error("keychain unavailable"));
      await prefs.bootstrapPreferences();
      expect(prefs.get24HourClock()).toBe(true);
    });

    it("assumes 12-hour when the device convention is unknown", async () => {
      localization.getCalendars.mockReturnValue([{ uses24hourClock: null }]);
      await prefs.bootstrapPreferences();
      expect(prefs.get24HourClock()).toBe(false);
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
