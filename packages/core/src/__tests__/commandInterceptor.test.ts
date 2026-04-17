import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  processCommand,
  setPostCommandInterceptor,
  type PostCommandInterceptor,
} from "../commands/processor";
import { allHabits, habitById } from "../queries";
import { setupTestDb } from "./testDb";

const getDb = setupTestDb("command-interceptor-test.db");

const interceptor = vi.fn<PostCommandInterceptor>(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  setPostCommandInterceptor(interceptor);
});

afterAll(() => {
  setPostCommandInterceptor(undefined);
});

describe("post-command interceptor", () => {
  it("fires once per successful command with the parsed command and db", async () => {
    const db = getDb();
    const { habitId } = await processCommand(db, {
      type: "CreateHabit",
      title: "Read",
    });

    expect(interceptor).toHaveBeenCalledOnce();
    const [passedDb, passedCommand] = interceptor.mock.calls[0];
    expect(passedDb).toBe(db);
    expect(passedCommand).toEqual({
      type: "CreateHabit",
      title: "Read",
    });
    expect(habitId).toBeGreaterThan(0);
  });

  it("does not fire when the command fails validation", async () => {
    await expect(
      processCommand(getDb(), {
        type: "CreateHabit",
        // Empty title violates the Zod schema at runtime.
        title: "",
      }),
    ).rejects.toBeDefined();
    expect(interceptor).not.toHaveBeenCalled();
  });

  it("propagates interceptor errors but leaves the command committed", async () => {
    interceptor.mockRejectedValueOnce(new Error("interceptor boom"));

    await expect(
      processCommand(getDb(), {
        type: "CreateHabit",
        title: "Stretch",
      }),
    ).rejects.toThrow("interceptor boom");

    const rows = await allHabits(getDb());
    expect(rows.some((r) => r.title === "Stretch")).toBe(true);
  });

  it("can be cleared by passing undefined", async () => {
    setPostCommandInterceptor(undefined);
    await processCommand(getDb(), {
      type: "CreateHabit",
      title: "Walk",
    });
    expect(interceptor).not.toHaveBeenCalled();
    // Re-register for subsequent tests in the block.
    setPostCommandInterceptor(interceptor);
  });

  it("fires for check-in commands too", async () => {
    const { habitId } = await processCommand(getDb(), {
      type: "CreateHabit",
      title: "Run",
    });
    interceptor.mockClear();

    await processCommand(getDb(), {
      type: "CreateCheckIn",
      habitId,
      timestamp: new Date(),
    });

    expect(interceptor).toHaveBeenCalledOnce();
    const [, cmd] = interceptor.mock.calls[0];
    expect(cmd).toMatchObject({ type: "CreateCheckIn", habitId });
    // Confirm the habit really exists (interceptor ran after commit).
    const rows = await habitById(getDb(), habitId);
    expect(rows).toHaveLength(1);
  });
});
