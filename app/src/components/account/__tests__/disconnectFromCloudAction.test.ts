import { Alert } from "react-native";

// jest-expo defaults `__DEV__` to true, which would route the disconnect
// success path into `DevSettings.reload()` (and crash in the absence of
// the native module). Forcing `__DEV__ = false` keeps the action on the
// production branch, where it surfaces a "Disconnected" confirmation
// alert — exactly the observable behaviour these tests care about.
declare const global: { __DEV__: boolean };
const originalDev = global.__DEV__;
beforeAll(() => {
  global.__DEV__ = false;
});
afterAll(() => {
  global.__DEV__ = originalDev;
});

jest.mock("@nag/core", () => ({
  disconnectFromCloud: jest.fn(),
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

import { confirmAndDisconnectFromCloud } from "../disconnectFromCloudAction";
import { disconnectFromCloud as mockDisconnectFromCloud } from "@nag/core";
import { deleteAccount as mockDeleteAccount } from "../../../infrastructure/apiClient";
import { clearAllClerkTokens as mockClearAllClerkTokens } from "../../../infrastructure/clerk";

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

const pressAlertButton = (
  alertSpy: jest.SpiedFunction<typeof Alert.alert>,
  text: string,
) => {
  const calls = alertSpy.mock.calls;
  if (calls.length === 0) throw new Error("Alert.alert was never called");
  const buttons = calls[calls.length - 1][2] as AlertButton[] | undefined;
  if (!buttons) throw new Error("Alert.alert had no buttons");
  const btn = buttons.find((b) => b.text === text);
  if (!btn?.onPress) {
    throw new Error(`Alert button "${text}" not found`);
  }
  return Promise.resolve(btn.onPress());
};

const flush = () =>
  new Promise<void>((resolve) => setImmediate(() => resolve()));

describe("confirmAndDisconnectFromCloud", () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("Cancel button → no API calls, no local mutation", async () => {
    confirmAndDisconnectFromCloud();
    await flush();
    // The Cancel button has `style: "cancel"` and no `onPress` — there's
    // nothing to invoke. Just assert nothing else fired.
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
    expect(mockClearAllClerkTokens).not.toHaveBeenCalled();
  });

  it("Disconnect happy path: server delete ok → disconnectFromCloud → clerk tokens cleared", async () => {
    (mockDeleteAccount as jest.Mock).mockResolvedValue({ ok: true });

    confirmAndDisconnectFromCloud();
    await pressAlertButton(alertSpy, "Disconnect");

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockDisconnectFromCloud).toHaveBeenCalledTimes(1);
    expect(mockClearAllClerkTokens).toHaveBeenCalledTimes(1);
  });

  it("server delete fails → surfaces an error alert and does NOT clear local state", async () => {
    (mockDeleteAccount as jest.Mock).mockResolvedValue({
      ok: false,
      kind: "non-retriable",
      status: 500,
      message: "internal",
    });

    confirmAndDisconnectFromCloud();
    await pressAlertButton(alertSpy, "Disconnect");

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    // The error alert is the *second* Alert.alert call (the first was
    // the confirm dialog itself).
    expect(alertSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(alertSpy.mock.calls[1][0]).toBe("Disconnect failed");
    expect(alertSpy.mock.calls[1][1]).toContain("HTTP 500");

    // Critical: local state is preserved — we never reached the
    // local-disconnect step, so the device still owns its identity row.
    expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
    expect(mockClearAllClerkTokens).not.toHaveBeenCalled();
  });

  it("server delete transient failure → error alert without an HTTP status prefix", async () => {
    (mockDeleteAccount as jest.Mock).mockResolvedValue({
      ok: false,
      kind: "transient",
      message: "network down",
    });

    confirmAndDisconnectFromCloud();
    await pressAlertButton(alertSpy, "Disconnect");

    expect(alertSpy.mock.calls[1][0]).toBe("Disconnect failed");
    expect(alertSpy.mock.calls[1][1]).toBe("network down");
    expect(mockDisconnectFromCloud).not.toHaveBeenCalled();
  });
});
