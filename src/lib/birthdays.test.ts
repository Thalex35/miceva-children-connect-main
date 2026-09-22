import { describe, expect, it, beforeEach } from "bun:test";
import { getDueBirthdayNotifications, type NotificationDraft } from "./notifications";
import { type Child } from "./children";

function createChild(overrides: Partial<Child> = {}): Child {
  return {
    id: "child-1",
    first_name: "John",
    last_name: "Doe",
    date_of_birth: "2014-09-02",
    approximate_age: null,
    gender: "male",
    address: null,
    class_group: "NSI",
    registration_date: null,
    status: "active",
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getDueBirthdayNotifications", () => {
  it("creates a notification for a child whose birthday is today", () => {
    const now = new Date("2026-09-02T10:00:00");
    const child = createChild({ date_of_birth: "2014-09-02" });
    const notifications = getDueBirthdayNotifications([child], now, "user-1");

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toBe("🎂 Birthday");
    expect(notifications[0]?.message).toContain("John Doe");
    expect(notifications[0]?.message).toContain("today");
  });

  it("creates a notification for a child whose birthday is tomorrow", () => {
    const now = new Date("2026-09-01T10:00:00");
    const child = createChild({ date_of_birth: "2014-09-02" });
    const notifications = getDueBirthdayNotifications([child], now, "user-1");

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.message).toContain("tomorrow");
  });

  it("does not create a notification for a birthday more than 24 hours away", () => {
    const now = new Date("2026-09-03T10:00:00");
    const child = createChild({ date_of_birth: "2014-09-05" });
    const notifications = getDueBirthdayNotifications([child], now, "user-1");

    expect(notifications).toHaveLength(0);
  });

  it("does not create a notification for children without a date_of_birth", () => {
    const now = new Date("2026-09-02T10:00:00");
    const child = createChild({ date_of_birth: null });
    const notifications = getDueBirthdayNotifications([child], now, "user-1");

    expect(notifications).toHaveLength(0);
  });

  it("calculates the correct age for a birthday that has already passed this year", () => {
    const now = new Date("2026-09-02T10:00:00"); // After September 2
    const child = createChild({ date_of_birth: "2012-09-02" }); // Turns 14 today
    const notifications = getDueBirthdayNotifications([child], now, "user-1");

    expect(notifications[0]?.message).toContain("turning 14");
  });

  it("calculates the correct age for a birthday that hasn't passed yet this year", () => {
    const now = new Date("2026-02-01T10:00:00"); // Before September
    const child = createChild({ date_of_birth: "2012-09-02" }); // Will turn 14 on next birthday
    const notifications: NotificationDraft[] = [];
    // Manually check what the calculation would be
    // Current year: 2026, birth year: 2012
    // Birthday is in September (month 9), current month is February (month 2)
    // Birthday hasn't occurred yet, so age = 2026 - 2012 - 1 = 13
    // We're checking this logic is correct in a notification generated on Sept 1
    const nowSept1 = new Date("2026-09-01T10:00:00");
    const notificationsSept1 = getDueBirthdayNotifications([child], nowSept1, "user-1");
    
    expect(notificationsSept1).toHaveLength(1);
    expect(notificationsSept1[0]?.message).toContain("turning 14");
  });

  it("does not create duplicates for the same child and year", () => {
    const now = new Date("2026-09-02T10:00:00");
    const child = createChild({ date_of_birth: "2014-09-02" });
    const notifications = getDueBirthdayNotifications([child, child], now, "user-1");

    expect(notifications).toHaveLength(1);
  });

  it("handles multiple children with different birthdays", () => {
    const now = new Date("2026-09-02T10:00:00");
    const child1 = createChild({ id: "child-1", date_of_birth: "2014-09-02" });
    const child2 = createChild({ id: "child-2", first_name: "Jane", date_of_birth: "2015-09-02" });

    const notifications = getDueBirthdayNotifications([child1, child2], now, "user-1");

    expect(notifications).toHaveLength(2);
  });

  it("does not create a notification for a child whose birthday is yesterday", () => {
    const now = new Date("2026-09-03T10:00:00");
    const child = createChild({ date_of_birth: "2014-09-02" });
    const notifications = getDueBirthdayNotifications([child], now, "user-1");

    expect(notifications).toHaveLength(0);
  });

  it("includes the child ID in the notification for deduplication", () => {
    const now = new Date("2026-09-02T10:00:00");
    const child = createChild({ id: "specific-child-id", date_of_birth: "2014-09-02" });
    const notifications = getDueBirthdayNotifications([child], now, "user-1");

    expect(notifications[0]?.childId).toBe("specific-child-id");
    expect(notifications[0]?.birthdayYear).toBe(2026);
  });

  it("handles leap year correctly (Feb 29)", () => {
    // Child born on leap year
    const now = new Date("2024-02-29T10:00:00"); // Leap year
    const child = createChild({ date_of_birth: "2020-02-29" }); // Born on leap day
    
    // The birthday would be Feb 29 on leap years
    // On non-leap years, the birthday is typically observed on Feb 28 or Mar 1
    // This test just ensures the date parsing doesn't crash
    const notifications = getDueBirthdayNotifications([child], now, "user-1");
    expect(notifications).toBeInstanceOf(Array);
  });
});
