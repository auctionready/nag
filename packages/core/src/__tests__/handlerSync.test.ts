import { describe, it, expect, vi, beforeEach } from "vitest";
import { processCommand } from "../commands/processor";
import { syncAllNotifications } from "../notificationConsolidator";
import { setupTestDb } from "./testDb";
import { AllDays } from "../days";

vi.mock("../notificationConsolidator", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../notificationConsolidator")>();
  return {
    ...actual,
    syncAllNotifications: vi.fn(async () => {}),
  };
});

const mockSyncAll = vi.mocked(syncAllNotifications);
const getDb = setupTestDb("handler-sync-test.db");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handlers call syncAllNotifications", () => {
  it("CreateHabit (no goal)", async () => {
    await processCommand(getDb(), {
      type: "CreateHabit",
      habitId: crypto.randomUUID(),
      title: "Read",
    });
    expect(mockSyncAll).toHaveBeenCalledOnce();
    expect(mockSyncAll).toHaveBeenCalledWith(getDb());
  });

  it("CreateHabit (scheduled goal)", async () => {
    await processCommand(getDb(), {
      type: "CreateHabit",
      habitId: crypto.randomUUID(),
      title: "Read",
      goal: {
        regularity: "week",
        schedules: [{ hour: 8, minute: 0, days: AllDays, reminder: true }],
      },
    });
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });

  it("UpdateHabit", async () => {
    const habitId = crypto.randomUUID();
    await processCommand(getDb(), {
      type: "CreateHabit",
      habitId,
      title: "Read",
    });
    mockSyncAll.mockClear();
    await processCommand(getDb(), {
      type: "UpdateHabit",
      habitId,
      title: "Studying",
    });
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });

  it("DeleteHabit", async () => {
    const habitId = crypto.randomUUID();
    await processCommand(getDb(), {
      type: "CreateHabit",
      habitId,
      title: "Read",
    });
    mockSyncAll.mockClear();
    await processCommand(getDb(), { type: "DeleteHabit", habitId });
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });

  it("CreateCheckIn", async () => {
    const habitId = crypto.randomUUID();
    await processCommand(getDb(), {
      type: "CreateHabit",
      habitId,
      title: "Read",
    });
    mockSyncAll.mockClear();
    await processCommand(getDb(), {
      type: "CreateCheckIn",
      checkInId: crypto.randomUUID(),
      habitId,
      timestamp: new Date(),
    });
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });

  it("UpdateCheckIn", async () => {
    const habitId = crypto.randomUUID();
    await processCommand(getDb(), {
      type: "CreateHabit",
      habitId,
      title: "Read",
    });
    const checkInId = crypto.randomUUID();
    await processCommand(getDb(), {
      type: "CreateCheckIn",
      checkInId,
      habitId,
      timestamp: new Date(),
    });
    mockSyncAll.mockClear();
    await processCommand(getDb(), {
      type: "UpdateCheckIn",
      checkInId,
      timestamp: new Date(),
    });
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });

  it("DeleteCheckIn", async () => {
    const habitId = crypto.randomUUID();
    await processCommand(getDb(), {
      type: "CreateHabit",
      habitId,
      title: "Read",
    });
    const checkInId = crypto.randomUUID();
    await processCommand(getDb(), {
      type: "CreateCheckIn",
      checkInId,
      habitId,
      timestamp: new Date(),
    });
    mockSyncAll.mockClear();
    await processCommand(getDb(), { type: "DeleteCheckIn", checkInId });
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });

  it("is not called when validation fails before the handler runs", async () => {
    await expect(
      processCommand(getDb(), {
        type: "CreateHabit",
        habitId: crypto.randomUUID(),
        title: "",
      }),
    ).rejects.toBeDefined();
    expect(mockSyncAll).not.toHaveBeenCalled();
  });
});
