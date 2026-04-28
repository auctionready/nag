import { describe, it, expect } from "vitest";
import { Event, EventTypeNames } from "../schemas";

const habitId = "00000000-0000-4000-8000-000000000001";
const checkInId = "00000000-0000-4000-8000-000000000002";

describe("EventTypeNames", () => {
  it("matches the server's EventRegistry.ByName keys (server kept in sync manually)", () => {
    // Sentinel — this list mirrors `backend/Nag.Core/Contracts/EventRegistry.cs`.
    // If the server adds an event type, add it here too (and to the
    // discriminated union below).
    expect([...EventTypeNames]).toEqual([
      "HabitCreated",
      "HabitDetailsEdited",
      "HabitGoalDefined",
      "HabitGoalCleared",
      "HabitDeleted",
      "CheckInRecorded",
      "CheckInMoved",
      "CheckInMarkedSkipped",
      "CheckInMarkedDone",
      "CheckInDeleted",
    ]);
  });
});

describe("Event discriminated union", () => {
  it("parses HabitCreated with optional goal", () => {
    const parsed = Event.parse({
      type: "HabitCreated",
      habitId,
      title: "Read",
      goal: { regularity: "day", frequency: 1 },
    });
    expect(parsed.type).toBe("HabitCreated");
    if (parsed.type === "HabitCreated") {
      expect(parsed.title).toBe("Read");
      expect(parsed.goal?.frequency).toBe(1);
    }
  });

  it("parses CheckInRecorded and coerces ISO timestamps to Date", () => {
    const parsed = Event.parse({
      type: "CheckInRecorded",
      checkInId,
      habitId,
      timestamp: "2026-04-22T08:00:00.000Z",
      skipped: false,
    });
    expect(parsed.type).toBe("CheckInRecorded");
    if (parsed.type === "CheckInRecorded") {
      expect(parsed.timestamp).toBeInstanceOf(Date);
      expect(parsed.timestamp.toISOString()).toBe("2026-04-22T08:00:00.000Z");
    }
  });

  it("parses CheckInMoved carrying both old and new timestamps", () => {
    const parsed = Event.parse({
      type: "CheckInMoved",
      checkInId,
      habitId,
      oldTimestamp: "2026-04-20T08:00:00.000Z",
      newTimestamp: "2026-04-22T18:30:00.000Z",
    });
    expect(parsed.type).toBe("CheckInMoved");
    if (parsed.type === "CheckInMoved") {
      expect(parsed.oldTimestamp.toISOString()).toBe(
        "2026-04-20T08:00:00.000Z",
      );
      expect(parsed.newTimestamp.toISOString()).toBe(
        "2026-04-22T18:30:00.000Z",
      );
    }
  });

  it("parses CheckInDeleted with the deleted timestamp", () => {
    const parsed = Event.parse({
      type: "CheckInDeleted",
      checkInId,
      habitId,
      timestamp: "2026-04-22T08:00:00.000Z",
    });
    expect(parsed.type).toBe("CheckInDeleted");
  });

  it("parses HabitDetailsEdited with explicit clear flags", () => {
    const parsed = Event.parse({
      type: "HabitDetailsEdited",
      habitId,
      title: "Read more",
      clearDescription: true,
      clearIcon: false,
    });
    expect(parsed.type).toBe("HabitDetailsEdited");
    if (parsed.type === "HabitDetailsEdited") {
      expect(parsed.title).toBe("Read more");
      expect(parsed.clearDescription).toBe(true);
    }
  });

  it("rejects an unknown event type", () => {
    expect(() => Event.parse({ type: "NoSuchEvent", habitId })).toThrow();
  });

  it("rejects a non-uuid habitId", () => {
    expect(() =>
      Event.parse({ type: "HabitDeleted", habitId: "not-a-uuid" }),
    ).toThrow();
  });
});
