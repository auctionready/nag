import { describe, it, expect } from "vitest";
import { habitStatus } from "../tables/habit";

describe("habitStatus", () => {
  it("is active when neither flag is set", () => {
    expect(habitStatus({})).toBe("active");
    expect(habitStatus({ archivedAt: null, pausedAt: null })).toBe("active");
  });

  it("is paused when only pausedAt is set", () => {
    expect(habitStatus({ pausedAt: new Date() })).toBe("paused");
  });

  it("is archived when archivedAt is set", () => {
    expect(habitStatus({ archivedAt: new Date() })).toBe("archived");
  });

  it("treats archived as taking precedence over paused", () => {
    expect(habitStatus({ archivedAt: new Date(), pausedAt: new Date() })).toBe(
      "archived",
    );
  });
});
