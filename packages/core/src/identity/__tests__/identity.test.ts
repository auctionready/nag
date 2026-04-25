import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { identity } from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import {
  ensureDeviceRegistered,
  refreshDeviceToken,
  loadIdentity,
  getAccountId,
  getDeviceToken,
} from "../identity";
import type { RegisterDeviceResult } from "../types";

const getDb = setupTestDb("identity-test.db");

const newDeviceId = () => "11111111-2222-4333-8444-555555555555";

describe("ensureDeviceRegistered", () => {
  it("on first launch: generates a deviceId, registers, persists accountId and deviceToken", async () => {
    const db = getDb();
    await db.delete(identity); // simulate fresh install

    const register = vi.fn(
      async (): Promise<RegisterDeviceResult> => ({
        ok: true,
        accountId: "acc-from-server",
        registeredAt: new Date("2026-04-25T00:00:00.000Z"),
        deviceToken: "tok-from-server",
      }),
    );

    const result = await ensureDeviceRegistered({
      db,
      register,
      newDeviceId,
    });

    expect(register).toHaveBeenCalledWith({ deviceId: newDeviceId() });
    expect(result.deviceId).toBe(newDeviceId());
    expect(result.accountId).toBe("acc-from-server");
    expect(result.deviceToken).toBe("tok-from-server");

    const persisted = await loadIdentity(db);
    expect(persisted).toEqual({
      deviceId: newDeviceId(),
      accountId: "acc-from-server",
      registeredAt: new Date("2026-04-25T00:00:00.000Z"),
      deviceToken: "tok-from-server",
    });
  });

  describe("when already registered", () => {
    it("does not call the register function and returns the cached accountId + deviceToken", async () => {
      const db = getDb();
      // testDb already seeds an identity row; force a token onto it so
      // the short-circuit path engages (legacy rows from before phase
      // 2c had no token; covered separately below).
      await db
        .update(identity)
        .set({ deviceToken: "cached-tok" })
        .where(eq(identity.id, 1));

      const register = vi.fn(async (): Promise<RegisterDeviceResult> => {
        throw new Error(
          "register should not be called when already registered",
        );
      });

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(register).not.toHaveBeenCalled();
      expect(result.accountId).toBe("00000000-0000-4000-8000-0000000000aa");
      expect(result.deviceToken).toBe("cached-tok");
    });
  });

  describe("when previous registration failed", () => {
    it("reuses the persisted deviceId and retries on next call", async () => {
      const db = getDb();
      await db.delete(identity);
      const persistedDeviceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
      await db.insert(identity).values({
        id: 1,
        deviceId: persistedDeviceId,
      });

      const register = vi.fn(
        async (): Promise<RegisterDeviceResult> => ({
          ok: true,
          accountId: "acc-on-retry",
          registeredAt: new Date("2026-04-25T00:00:00.000Z"),
          deviceToken: "tok-on-retry",
        }),
      );

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(register).toHaveBeenCalledWith({ deviceId: persistedDeviceId });
      expect(result.deviceId).toBe(persistedDeviceId);
      expect(result.accountId).toBe("acc-on-retry");
      expect(result.deviceToken).toBe("tok-on-retry");
    });

    it("on a transient failure: leaves accountId null and returns the failure", async () => {
      const db = getDb();
      await db.delete(identity);

      const register = vi.fn(
        async (): Promise<RegisterDeviceResult> => ({
          ok: false,
          kind: "transient",
          message: "network down",
        }),
      );

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(result.accountId).toBeNull();
      expect(result.deviceToken).toBeNull();
      expect(result.registration).toEqual({
        ok: false,
        kind: "transient",
        message: "network down",
      });

      // deviceId is persisted so the next boot can retry.
      const [row] = await db.select().from(identity).where(eq(identity.id, 1));
      expect(row.deviceId).toBe(newDeviceId());
      expect(row.accountId).toBeNull();
      expect(row.deviceToken).toBeNull();
    });

    it("on a non-retriable failure: still leaves accountId null (next boot retries)", async () => {
      const db = getDb();
      await db.delete(identity);

      const register = vi.fn(
        async (): Promise<RegisterDeviceResult> => ({
          ok: false,
          kind: "non-retriable",
          status: 400,
          message: "bad request",
        }),
      );

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(result.accountId).toBeNull();
      expect(result.deviceToken).toBeNull();
    });
  });

  describe("when migrating from a pre-token install", () => {
    it("re-registers to fetch a deviceToken even though accountId is set", async () => {
      // Simulate an upgraded install: identity row has a deviceId +
      // accountId from before phase 2c, but no deviceToken column value.
      const db = getDb();
      await db
        .update(identity)
        .set({
          accountId: "legacy-acc",
          registeredAt: new Date("2026-01-01T00:00:00.000Z"),
          deviceToken: null,
        })
        .where(eq(identity.id, 1));

      const register = vi.fn(
        async (): Promise<RegisterDeviceResult> => ({
          ok: true,
          accountId: "legacy-acc",
          registeredAt: new Date("2026-04-25T00:00:00.000Z"),
          deviceToken: "newly-issued-tok",
        }),
      );

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(register).toHaveBeenCalled();
      expect(result.deviceToken).toBe("newly-issued-tok");
    });
  });
});

describe("refreshDeviceToken", () => {
  it("re-registers using the persisted deviceId and updates the row", async () => {
    const db = getDb();
    const seeded = await loadIdentity(db);
    expect(seeded).not.toBeNull();
    const persistedDeviceId = seeded!.deviceId;

    const register = vi.fn(
      async (): Promise<RegisterDeviceResult> => ({
        ok: true,
        accountId: seeded!.accountId!,
        registeredAt: new Date("2026-04-26T00:00:00.000Z"),
        deviceToken: "rotated-tok",
      }),
    );

    const newToken = await refreshDeviceToken({ db, register });

    expect(register).toHaveBeenCalledWith({ deviceId: persistedDeviceId });
    expect(newToken).toBe("rotated-tok");

    const after = await loadIdentity(db);
    expect(after?.deviceToken).toBe("rotated-tok");
    expect(after?.registeredAt?.toISOString()).toBe("2026-04-26T00:00:00.000Z");
  });

  it("returns null without touching the row when register fails", async () => {
    const db = getDb();
    const before = await loadIdentity(db);

    const register = vi.fn(
      async (): Promise<RegisterDeviceResult> => ({
        ok: false,
        kind: "transient",
        message: "offline",
      }),
    );

    const newToken = await refreshDeviceToken({ db, register });

    expect(newToken).toBeNull();
    const after = await loadIdentity(db);
    expect(after?.deviceToken).toBe(before?.deviceToken ?? null);
  });

  it("returns null when no identity row exists", async () => {
    const db = getDb();
    await db.delete(identity);

    const register = vi.fn();

    const newToken = await refreshDeviceToken({ db, register });

    expect(newToken).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });
});

describe("getAccountId", () => {
  it("returns null when no identity row exists", async () => {
    const db = getDb();
    await db.delete(identity);
    expect(await getAccountId(db)).toBeNull();
  });

  it("returns null when identity row exists but accountId is unset", async () => {
    const db = getDb();
    await db.delete(identity);
    await db.insert(identity).values({ id: 1, deviceId: "d" });
    expect(await getAccountId(db)).toBeNull();
  });

  it("returns the accountId once registered", async () => {
    const db = getDb();
    expect(await getAccountId(db)).toBe("00000000-0000-4000-8000-0000000000aa");
  });
});

describe("getDeviceToken", () => {
  it("returns null when no identity row exists", async () => {
    const db = getDb();
    await db.delete(identity);
    expect(await getDeviceToken(db)).toBeNull();
  });

  it("returns null when identity row exists but deviceToken is unset", async () => {
    const db = getDb();
    await db.delete(identity);
    await db.insert(identity).values({ id: 1, deviceId: "d" });
    expect(await getDeviceToken(db)).toBeNull();
  });

  it("returns the deviceToken once persisted", async () => {
    const db = getDb();
    await db
      .update(identity)
      .set({ deviceToken: "tok-123" })
      .where(eq(identity.id, 1));
    expect(await getDeviceToken(db)).toBe("tok-123");
  });
});
