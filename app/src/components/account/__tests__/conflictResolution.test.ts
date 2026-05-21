import { Alert } from "react-native";
import { runPairFallback } from "../conflictResolution";

// All API + core dependencies the conflict-resolution module touches are
// mocked. Each test sets the relevant mock return values then drives the
// flow by triggering the right Alert.alert button's onPress.

jest.mock("@nag/core", () => ({
  setIdpSubject: jest.fn(),
  switchLocalAccount: jest.fn(),
}));

jest.mock("../../../infrastructure/apiClient", () => ({
  pairDevice: jest.fn(),
  releaseClerkIdentity: jest.fn(),
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
  setIdpSubject as mockSetIdpSubject,
  switchLocalAccount as mockSwitchLocalAccount,
} from "@nag/core";
import {
  pairDevice as mockPairDevice,
  releaseClerkIdentity as mockReleaseClerkIdentity,
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

beforeEach(() => {
  jest.clearAllMocks();
  setLocalHabits([]);
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
