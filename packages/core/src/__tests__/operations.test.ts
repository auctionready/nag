import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCheckIn,
  createHabit,
  deleteCheckIn,
  deleteHabit,
  updateCheckIn,
  updateHabit,
} from "../operations";
import { setupTestDb } from "./testDb";
import { checkInsForHabit, habitById } from "../queries";
import { syncAllNotifications } from "../notificationConsolidator";

vi.mock("../notificationConsolidator", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../notificationConsolidator")>();
  return {
    ...actual,
    syncAllNotifications: vi.fn(async () => {}),
  };
});

const mockSyncAll = vi.mocked(syncAllNotifications);

const getDb = setupTestDb("operations-test.db");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createHabit", () => {
  describe("with no goal", () => {
    let habitId: number;
    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
    });
    it("creates the habit in the database", async () => {
      const rows = await habitById(getDb(), habitId);
      expect(rows[0].title).toBe("Exercise");
    });
    it("calls syncAllNotifications", () => {
      expect(mockSyncAll).toHaveBeenCalledOnce();
      expect(mockSyncAll).toHaveBeenCalledWith(getDb());
    });
  });

  describe("with a frequency goal", () => {
    beforeEach(async () => {
      await createHabit(getDb(), {
        title: "Exercise",
        goal: { regularity: "day", frequency: 1 },
      });
    });
    it("calls syncAllNotifications", () => {
      expect(mockSyncAll).toHaveBeenCalledOnce();
    });
  });

  describe("with a scheduled goal", () => {
    beforeEach(async () => {
      await createHabit(getDb(), {
        title: "Exercise",
        goal: {
          regularity: "day",
          schedules: [{ hour: 9, minute: 0, reminder: true }],
        },
      });
    });
    it("calls syncAllNotifications", () => {
      expect(mockSyncAll).toHaveBeenCalledOnce();
      expect(mockSyncAll).toHaveBeenCalledWith(getDb());
    });
  });

  describe("with all schedules having reminder: false", () => {
    beforeEach(async () => {
      await createHabit(getDb(), {
        title: "Exercise",
        goal: {
          regularity: "day",
          schedules: [{ hour: 9, minute: 0, reminder: false }],
        },
      });
    });
    it("calls syncAllNotifications", () => {
      expect(mockSyncAll).toHaveBeenCalledOnce();
    });
  });
});

describe("updateHabit", () => {
  describe("updating title only", () => {
    let habitId: number;
    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
      vi.clearAllMocks();
      await updateHabit(getDb(), habitId, { title: "Run" });
    });
    it("updates the title in the database", async () => {
      const rows = await habitById(getDb(), habitId);
      expect(rows[0].title).toBe("Run");
    });
    it("calls syncAllNotifications", () => {
      expect(mockSyncAll).toHaveBeenCalledOnce();
    });
  });

  describe("with a scheduled goal with reminders", () => {
    beforeEach(async () => {
      const { habitId } = await createHabit(getDb(), { title: "Exercise" });
      vi.clearAllMocks();
      await updateHabit(getDb(), habitId, {
        title: "Exercise",
        goal: {
          regularity: "day",
          schedules: [{ hour: 8, minute: 30, reminder: true }],
        },
      });
    });
    it("calls syncAllNotifications", () => {
      expect(mockSyncAll).toHaveBeenCalledOnce();
    });
  });
});

describe("deleteHabit", () => {
  describe("an existing habit", () => {
    let habitId: number;
    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
      vi.clearAllMocks();
      await deleteHabit(getDb(), habitId);
    });
    it("removes the habit from the database", async () => {
      const rows = await habitById(getDb(), habitId);
      expect(rows).toHaveLength(0);
    });
    it("calls syncAllNotifications", () => {
      expect(mockSyncAll).toHaveBeenCalledOnce();
    });
  });
});

describe("error paths", () => {
  describe("when syncAllNotifications throws during createHabit", () => {
    beforeEach(() => {
      mockSyncAll.mockRejectedValueOnce(new Error("Permission denied"));
    });

    it("propagates the error", async () => {
      await expect(
        createHabit(getDb(), {
          title: "Exercise",
          goal: {
            regularity: "day",
            schedules: [{ hour: 9, minute: 0, reminder: true }],
          },
        }),
      ).rejects.toThrow("Permission denied");
    });

    it("still creates the habit in the database", async () => {
      const { allHabits } = await import("../queries");
      const before = await allHabits(getDb());
      try {
        await createHabit(getDb(), {
          title: "Exercise",
          goal: {
            regularity: "day",
            schedules: [{ hour: 9, minute: 0, reminder: true }],
          },
        });
      } catch {
        // expected
      }
      const after = await allHabits(getDb());
      expect(after.length).toBe(before.length + 1);
    });
  });
});

describe("createCheckIn", () => {
  let habitId: number;
  beforeEach(async () => {
    ({ habitId } = await createHabit(getDb(), { title: "Read" }));
    vi.clearAllMocks();
  });

  it("persists the check-in", async () => {
    await createCheckIn(getDb(), { habitId, timestamp: new Date() });
    const rows = await checkInsForHabit(getDb(), habitId);
    expect(rows).toHaveLength(1);
    expect(rows[0].skipped).toBe(false);
  });

  it("honours the skipped flag", async () => {
    await createCheckIn(getDb(), {
      habitId,
      timestamp: new Date(),
      skipped: true,
    });
    const rows = await checkInsForHabit(getDb(), habitId);
    expect(rows[0].skipped).toBe(true);
  });

  it("calls syncAllNotifications", async () => {
    await createCheckIn(getDb(), { habitId, timestamp: new Date() });
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });
});

describe("updateCheckIn", () => {
  it("updates the check-in and calls syncAllNotifications", async () => {
    const { habitId } = await createHabit(getDb(), { title: "Read" });
    const { checkInId } = await createCheckIn(getDb(), {
      habitId,
      timestamp: new Date(2025, 0, 1, 8, 0),
    });
    vi.clearAllMocks();

    const newTime = new Date(2025, 0, 1, 9, 0);
    await updateCheckIn(getDb(), { checkInId, timestamp: newTime });

    const rows = await checkInsForHabit(getDb(), habitId);
    expect(rows[0].timestamp.getTime()).toBe(newTime.getTime());
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });
});

describe("deleteCheckIn", () => {
  it("deletes the check-in and calls syncAllNotifications", async () => {
    const { habitId } = await createHabit(getDb(), { title: "Read" });
    const { checkInId } = await createCheckIn(getDb(), {
      habitId,
      timestamp: new Date(),
    });
    vi.clearAllMocks();

    await deleteCheckIn(getDb(), checkInId);

    const rows = await checkInsForHabit(getDb(), habitId);
    expect(rows).toHaveLength(0);
    expect(mockSyncAll).toHaveBeenCalledOnce();
  });
});

describe("createHabit with description", () => {
  let habitId: number;

  beforeEach(async () => {
    ({ habitId } = await createHabit(getDb(), {
      title: "Read",
      description: "Read for 30 minutes",
    }));
  });

  it("persists description to the database", async () => {
    const rows = await habitById(getDb(), habitId);
    expect(rows[0].description).toBe("Read for 30 minutes");
  });
});
