import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { identity } from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import {
  ensureDeviceRegistered,
  loadIdentity,
  getAccountId,
} from "../identity";
import type { RegisterDeviceFn } from "../types";

const getDb = setupTestDb("identity-test.db");

const newDeviceId = () => "11111111-2222-4333-8444-555555555555";

describe("ensureDeviceRegistered", () => {
  it("on first launch: generates a deviceId, registers, persists accountId", async () => {
    const db = getDb();
    await db.delete(identity); // simulate fresh install

    const register: RegisterDeviceFn = vi.fn(async () => ({
      ok: true,
      accountId: "acc-from-server",
      registeredAt: new Date("2026-04-25T00:00:00.000Z"),
    }));

    const result = await ensureDeviceRegistered({
      db,
      register,
      newDeviceId,
    });

    expect(register).toHaveBeenCalledWith({ deviceId: newDeviceId() });
    expect(result.deviceId).toBe(newDeviceId());
    expect(result.accountId).toBe("acc-from-server");

    const persisted = await loadIdentity(db);
    expect(persisted).toEqual({
      deviceId: newDeviceId(),
      accountId: "acc-from-server",
      registeredAt: new Date("2026-04-25T00:00:00.000Z"),
    });
  });

  describe("when already registered", () => {
    it("does not call the register function and returns the cached accountId", async () => {
      const db = getDb();
      // testDb already seeds an identity row; verify shortcut path.

      const register: RegisterDeviceFn = vi.fn();

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(register).not.toHaveBeenCalled();
      expect(result.accountId).toBe("00000000-0000-4000-8000-0000000000aa");
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

      const register: RegisterDeviceFn = vi.fn(async () => ({
        ok: true,
        accountId: "acc-on-retry",
        registeredAt: new Date("2026-04-25T00:00:00.000Z"),
      }));

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(register).toHaveBeenCalledWith({ deviceId: persistedDeviceId });
      expect(result.deviceId).toBe(persistedDeviceId);
      expect(result.accountId).toBe("acc-on-retry");
    });

    it("on a transient failure: leaves accountId null and returns the failure", async () => {
      const db = getDb();
      await db.delete(identity);

      const register: RegisterDeviceFn = vi.fn(async () => ({
        ok: false,
        kind: "transient",
        message: "network down",
      }));

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(result.accountId).toBeNull();
      expect(result.registration).toEqual({
        ok: false,
        kind: "transient",
        message: "network down",
      });

      // deviceId is persisted so the next boot can retry.
      const [row] = await db.select().from(identity).where(eq(identity.id, 1));
      expect(row.deviceId).toBe(newDeviceId());
      expect(row.accountId).toBeNull();
    });

    it("on a non-retriable failure: still leaves accountId null (next boot retries)", async () => {
      const db = getDb();
      await db.delete(identity);

      const register: RegisterDeviceFn = vi.fn(async () => ({
        ok: false,
        kind: "non-retriable",
        status: 400,
        message: "bad request",
      }));

      const result = await ensureDeviceRegistered({
        db,
        register,
        newDeviceId,
      });

      expect(result.accountId).toBeNull();
    });
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
