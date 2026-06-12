jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

type Prefs = typeof import("../preferences");
type Store = {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
};

describe("preferences", () => {
  let prefs: Prefs;
  let store: Store;

  // Module-level cache means each scenario needs a fresh module instance —
  // and a fresh module sees a fresh copy of the SecureStore mock, so the
  // handles have to be re-required alongside it.
  beforeEach(() => {
    jest.resetModules();
    store = require("expo-secure-store") as Store;
    prefs = require("../preferences") as Prefs;
  });

  describe("before bootstrap", () => {
    it("defaults to the board view", () => {
      expect(prefs.getDefaultView()).toBe("board");
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
});
