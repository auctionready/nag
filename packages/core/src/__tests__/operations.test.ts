import { describe, it, expect, vi, beforeEach } from "vitest";
import { setConsolidatedScheduler } from "../notificationConsolidator";
import { createHabit, updateHabit, deleteHabit } from "../operations";
import { setupTestDb } from "./testDb";
import { habitById } from "../queries";

const getDb = setupTestDb("operations-test.db");

const mockConsolidatedScheduler = {
  cancelAllSlotNotifications: vi.fn(async () => {}),
  scheduleSlotNotification: vi.fn(async () => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
  setConsolidatedScheduler(mockConsolidatedScheduler);
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
    it("calls cancelAllSlotNotifications as part of syncAll", () => {
      expect(
        mockConsolidatedScheduler.cancelAllSlotNotifications,
      ).toHaveBeenCalled();
    });
  });

  describe("with a frequency goal", () => {
    beforeEach(async () => {
      await createHabit(getDb(), {
        title: "Exercise",
        goal: { regularity: "day", frequency: 1 },
      });
    });
    it("does not schedule slot notifications (no schedules)", () => {
      expect(
        mockConsolidatedScheduler.scheduleSlotNotification,
      ).not.toHaveBeenCalled();
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
    it("schedules a consolidated slot notification", () => {
      expect(
        mockConsolidatedScheduler.scheduleSlotNotification,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: "slot-daily-09-00",
          title: "Exercise",
          body: "Time for Exercise",
          data: expect.objectContaining({
            habitIds: expect.arrayContaining([expect.any(Number)]),
          }),
        }),
      );
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
    it("does not schedule slot notifications", () => {
      expect(
        mockConsolidatedScheduler.scheduleSlotNotification,
      ).not.toHaveBeenCalled();
    });
  });
});

describe("updateHabit", () => {
  describe("updating title only", () => {
    let habitId: number;
    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
      await updateHabit(getDb(), habitId, { title: "Run" });
    });
    it("updates the title in the database", async () => {
      const rows = await habitById(getDb(), habitId);
      expect(rows[0].title).toBe("Run");
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
    it("syncs all consolidated notifications", () => {
      expect(
        mockConsolidatedScheduler.cancelAllSlotNotifications,
      ).toHaveBeenCalled();
      expect(
        mockConsolidatedScheduler.scheduleSlotNotification,
      ).toHaveBeenCalled();
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
    it("syncs all notifications after delete", () => {
      expect(
        mockConsolidatedScheduler.cancelAllSlotNotifications,
      ).toHaveBeenCalled();
    });
  });
});

describe("error paths", () => {
  describe("when syncAll throws during createHabit", () => {
    beforeEach(() => {
      mockConsolidatedScheduler.cancelAllSlotNotifications.mockRejectedValueOnce(
        new Error("Permission denied"),
      );
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
