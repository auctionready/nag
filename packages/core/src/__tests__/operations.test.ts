import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHabit, updateHabit, deleteHabit } from "../operations";
import { setupTestDb } from "./testDb";
import { habitById } from "../queries";
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
