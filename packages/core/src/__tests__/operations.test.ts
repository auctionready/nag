import { describe, it, expect, vi, beforeEach } from "vitest";
import { setNotificationScheduler } from "../notifications";
import { createHabit, updateHabit, deleteHabit } from "../operations";
import { setupTestDb } from "./testDb";
import { habitById } from "../queries";

const getDb = setupTestDb("operations-test.db");

const mockScheduler = {
  cancelNotifications: vi.fn(async () => {}),
  syncNotifications: vi.fn(async () => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
  setNotificationScheduler(mockScheduler);
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
    it("does not call syncNotifications", () => {
      expect(mockScheduler.syncNotifications).not.toHaveBeenCalled();
    });
  });

  describe("with a frequency goal", () => {
    beforeEach(async () => {
      await createHabit(getDb(), {
        title: "Exercise",
        goal: { regularity: "day", frequency: 1 },
      });
    });
    it("does not call syncNotifications", () => {
      expect(mockScheduler.syncNotifications).not.toHaveBeenCalled();
    });
  });

  describe("with a scheduled goal", () => {
    let habitId: number;
    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), {
        title: "Exercise",
        goal: {
          regularity: "day",
          schedules: [{ hour: 9, minute: 0, reminder: true }],
        },
      }));
    });
    it("calls syncNotifications with the correct args", () => {
      expect(mockScheduler.syncNotifications).toHaveBeenCalledOnce();
      expect(mockScheduler.syncNotifications).toHaveBeenCalledWith(
        habitId,
        "Exercise",
        [{ hour: 9, minute: 0, reminder: true }],
        "day",
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
    it("does not call syncNotifications", () => {
      expect(mockScheduler.syncNotifications).not.toHaveBeenCalled();
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

  describe("with null goal", () => {
    let habitId: number;
    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
      vi.clearAllMocks();
      await updateHabit(getDb(), habitId, { title: "Exercise", goal: null });
    });
    it("cancels notifications", () => {
      expect(mockScheduler.cancelNotifications).toHaveBeenCalledWith(habitId);
    });
    it("does not call syncNotifications", () => {
      expect(mockScheduler.syncNotifications).not.toHaveBeenCalled();
    });
  });

  describe("with a scheduled goal with reminders", () => {
    let habitId: number;
    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
      vi.clearAllMocks();
      await updateHabit(getDb(), habitId, {
        title: "Exercise",
        goal: {
          regularity: "day",
          schedules: [{ hour: 8, minute: 30, reminder: true }],
        },
      });
    });
    it("calls syncNotifications with the correct args", () => {
      expect(mockScheduler.syncNotifications).toHaveBeenCalledOnce();
      expect(mockScheduler.syncNotifications).toHaveBeenCalledWith(
        habitId,
        "Exercise",
        [{ hour: 8, minute: 30, reminder: true }],
        "day",
      );
    });
  });

  describe("with all schedules having reminder: false", () => {
    let habitId: number;
    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
      vi.clearAllMocks();
      await updateHabit(getDb(), habitId, {
        title: "Exercise",
        goal: {
          regularity: "day",
          schedules: [{ hour: 8, minute: 30, reminder: false }],
        },
      });
    });
    it("cancels notifications", () => {
      expect(mockScheduler.cancelNotifications).toHaveBeenCalledWith(habitId);
    });
    it("does not call syncNotifications", () => {
      expect(mockScheduler.syncNotifications).not.toHaveBeenCalled();
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
    it("cancels notifications", () => {
      expect(mockScheduler.cancelNotifications).toHaveBeenCalledWith(habitId);
    });
  });
});

describe("error paths", () => {
  const scheduledGoalInput = {
    title: "Exercise",
    goal: {
      regularity: "day" as const,
      schedules: [{ hour: 9, minute: 0, reminder: true }],
    },
  };

  describe("when syncNotifications throws during createHabit", () => {
    beforeEach(() => {
      mockScheduler.syncNotifications.mockRejectedValueOnce(
        new Error("Permission denied"),
      );
    });

    it("propagates the error", async () => {
      await expect(createHabit(getDb(), scheduledGoalInput)).rejects.toThrow(
        "Permission denied",
      );
    });

    it("still creates the habit in the database", async () => {
      const { allHabits } = await import("../queries");
      const before = await allHabits(getDb());
      try {
        await createHabit(getDb(), scheduledGoalInput);
      } catch {
        // expected
      }
      const after = await allHabits(getDb());
      expect(after.length).toBe(before.length + 1);
      expect(after[after.length - 1].title).toBe("Exercise");
    });
  });

  describe("when syncNotifications throws during updateHabit", () => {
    let habitId: number;

    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
      mockScheduler.syncNotifications.mockRejectedValueOnce(
        new Error("Sync failed"),
      );
    });

    it("propagates the error", async () => {
      await expect(
        updateHabit(getDb(), habitId, {
          title: "Exercise",
          goal: {
            regularity: "day",
            schedules: [{ hour: 8, minute: 0, reminder: true }],
          },
        }),
      ).rejects.toThrow("Sync failed");
    });
  });

  describe("when cancelNotifications throws during deleteHabit", () => {
    let habitId: number;

    beforeEach(async () => {
      ({ habitId } = await createHabit(getDb(), { title: "Exercise" }));
      vi.clearAllMocks();
      mockScheduler.cancelNotifications.mockRejectedValueOnce(
        new Error("Cancel failed"),
      );
    });

    it("propagates the error", async () => {
      await expect(deleteHabit(getDb(), habitId)).rejects.toThrow(
        "Cancel failed",
      );
    });

    it("does not delete the habit", async () => {
      try {
        await deleteHabit(getDb(), habitId);
      } catch {
        // expected
      }
      const rows = await habitById(getDb(), habitId);
      expect(rows).toHaveLength(1);
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
