import { Alert } from "react-native";

jest.mock("@nag/core", () => ({
  disconnectFromCloud: jest.fn(),
  resetLocalAccount: jest.fn(),
}));

jest.mock("../../../infrastructure/apiClient", () => ({
  deleteAccount: jest.fn(),
}));

jest.mock("../../../infrastructure/clerk", () => ({
  clearAllClerkTokens: jest.fn(),
}));

jest.mock("../../../infrastructure/tokenStore", () => ({
  deviceTokenStore: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
}));

jest.mock("../../../db", () => ({
  db: {},
}));

jest.mock("../../../infrastructure/log", () => ({
  log: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import { confirmAndSignOut } from "../signOutAction";
import {
  disconnectFromCloud as mockDisconnectFromCloud,
  resetLocalAccount as mockResetLocalAccount,
} from "@nag/core";
import { deleteAccount as mockDeleteAccount } from "../../../infrastructure/apiClient";
import { clearAllClerkTokens as mockClearAllClerkTokens } from "../../../infrastructure/clerk";

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

const pressAlertButton = (
  alertSpy: jest.SpiedFunction<typeof Alert.alert>,
  text: string,
  callIndex = 0,
) => {
  const buttons = alertSpy.mock.calls[callIndex][2] as
    | AlertButton[]
    | undefined;
  if (!buttons) throw new Error("Alert.alert had no buttons");
  const btn = buttons.find((b) => b.text === text);
  if (!btn?.onPress) {
    throw new Error(`Alert button "${text}" not found`);
  }
  return Promise.resolve(btn.onPress());
};

describe("confirmAndSignOut", () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;
  let clerkSignOut: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    clerkSignOut = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("shows a three-choice dialog (Cancel / Keep / Wipe)", () => {
    confirmAndSignOut(clerkSignOut);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    expect(buttons.map((b) => b.text)).toEqual([
      "Cancel",
      "Keep on this device",
      "Sign out completely",
    ]);
  });

  it("Cancel → no API calls, no local mutation, no Clerk sign-out", () => {
    confirmAndSignOut(clerkSignOut);
    // Cancel has no onPress — the helper relies on the modal closing
    // on its own. Assert that *nothing* else fired meanwhile.
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
    expect(mockResetLocalAccount).not.toHaveBeenCalled();
    expect(mockClearAllClerkTokens).not.toHaveBeenCalled();
    expect(clerkSignOut).not.toHaveBeenCalled();
  });

  describe("Keep on this device (Option A)", () => {
    it("happy path: deleteAccount → disconnectFromCloud → clerk tokens cleared → Clerk signOut", async () => {
      (mockDeleteAccount as jest.Mock).mockResolvedValue({ ok: true });

      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Keep on this device");

      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
      expect(mockDisconnectFromCloud).toHaveBeenCalledTimes(1);
      expect(mockClearAllClerkTokens).toHaveBeenCalledTimes(1);
      expect(clerkSignOut).toHaveBeenCalledTimes(1);
      // Local-wipe path must NOT run in the keep-data branch.
      expect(mockResetLocalAccount).not.toHaveBeenCalled();
    });

    it("server delete 500 → error alert with HTTP prefix, local state preserved, no Clerk signOut", async () => {
      (mockDeleteAccount as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "non-retriable",
        status: 500,
        message: "internal",
      });

      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Keep on this device");

      // The error alert is the *second* Alert.alert call (the first
      // was the confirm dialog itself).
      expect(alertSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(alertSpy.mock.calls[1][0]).toBe("Couldn't sign out cleanly");
      expect(alertSpy.mock.calls[1][1]).toContain("HTTP 500");

      // Critical: the local-cleanup + Clerk sign-out must NOT run when
      // the server delete failed — otherwise the device would be in
      // a stuck state with no local binding *and* an orphan server
      // account still referenced by other devices.
      expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
      expect(mockClearAllClerkTokens).not.toHaveBeenCalled();
      expect(clerkSignOut).not.toHaveBeenCalled();
    });

    it("server delete transient → error alert without HTTP prefix, local state preserved", async () => {
      (mockDeleteAccount as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "transient",
        message: "network down",
      });

      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Keep on this device");

      expect(alertSpy.mock.calls[1][0]).toBe("Couldn't sign out cleanly");
      expect(alertSpy.mock.calls[1][1]).toBe("network down");
      expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
    });

    it("Clerk signOut throws → swallows the error so local cleanup isn't half-applied", async () => {
      (mockDeleteAccount as jest.Mock).mockResolvedValue({ ok: true });
      clerkSignOut.mockRejectedValueOnce(new Error("clerk offline"));

      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Keep on this device");

      // Local state was cleared before Clerk failed; we don't roll back.
      expect(mockDisconnectFromCloud).toHaveBeenCalledTimes(1);
      expect(mockClearAllClerkTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe("Sign out completely (Option B)", () => {
    it("happy path: resetLocalAccount → clerk tokens cleared → Clerk signOut; server untouched", async () => {
      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Sign out completely");

      expect(mockResetLocalAccount).toHaveBeenCalledTimes(1);
      expect(mockClearAllClerkTokens).toHaveBeenCalledTimes(1);
      expect(clerkSignOut).toHaveBeenCalledTimes(1);
      // The Wipe branch is intentionally local-only — the server-side
      // account stays alive so a future same-identity sign-in can
      // recover the data via runPairFallback.
      expect(mockDeleteAccount).not.toHaveBeenCalled();
      expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
    });

    it("Clerk signOut throws → swallows the error so local wipe isn't rolled back", async () => {
      clerkSignOut.mockRejectedValueOnce(new Error("clerk offline"));

      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Sign out completely");

      expect(mockResetLocalAccount).toHaveBeenCalledTimes(1);
      expect(mockClearAllClerkTokens).toHaveBeenCalledTimes(1);
    });
  });
});
