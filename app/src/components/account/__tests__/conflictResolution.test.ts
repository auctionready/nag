import { Alert } from "react-native";
import { runIdentityMismatch, runPairFallback } from "../conflictResolution";

// All API + core dependencies the conflict-resolution module touches are
// mocked. Each test sets the relevant mock return values then drives the
// flow by triggering the right Alert.alert button's onPress.

jest.mock("@nag/core", () => ({
  ensureDeviceRegistered: jest.fn(),
  resetLocalAccount: jest.fn(),
  setIdpSubject: jest.fn(),
  switchLocalAccount: jest.fn(),
}));

jest.mock("../../../infrastructure/apiClient", () => ({
  pairDevice: jest.fn(),
  registerDevice: jest.fn(),
  releaseClerkIdentity: jest.fn(),
  unbindAccount: jest.fn(),
  unregisterDevice: jest.fn(),
  upgradeAccount: jest.fn(),
}));

jest.mock("../../../db", () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock("../../../infrastructure/log", () => ({
  log: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("../../../infrastructure/tokenStore", () => ({
  deviceTokenStore: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
}));

// Only the column reference is read, never the value — so a plain string
// stand-in is enough to satisfy the import without dragging in real Drizzle.
jest.mock("@nag/schema", () => ({
  habit: { id: "id" },
}));

import {
  ensureDeviceRegistered as mockEnsureDeviceRegistered,
  resetLocalAccount as mockResetLocalAccount,
  setIdpSubject as mockSetIdpSubject,
  switchLocalAccount as mockSwitchLocalAccount,
} from "@nag/core";
import {
  pairDevice as mockPairDevice,
  releaseClerkIdentity as mockReleaseClerkIdentity,
  unbindAccount as mockUnbindAccount,
  unregisterDevice as mockUnregisterDevice,
  upgradeAccount as mockUpgradeAccount,
} from "../../../infrastructure/apiClient";
import { db as mockDb } from "../../../db";

type AlertButton = { text: string; onPress?: () => void };
type AlertSpy = jest.SpiedFunction<typeof Alert.alert>;

const pressAlertButton = (alertSpy: AlertSpy, text: string) => {
  const calls = alertSpy.mock.calls;
  if (calls.length === 0) {
    throw new Error("Alert.alert was never called");
  }
  const buttons = calls[calls.length - 1][2] as AlertButton[] | undefined;
  if (!buttons) {
    throw new Error("Alert.alert was called without buttons");
  }
  const btn = buttons.find((b) => b.text === text);
  if (!btn?.onPress) {
    throw new Error(
      `Alert button "${text}" not found (buttons: ${buttons
        .map((b) => b.text)
        .join(", ")})`,
    );
  }
  btn.onPress();
};

// Drive `db.select(...).from(...).limit(1)` to return whatever rows the
// caller wants — only used by `runPairFallback` to decide between the
// silent-pair and prompt paths.
const setLocalHabits = (rows: { id: string }[]) => {
  (mockDb.select as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue(rows),
    }),
  });
};

const flush = () =>
  new Promise<void>((resolve) => setImmediate(() => resolve()));

const okRegistration = {
  deviceId: "dev-1",
  accountId: "acc-1",
  deviceToken: "tok-1",
  registration: { ok: true, cached: false },
};

beforeEach(() => {
  jest.clearAllMocks();
  setLocalHabits([]);
});

describe("runIdentityMismatch", () => {
  let alertSpy: AlertSpy;
  let signOut: jest.Mock;
  let kickSync: jest.Mock;
  let setStatus: jest.Mock;
  let onCancelled: jest.Mock;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    signOut = jest.fn().mockResolvedValue(undefined);
    kickSync = jest.fn();
    setStatus = jest.fn();
    onCancelled = jest.fn();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  const run = () =>
    runIdentityMismatch({
      idpToken: "google-token",
      kickSync,
      signOut,
      setStatus,
      onCancelled,
    });

  it("Cancel → signs out of Clerk, resets the guard, sets idle", async () => {
    const promise = run();
    await flush();
    pressAlertButton(alertSpy, "Cancel");
    await promise;

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenLastCalledWith({ kind: "idle" });
    expect(mockUnbindAccount).not.toHaveBeenCalled();
    expect(mockUnregisterDevice).not.toHaveBeenCalled();
    expect(mockUpgradeAccount).not.toHaveBeenCalled();
  });

  it("Cancel → swallows signOut failures and still resolves to idle", async () => {
    signOut.mockRejectedValueOnce(new Error("clerk offline"));
    const promise = run();
    await flush();
    pressAlertButton(alertSpy, "Cancel");
    await promise;

    expect(setStatus).toHaveBeenLastCalledWith({ kind: "idle" });
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });

  describe("Switch this account → unbind then re-POST identity", () => {
    it("happy path: unbind ok + upgrade ok → setIdpSubject + status ok + kickSync", async () => {
      (mockUnbindAccount as jest.Mock).mockResolvedValue({ ok: true });
      (mockUpgradeAccount as jest.Mock).mockResolvedValue({
        ok: true,
        idpSubject: "google-sub",
        upgradedAt: new Date("2026-05-01T00:00:00Z"),
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Switch this account to this login");
      await promise;

      expect(mockUnbindAccount).toHaveBeenCalledTimes(1);
      expect(mockUpgradeAccount).toHaveBeenCalledWith({
        idpToken: "google-token",
      });
      expect(mockSetIdpSubject).toHaveBeenCalledWith(mockDb, "google-sub");
      expect(setStatus).toHaveBeenLastCalledWith({ kind: "ok" });
      expect(kickSync).toHaveBeenCalledWith("post-switch-identity");
      // No fallback paths should fire on the happy switch.
      expect(mockUnregisterDevice).not.toHaveBeenCalled();
      expect(mockResetLocalAccount).not.toHaveBeenCalled();
    });

    it("unbind transient failure → status fail, no rebind attempt", async () => {
      (mockUnbindAccount as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "transient",
        message: "network down",
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Switch this account to this login");
      await promise;

      expect(setStatus).toHaveBeenLastCalledWith({
        kind: "fail",
        message: "network down",
      });
      expect(mockUpgradeAccount).not.toHaveBeenCalled();
      expect(mockSetIdpSubject).not.toHaveBeenCalled();
      expect(kickSync).not.toHaveBeenCalled();
    });

    it("unbind ok + upgrade 409 → status fail (the new sub is bound elsewhere)", async () => {
      (mockUnbindAccount as jest.Mock).mockResolvedValue({ ok: true });
      (mockUpgradeAccount as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "non-retriable",
        status: 409,
        message: "this identity is already bound to a different account",
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Switch this account to this login");
      await promise;

      expect(setStatus).toHaveBeenLastCalledWith({
        kind: "fail",
        message: "this identity is already bound to a different account",
      });
      expect(mockSetIdpSubject).not.toHaveBeenCalled();
    });
  });

  describe("Start a new account → unregister, wipe local, fresh register + upgrade", () => {
    it("happy path: unregister ok + re-register + upgrade ok → setIdpSubject + status ok + kickSync", async () => {
      (mockUnregisterDevice as jest.Mock).mockResolvedValue({ ok: true });
      (mockEnsureDeviceRegistered as jest.Mock).mockResolvedValue(
        okRegistration,
      );
      (mockUpgradeAccount as jest.Mock).mockResolvedValue({
        ok: true,
        idpSubject: "google-sub",
        upgradedAt: new Date("2026-05-01T00:00:00Z"),
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Start a new account");
      await promise;

      expect(mockUnregisterDevice).toHaveBeenCalledTimes(1);
      expect(mockResetLocalAccount).toHaveBeenCalledTimes(1);
      expect(mockEnsureDeviceRegistered).toHaveBeenCalledTimes(1);
      expect(mockUpgradeAccount).toHaveBeenCalledWith({
        idpToken: "google-token",
      });
      expect(mockSetIdpSubject).toHaveBeenCalledWith(mockDb, "google-sub");
      expect(setStatus).toHaveBeenLastCalledWith({ kind: "ok" });
      expect(kickSync).toHaveBeenCalledWith("post-fresh-account");
    });

    it("unregister 401 → treated as already-done, flow continues to fresh register", async () => {
      // A retry hitting an already-deleted device row sees the auth
      // handler reject the now-stale device token. The flow must not
      // bail — the cleanup we wanted has already happened on the server.
      (mockUnregisterDevice as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "non-retriable",
        status: 401,
        message: "unauthenticated",
      });
      (mockEnsureDeviceRegistered as jest.Mock).mockResolvedValue(
        okRegistration,
      );
      (mockUpgradeAccount as jest.Mock).mockResolvedValue({
        ok: true,
        idpSubject: "google-sub",
        upgradedAt: new Date("2026-05-01T00:00:00Z"),
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Start a new account");
      await promise;

      expect(mockResetLocalAccount).toHaveBeenCalledTimes(1);
      expect(mockEnsureDeviceRegistered).toHaveBeenCalledTimes(1);
      expect(setStatus).toHaveBeenLastCalledWith({ kind: "ok" });
    });

    it("unregister transient failure → status fail, no local wipe", async () => {
      (mockUnregisterDevice as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "transient",
        message: "network down",
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Start a new account");
      await promise;

      expect(setStatus).toHaveBeenLastCalledWith({
        kind: "fail",
        message: "network down",
      });
      expect(mockResetLocalAccount).not.toHaveBeenCalled();
      expect(mockEnsureDeviceRegistered).not.toHaveBeenCalled();
      expect(mockUpgradeAccount).not.toHaveBeenCalled();
    });

    it("unregister 500 (non-retriable, not 401) → status fail, no local wipe", async () => {
      (mockUnregisterDevice as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "non-retriable",
        status: 500,
        message: "internal server error",
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Start a new account");
      await promise;

      expect(setStatus).toHaveBeenLastCalledWith({
        kind: "fail",
        message: "internal server error",
      });
      expect(mockResetLocalAccount).not.toHaveBeenCalled();
    });

    it("re-register returns no accountId → status fail with friendly message", async () => {
      (mockUnregisterDevice as jest.Mock).mockResolvedValue({ ok: true });
      (mockEnsureDeviceRegistered as jest.Mock).mockResolvedValue({
        ...okRegistration,
        accountId: null,
        deviceToken: null,
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Start a new account");
      await promise;

      expect(setStatus).toHaveBeenLastCalledWith({
        kind: "fail",
        message: expect.stringContaining("re-registration failed"),
      });
      expect(mockUpgradeAccount).not.toHaveBeenCalled();
    });

    it("upgrade failure after fresh register → status fail, no idp persisted", async () => {
      (mockUnregisterDevice as jest.Mock).mockResolvedValue({ ok: true });
      (mockEnsureDeviceRegistered as jest.Mock).mockResolvedValue(
        okRegistration,
      );
      (mockUpgradeAccount as jest.Mock).mockResolvedValue({
        ok: false,
        kind: "transient",
        message: "upstream timeout",
      });

      const promise = run();
      await flush();
      pressAlertButton(alertSpy, "Start a new account");
      await promise;

      expect(setStatus).toHaveBeenLastCalledWith({
        kind: "fail",
        message: "upstream timeout",
      });
      expect(mockSetIdpSubject).not.toHaveBeenCalled();
      expect(kickSync).not.toHaveBeenCalled();
    });
  });

  it("Alert dismissed via onDismiss → routes to the cancel path", async () => {
    const promise = run();
    await flush();
    const options = alertSpy.mock.calls[0][3] as {
      onDismiss?: () => void;
    };
    options.onDismiss?.();
    await promise;

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenLastCalledWith({ kind: "idle" });
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });
});

describe("runPairFallback", () => {
  let alertSpy: AlertSpy;
  let signOut: jest.Mock;
  let kickSync: jest.Mock;
  let setStatus: jest.Mock;
  let onCancelled: jest.Mock;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    signOut = jest.fn().mockResolvedValue(undefined);
    kickSync = jest.fn();
    setStatus = jest.fn();
    onCancelled = jest.fn();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  const run = () =>
    runPairFallback({
      deviceId: "dev-1",
      idpToken: "google-token",
      idpSubject: "google-sub",
      kickSync,
      signOut,
      setStatus,
      onCancelled,
    });

  it("no local habits → silent pair into existing server account (no prompt)", async () => {
    setLocalHabits([]);
    (mockPairDevice as jest.Mock).mockResolvedValue({
      ok: true,
      accountId: "existing-acc",
      deviceToken: "new-tok",
      registeredAt: new Date("2026-05-01T00:00:00Z"),
    });

    await run();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockPairDevice).toHaveBeenCalledWith({
      deviceId: "dev-1",
      idpToken: "google-token",
    });
    expect(mockSwitchLocalAccount).toHaveBeenCalledTimes(1);
    expect(mockSetIdpSubject).toHaveBeenCalledWith(mockDb, "google-sub");
    expect(setStatus).toHaveBeenLastCalledWith({ kind: "ok" });
    expect(kickSync).toHaveBeenCalledWith("post-pair");
  });

  it("has local habits + Cancel → signs out of Clerk, resets guard, status idle", async () => {
    setLocalHabits([{ id: "habit-x" }]);

    const promise = run();
    await flush();
    pressAlertButton(alertSpy, "Cancel");
    await promise;

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenLastCalledWith({ kind: "idle" });
    expect(mockPairDevice).not.toHaveBeenCalled();
    expect(mockReleaseClerkIdentity).not.toHaveBeenCalled();
  });

  it("has local habits + Use server data → pairDevice + switchLocalAccount + setIdpSubject", async () => {
    setLocalHabits([{ id: "habit-x" }]);
    (mockPairDevice as jest.Mock).mockResolvedValue({
      ok: true,
      accountId: "existing-acc",
      deviceToken: "new-tok",
      registeredAt: new Date("2026-05-01T00:00:00Z"),
    });

    const promise = run();
    await flush();
    pressAlertButton(alertSpy, "Use server data");
    await promise;

    expect(mockPairDevice).toHaveBeenCalledWith({
      deviceId: "dev-1",
      idpToken: "google-token",
    });
    expect(mockSwitchLocalAccount).toHaveBeenCalledTimes(1);
    expect(mockSetIdpSubject).toHaveBeenCalledWith(mockDb, "google-sub");
    expect(setStatus).toHaveBeenLastCalledWith({ kind: "ok" });
    expect(kickSync).toHaveBeenCalledWith("post-pair");
  });

  it("has local habits + Use server data + pairDevice fails → status fail, no switch", async () => {
    setLocalHabits([{ id: "habit-x" }]);
    (mockPairDevice as jest.Mock).mockResolvedValue({
      ok: false,
      kind: "non-retriable",
      status: 404,
      message: "no account found for this identity",
    });

    const promise = run();
    await flush();
    pressAlertButton(alertSpy, "Use server data");
    await promise;

    expect(setStatus).toHaveBeenLastCalledWith({
      kind: "fail",
      message: "no account found for this identity",
    });
    expect(mockSwitchLocalAccount).not.toHaveBeenCalled();
  });

  it("has local habits + Use this device's data → releaseClerkIdentity + upgradeAccount + setIdpSubject", async () => {
    setLocalHabits([{ id: "habit-x" }]);
    (mockReleaseClerkIdentity as jest.Mock).mockResolvedValue({ ok: true });
    (mockUpgradeAccount as jest.Mock).mockResolvedValue({
      ok: true,
      idpSubject: "google-sub",
      upgradedAt: new Date("2026-05-01T00:00:00Z"),
    });

    const promise = run();
    await flush();
    pressAlertButton(alertSpy, "Use this device's data");
    await promise;

    expect(mockReleaseClerkIdentity).toHaveBeenCalledWith({
      idpToken: "google-token",
    });
    expect(mockUpgradeAccount).toHaveBeenCalledWith({
      idpToken: "google-token",
    });
    expect(mockSetIdpSubject).toHaveBeenCalledWith(mockDb, "google-sub");
    expect(setStatus).toHaveBeenLastCalledWith({ kind: "ok" });
    expect(kickSync).toHaveBeenCalledWith("post-take-over");
  });

  it("has local habits + Use this device's data + release fails → status fail, upgrade not attempted", async () => {
    setLocalHabits([{ id: "habit-x" }]);
    (mockReleaseClerkIdentity as jest.Mock).mockResolvedValue({
      ok: false,
      kind: "transient",
      message: "network down",
    });

    const promise = run();
    await flush();
    pressAlertButton(alertSpy, "Use this device's data");
    await promise;

    expect(setStatus).toHaveBeenLastCalledWith({
      kind: "fail",
      message: "network down",
    });
    expect(mockUpgradeAccount).not.toHaveBeenCalled();
  });
});
