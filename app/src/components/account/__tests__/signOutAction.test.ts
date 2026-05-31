import { Alert } from "react-native";

import { confirmAndSignOut } from "../signOutAction";
import {
  disconnectFromCloud as mockDisconnectFromCloud,
  pauseDispatch as mockPauseDispatch,
} from "@nag/core";
import { deleteAccount as mockDeleteAccount } from "../../../infrastructure/apiClient";
import { clearAllClerkTokens as mockClearAllClerkTokens } from "../../../infrastructure/clerk";

jest.mock("@nag/core", () => ({
  disconnectFromCloud: jest.fn(),
  pauseDispatch: jest.fn(),
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

  it("shows a three-choice dialog (Cancel / Remove server data and sign out / Pause server sync)", () => {
    confirmAndSignOut(clerkSignOut);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    expect(buttons.map((b) => b.text)).toEqual([
      "Cancel",
      "Remove server data and sign out",
      "Pause server sync",
    ]);
  });

  it("Cancel → no API calls, no local mutation, no Clerk sign-out", () => {
    confirmAndSignOut(clerkSignOut);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
    expect(mockPauseDispatch).not.toHaveBeenCalled();
    expect(mockClearAllClerkTokens).not.toHaveBeenCalled();
    expect(clerkSignOut).not.toHaveBeenCalled();
  });

  describe("Remove server data and sign out", () => {
    it("happy path: deleteAccount → disconnectFromCloud → clerk tokens cleared → Clerk signOut", async () => {
      (mockDeleteAccount as jest.Mock).mockResolvedValue({ ok: true });

      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Remove server data and sign out");

      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
      expect(mockDisconnectFromCloud).toHaveBeenCalledTimes(1);
      expect(mockClearAllClerkTokens).toHaveBeenCalledTimes(1);
      expect(clerkSignOut).toHaveBeenCalledTimes(1);
      // Pause branch must not run from the remove-server-data branch.
      expect(mockPauseDispatch).not.toHaveBeenCalled();
    });

    it("server delete 500 → error alert with HTTP prefix, local state preserved, no Clerk signOut", async () => {
      (mockDeleteAccount as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "non-retriable",
        status: 500,
        message: "internal",
      });

      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Remove server data and sign out");

      expect(alertSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(alertSpy.mock.calls[1][0]).toBe("Couldn't sign out cleanly");
      expect(alertSpy.mock.calls[1][1]).toContain("HTTP 500");

      // Critical: local cleanup + Clerk sign-out must NOT run when the
      // server delete failed.
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
      await pressAlertButton(alertSpy, "Remove server data and sign out");

      expect(alertSpy.mock.calls[1][0]).toBe("Couldn't sign out cleanly");
      expect(alertSpy.mock.calls[1][1]).toBe("network down");
      expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
    });

    it("Clerk signOut throws → swallows the error so local cleanup isn't half-applied", async () => {
      (mockDeleteAccount as jest.Mock).mockResolvedValue({ ok: true });
      clerkSignOut.mockRejectedValueOnce(new Error("clerk offline"));

      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Remove server data and sign out");

      expect(mockDisconnectFromCloud).toHaveBeenCalledTimes(1);
      expect(mockClearAllClerkTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe("Pause server sync", () => {
    it("happy path: pauseDispatch only — no server calls, no Clerk signOut", async () => {
      confirmAndSignOut(clerkSignOut);
      await pressAlertButton(alertSpy, "Pause server sync");

      expect(mockPauseDispatch).toHaveBeenCalledTimes(1);
      // Critical contract: pause is reversible from the Account-screen
      // banner, so the Clerk session and server state must stay intact.
      expect(mockDeleteAccount).not.toHaveBeenCalled();
      expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
      expect(mockClearAllClerkTokens).not.toHaveBeenCalled();
      expect(clerkSignOut).not.toHaveBeenCalled();
    });

    it("Pause button is not styled as destructive (no data loss; reversible)", () => {
      confirmAndSignOut(clerkSignOut);
      const buttons = alertSpy.mock.calls[0][2] as (AlertButton & {
        style?: string;
      })[];
      const pauseBtn = buttons.find((b) => b.text === "Pause server sync");
      expect(pauseBtn?.style).toBeUndefined();
      const removeBtn = buttons.find(
        (b) => b.text === "Remove server data and sign out",
      );
      expect(removeBtn?.style).toBe("destructive");
    });
  });
});
