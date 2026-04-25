import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { identity } from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import {
  ensureDeviceRegistered,
  refreshDeviceToken,
  loadIdentity,
  getAccountId,
  type TokenStore,
} from "../identity";
import type { RegisterDeviceResult } from "../types";

const getDb = setupTestDb("identity-test.db");

const newDeviceId = () => "11111111-2222-4333-8444-555555555555";

class InMemoryTokenStore implements TokenStore {
  constructor(private value: string | null = null) {}
  async get(): Promise<string | null> {
    return this.value;
  }
  async set(token: string): Promise<void> {
    this.value = token;
  }
  async clear(): Promise<void> {
    this.value = null;
  }
}

describe("ensureDeviceRegistered", () => {
  it("on first launch: generates a deviceId, registers, persists accountId in SQLite and token in tokenStore", async () => {
    const db = getDb();
    await db.delete(identity); // simulate fresh install

    const tokenStore = new InMemoryTokenStore();
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
      tokenStore,
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
    });
    expect(await tokenStore.get()).toBe("tok-from-server");
  });

  describe("when already registered", () => {
    it("does not call register and returns the cached accountId + token", async () => {
      const db = getDb();
      const tokenStore = new InMemoryTokenStore("cached-tok");

      const register = vi.fn(async (): Promise<RegisterDeviceResult> => {
        throw new Error(
          "register should not be called when already registered",
        );
      });

      const result = await ensureDeviceRegistered({
        db,
        tokenStore,
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
      const tokenStore = new InMemoryTokenStore();

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
        tokenStore,
        register,
        newDeviceId,
      });

      expect(register).toHaveBeenCalledWith({ deviceId: persistedDeviceId });
      expect(result.deviceId).toBe(persistedDeviceId);
      expect(result.accountId).toBe("acc-on-retry");
      expect(result.deviceToken).toBe("tok-on-retry");
      expect(await tokenStore.get()).toBe("tok-on-retry");
    });

    it("on a transient failure: leaves accountId null and the tokenStore empty", async () => {
      const db = getDb();
      await db.delete(identity);
      const tokenStore = new InMemoryTokenStore();

      const register = vi.fn(
        async (): Promise<RegisterDeviceResult> => ({
          ok: false,
          kind: "transient",
          message: "network down",
        }),
      );

      const result = await ensureDeviceRegistered({
        db,
        tokenStore,
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

      // deviceId is persisted so the next boot can retry; the token
      // store is untouched.
      const [row] = await db.select().from(identity).where(eq(identity.id, 1));
      expect(row.deviceId).toBe(newDeviceId());
      expect(row.accountId).toBeNull();
      expect(await tokenStore.get()).toBeNull();
    });

    it("on a non-retriable failure: still leaves accountId null (next boot retries)", async () => {
      const db = getDb();
      await db.delete(identity);
      const tokenStore = new InMemoryTokenStore();

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
        tokenStore,
        register,
        newDeviceId,
      });

      expect(result.accountId).toBeNull();
      expect(result.deviceToken).toBeNull();
      expect(await tokenStore.get()).toBeNull();
    });
  });

  describe("when migrating from a pre-token install", () => {
    it("re-registers to fetch a deviceToken even though SQLite already has an accountId", async () => {
      // SQLite row carries deviceId + accountId from before phase 2c,
      // but the SecureStore has no token (or was wiped).
      const db = getDb();
      await db
        .update(identity)
        .set({
          accountId: "legacy-acc",
          registeredAt: new Date("2026-01-01T00:00:00.000Z"),
        })
        .where(eq(identity.id, 1));
      const tokenStore = new InMemoryTokenStore();

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
        tokenStore,
        register,
        newDeviceId,
      });

      expect(register).toHaveBeenCalled();
      expect(result.deviceToken).toBe("newly-issued-tok");
      expect(await tokenStore.get()).toBe("newly-issued-tok");
    });
  });
});

describe("refreshDeviceToken", () => {
  it("re-registers using the persisted deviceId and updates the tokenStore", async () => {
    const db = getDb();
    const seeded = await loadIdentity(db);
    expect(seeded).not.toBeNull();
    const persistedDeviceId = seeded!.deviceId;
    const tokenStore = new InMemoryTokenStore("stale-tok");

    const register = vi.fn(
      async (): Promise<RegisterDeviceResult> => ({
        ok: true,
        accountId: seeded!.accountId!,
        registeredAt: new Date("2026-04-26T00:00:00.000Z"),
        deviceToken: "rotated-tok",
      }),
    );

    const newToken = await refreshDeviceToken({ db, tokenStore, register });

    expect(register).toHaveBeenCalledWith({ deviceId: persistedDeviceId });
    expect(newToken).toBe("rotated-tok");
    expect(await tokenStore.get()).toBe("rotated-tok");

    const after = await loadIdentity(db);
    expect(after?.registeredAt?.toISOString()).toBe("2026-04-26T00:00:00.000Z");
  });

  it("returns null without touching the tokenStore when register fails", async () => {
    const db = getDb();
    const tokenStore = new InMemoryTokenStore("stale-tok");

    const register = vi.fn(
      async (): Promise<RegisterDeviceResult> => ({
        ok: false,
        kind: "transient",
        message: "offline",
      }),
    );

    const newToken = await refreshDeviceToken({ db, tokenStore, register });

    expect(newToken).toBeNull();
    expect(await tokenStore.get()).toBe("stale-tok");
  });

  it("returns null when no identity row exists", async () => {
    const db = getDb();
    await db.delete(identity);
    const tokenStore = new InMemoryTokenStore();

    const register = vi.fn();

    const newToken = await refreshDeviceToken({ db, tokenStore, register });

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
