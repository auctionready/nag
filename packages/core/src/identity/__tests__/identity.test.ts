import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  identity,
  habit,
  goal,
  schedule,
  checkIn,
  outbox,
  syncState,
} from "@nag/schema";
import { setupTestDb } from "../../__tests__/testDb";
import {
  ensureDeviceRegistered,
  refreshDeviceToken,
  loadIdentity,
  getAccountId,
  switchLocalAccount,
  clearLocalAuth,
  resetLocalAccount,
  type TokenStore,
} from "../identity";
import { ensureDevAuthRegistered } from "../devAuth";
import type { DevTokenResult, RegisterDeviceResult } from "../types";

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
      idpSubject: null,
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

  describe("when sync was previously halted", () => {
    it("clears the halted flag after a successful registration", async () => {
      const db = getDb();
      await db.delete(identity);
      await db
        .update(syncState)
        .set({ halted: true })
        .where(eq(syncState.id, 1));
      const tokenStore = new InMemoryTokenStore();

      const register = vi.fn(
        async (): Promise<RegisterDeviceResult> => ({
          ok: true,
          accountId: "acc-after-halt",
          registeredAt: new Date("2026-04-25T00:00:00.000Z"),
          deviceToken: "tok-after-halt",
        }),
      );

      await ensureDeviceRegistered({ db, tokenStore, register, newDeviceId });

      const [s] = await db
        .select({ halted: syncState.halted })
        .from(syncState)
        .where(eq(syncState.id, 1));
      expect(s?.halted).toBe(false);
    });

    it("leaves the halted flag set when registration fails", async () => {
      const db = getDb();
      await db.delete(identity);
      await db
        .update(syncState)
        .set({ halted: true })
        .where(eq(syncState.id, 1));
      const tokenStore = new InMemoryTokenStore();

      const register = vi.fn(
        async (): Promise<RegisterDeviceResult> => ({
          ok: false,
          kind: "transient",
          message: "network down",
        }),
      );

      await ensureDeviceRegistered({ db, tokenStore, register, newDeviceId });

      const [s] = await db
        .select({ halted: syncState.halted })
        .from(syncState)
        .where(eq(syncState.id, 1));
      expect(s?.halted).toBe(true);
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

  it("clears the halted flag after a successful refresh", async () => {
    const db = getDb();
    await db.update(syncState).set({ halted: true }).where(eq(syncState.id, 1));
    const tokenStore = new InMemoryTokenStore("stale-tok");

    const seeded = await loadIdentity(db);
    const register = vi.fn(
      async (): Promise<RegisterDeviceResult> => ({
        ok: true,
        accountId: seeded!.accountId!,
        registeredAt: new Date("2026-04-26T00:00:00.000Z"),
        deviceToken: "rotated-tok",
      }),
    );

    await refreshDeviceToken({ db, tokenStore, register });

    const [s] = await db
      .select({ halted: syncState.halted })
      .from(syncState)
      .where(eq(syncState.id, 1));
    expect(s?.halted).toBe(false);
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

describe("switchLocalAccount", () => {
  it("rewires identity to the new accountId, wipes replicated tables and outbox, and resets sync state", async () => {
    const db = getDb();
    const tokenStore = new InMemoryTokenStore("old-tok");

    // Seed some local data that should be discarded on switch.
    const [{ habitId }] = await db
      .insert(habit)
      .values({ id: crypto.randomUUID(), title: "Old habit" })
      .returning({ habitId: habit.id });
    const [{ goalId }] = await db
      .insert(goal)
      .values({ habitId, regularity: "day", frequency: 1 })
      .returning({ goalId: goal.id });
    await db.insert(schedule).values({
      goalId,
      hour: 9,
      minute: 0,
      days: 0b0111110,
      dayOfMonth: null,
      reminder: true,
    });
    await db.insert(checkIn).values({
      id: crypto.randomUUID(),
      habitId,
      timestamp: new Date("2026-04-01T08:00:00.000Z"),
      skipped: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(outbox).values({
      id: "00000000-0000-4000-8000-0000000000aa",
      events: "[]",
      status: "pending",
    });
    await db
      .update(syncState)
      .set({ halted: true, highestServerSequence: 99 })
      .where(eq(syncState.id, 1));

    await switchLocalAccount({
      db,
      tokenStore,
      newAccountId: "00000000-0000-4000-8000-0000000000bb",
      newDeviceToken: "new-tok",
      registeredAt: new Date("2026-05-02T12:00:00.000Z"),
    });

    const after = await loadIdentity(db);
    expect(after?.accountId).toBe("00000000-0000-4000-8000-0000000000bb");
    expect(after?.registeredAt?.toISOString()).toBe("2026-05-02T12:00:00.000Z");
    // deviceId is intentionally preserved — server's /devices/pair just
    // re-parents the existing Device row.
    expect(after?.deviceId).toBe("00000000-0000-4000-8000-000000000001");

    expect(await db.select().from(habit)).toHaveLength(0);
    expect(await db.select().from(goal)).toHaveLength(0);
    expect(await db.select().from(schedule)).toHaveLength(0);
    expect(await db.select().from(checkIn)).toHaveLength(0);
    expect(await db.select().from(outbox)).toHaveLength(0);

    const [s] = await db.select().from(syncState).where(eq(syncState.id, 1));
    expect(s.halted).toBe(false);
    expect(s.highestServerSequence).toBe(0);

    expect(await tokenStore.get()).toBe("new-tok");
  });
});

describe("clearLocalAuth", () => {
  it("nulls accountId/registeredAt and clears the tokenStore but keeps deviceId and replicated data", async () => {
    const db = getDb();
    const tokenStore = new InMemoryTokenStore("device-tok");

    // Seed user data that must survive sign-out.
    const [{ habitId }] = await db
      .insert(habit)
      .values({ id: crypto.randomUUID(), title: "Surviving habit" })
      .returning({ habitId: habit.id });
    await db.insert(goal).values({ habitId, regularity: "day", frequency: 1 });
    await db.insert(checkIn).values({
      id: crypto.randomUUID(),
      habitId,
      timestamp: new Date("2026-04-15T08:00:00.000Z"),
      skipped: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(outbox).values({
      id: "00000000-0000-4000-8000-0000000000ab",
      events: "[]",
      status: "pending",
    });
    await db
      .update(syncState)
      .set({ halted: false, highestServerSequence: 42 })
      .where(eq(syncState.id, 1));

    const before = await loadIdentity(db);
    expect(before?.deviceId).toBe("00000000-0000-4000-8000-000000000001");
    expect(before?.accountId).toBe("00000000-0000-4000-8000-0000000000aa");

    await clearLocalAuth({ db, tokenStore });

    const after = await loadIdentity(db);
    expect(after?.deviceId).toBe("00000000-0000-4000-8000-000000000001");
    expect(after?.accountId).toBeNull();
    expect(after?.registeredAt).toBeNull();
    expect(await tokenStore.get()).toBeNull();

    // Local data and the unflushed outbox row are intentionally preserved
    // — the user is still expected to see their habits after signing out.
    expect(await db.select().from(habit)).toHaveLength(1);
    expect(await db.select().from(goal)).toHaveLength(1);
    expect(await db.select().from(checkIn)).toHaveLength(1);
    expect(await db.select().from(outbox)).toHaveLength(1);
    const [s] = await db.select().from(syncState).where(eq(syncState.id, 1));
    expect(s.highestServerSequence).toBe(42);
  });
});

describe("resetLocalAccount", () => {
  it("wipes user data + outbox, resets syncState, and clears the identity binding while keeping deviceId", async () => {
    const db = getDb();
    const tokenStore = new InMemoryTokenStore("device-tok");

    // Seed everything `resetLocalAccount` is supposed to scrub.
    const [{ habitId }] = await db
      .insert(habit)
      .values({ id: crypto.randomUUID(), title: "Old habit" })
      .returning({ habitId: habit.id });
    await db.insert(goal).values({ habitId, regularity: "day", frequency: 1 });
    await db.insert(checkIn).values({
      id: crypto.randomUUID(),
      habitId,
      timestamp: new Date("2026-04-15T08:00:00.000Z"),
      skipped: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(outbox).values({
      id: "00000000-0000-4000-8000-0000000000cd",
      events: "[]",
      status: "pending",
    });
    await db
      .update(syncState)
      .set({ halted: true, highestServerSequence: 99 })
      .where(eq(syncState.id, 1));

    const before = await loadIdentity(db);
    const originalDeviceId = before?.deviceId;
    expect(originalDeviceId).toBeTruthy();

    await resetLocalAccount({ db, tokenStore });

    // Identity row keeps deviceId; everything else is null.
    const after = await loadIdentity(db);
    expect(after?.deviceId).toBe(originalDeviceId);
    expect(after?.accountId).toBeNull();
    expect(after?.registeredAt).toBeNull();
    expect(after?.idpSubject).toBeNull();
    expect(await tokenStore.get()).toBeNull();

    // Replicated tables + outbox are empty — fresh start.
    expect(await db.select().from(habit)).toHaveLength(0);
    expect(await db.select().from(goal)).toHaveLength(0);
    expect(await db.select().from(checkIn)).toHaveLength(0);
    expect(await db.select().from(outbox)).toHaveLength(0);
    const [s] = await db.select().from(syncState).where(eq(syncState.id, 1));
    expect(s.halted).toBe(false);
    expect(s.highestServerSequence).toBe(0);
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

describe("ensureDevAuthRegistered", () => {
  const DEV_ACCOUNT = "11111111-1111-4111-8111-111111111111";
  const DEV_DEVICE = "22222222-2222-4222-8222-222222222222";

  it("on first launch: persists the server-supplied dev pair and token", async () => {
    const db = getDb();
    await db.delete(identity); // simulate fresh install — no row yet

    const tokenStore = new InMemoryTokenStore();
    const fetchDevToken = vi.fn(
      async (): Promise<DevTokenResult> => ({
        ok: true,
        accountId: DEV_ACCOUNT,
        deviceId: DEV_DEVICE,
        deviceToken: "dev-tok",
      }),
    );

    const result = await ensureDevAuthRegistered({
      db,
      tokenStore,
      fetchDevToken,
    });

    expect(fetchDevToken).toHaveBeenCalledOnce();
    expect(result.accountId).toBe(DEV_ACCOUNT);
    expect(result.deviceId).toBe(DEV_DEVICE);
    expect(result.deviceToken).toBe("dev-tok");

    const persisted = await loadIdentity(db);
    expect(persisted?.deviceId).toBe(DEV_DEVICE);
    expect(persisted?.accountId).toBe(DEV_ACCOUNT);
    expect(persisted?.registeredAt).toBeInstanceOf(Date);
    expect(await tokenStore.get()).toBe("dev-tok");
  });

  it("overwrites a locally-generated deviceId with the server's dev deviceId", async () => {
    const db = getDb();
    await db.delete(identity);
    // Simulate a prior anonymous registration that minted its own
    // deviceId — dev-auth must replace it with the fixed server pair.
    await db.insert(identity).values({
      id: 1,
      deviceId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      accountId: null,
    });

    const tokenStore = new InMemoryTokenStore();
    const fetchDevToken = vi.fn(
      async (): Promise<DevTokenResult> => ({
        ok: true,
        accountId: DEV_ACCOUNT,
        deviceId: DEV_DEVICE,
        deviceToken: "dev-tok",
      }),
    );

    await ensureDevAuthRegistered({ db, tokenStore, fetchDevToken });

    const persisted = await loadIdentity(db);
    expect(persisted?.deviceId).toBe(DEV_DEVICE);
    expect(persisted?.accountId).toBe(DEV_ACCOUNT);
  });

  it("when already registered (accountId + token cached): no-op", async () => {
    const db = getDb();
    await db.delete(identity);
    await db.insert(identity).values({
      id: 1,
      deviceId: DEV_DEVICE,
      accountId: DEV_ACCOUNT,
      registeredAt: new Date("2026-04-25T00:00:00.000Z"),
    });
    const tokenStore = new InMemoryTokenStore("cached-tok");

    const fetchDevToken = vi.fn(async (): Promise<DevTokenResult> => {
      throw new Error("fetchDevToken should not be called when cached");
    });

    const result = await ensureDevAuthRegistered({
      db,
      tokenStore,
      fetchDevToken,
    });

    expect(fetchDevToken).not.toHaveBeenCalled();
    expect(result.accountId).toBe(DEV_ACCOUNT);
    expect(result.deviceToken).toBe("cached-tok");
    expect(result.result).toEqual({ ok: true, cached: true });
  });

  it("on a non-retriable failure (e.g. /dev/token 404'd in non-DEBUG): leaves accountId null", async () => {
    const db = getDb();
    await db.delete(identity);
    const tokenStore = new InMemoryTokenStore();

    const fetchDevToken = vi.fn(
      async (): Promise<DevTokenResult> => ({
        ok: false,
        kind: "non-retriable",
        status: 404,
        message: "Not Found",
      }),
    );

    const result = await ensureDevAuthRegistered({
      db,
      tokenStore,
      fetchDevToken,
    });

    expect(result.accountId).toBeNull();
    expect(result.deviceToken).toBeNull();
    expect(await tokenStore.get()).toBeNull();
    // Identity row was empty before; failure shouldn't fabricate one.
    expect(await loadIdentity(db)).toBeNull();
  });
});
