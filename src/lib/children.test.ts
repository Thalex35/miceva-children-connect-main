import { describe, expect, it } from "bun:test";
import {
  childAge,
  deleteRedirectTarget,
  isEligibleForYoungTransition,
  isYoungMember,
  type Child,
} from "./children";

type EligibilityInput = Pick<Child, "date_of_birth" | "approximate_age" | "class_group">;

function dobForAge(age: number, birthdayAlreadyPassedThisYear = true): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  if (!birthdayAlreadyPassedThisYear) d.setDate(d.getDate() + 5);
  return d.toISOString().slice(0, 10);
}

function child(
  overrides: Partial<EligibilityInput> & { date_of_birth?: string | null } = {},
): EligibilityInput {
  return {
    date_of_birth: null,
    approximate_age: null,
    class_group: null,
    ...overrides,
  };
}

describe("isEligibleForYoungTransition", () => {
  // The full business matrix from the reported bug and its follow-up fixes.
  it("13yo with a blank group is not eligible", () => {
    expect(
      isEligibleForYoungTransition(child({ date_of_birth: dobForAge(13), class_group: "" })),
    ).toBe(false);
  });

  it("exactly 14 (birthday already passed) is eligible", () => {
    expect(
      isEligibleForYoungTransition(child({ date_of_birth: dobForAge(14), class_group: "" })),
    ).toBe(true);
  });

  it("still 13 because the 14th birthday has not occurred yet is not eligible", () => {
    expect(
      isEligibleForYoungTransition(child({ date_of_birth: dobForAge(14, false), class_group: "" })),
    ).toBe(false);
  });

  it("15yo with a blank group is eligible", () => {
    expect(
      isEligibleForYoungTransition(child({ date_of_birth: dobForAge(15), class_group: "" })),
    ).toBe(true);
  });

  it("19yo with a blank group is eligible (the originally reported bug)", () => {
    expect(isEligibleForYoungTransition(child({ approximate_age: 19, class_group: "" }))).toBe(
      true,
    );
  });

  it("no DOB, approximate_age = 19 is eligible", () => {
    expect(isEligibleForYoungTransition(child({ approximate_age: 19, class_group: "" }))).toBe(
      true,
    );
  });

  it("no DOB, approximate_age = 13 is not eligible", () => {
    expect(isEligibleForYoungTransition(child({ approximate_age: 13, class_group: "" }))).toBe(
      false,
    );
  });

  it("no DOB and no approximate age does not automatically transition the child", () => {
    expect(
      isEligibleForYoungTransition(
        child({ date_of_birth: null, approximate_age: null, class_group: "" }),
      ),
    ).toBe(false);
  });

  it("a child already moved to Young is never picked up again (idempotency guard)", () => {
    // Simulates re-running the transition scan on a child from a previous
    // batch: once class_group reads "Young", the exact same eligibility
    // check that selected them the first time now excludes them, so a
    // second run can never reprocess or re-transition the same child.
    const alreadyTransitioned = child({ date_of_birth: dobForAge(19), class_group: "Young" });
    expect(isEligibleForYoungTransition(alreadyTransitioned)).toBe(false);
  });

  it('15yo in "Children" is eligible', () => {
    expect(
      isEligibleForYoungTransition(
        child({ date_of_birth: dobForAge(15), class_group: "Children" }),
      ),
    ).toBe(true);
  });

  it('15yo in an arbitrary non-Young group ("Class A") is eligible', () => {
    expect(
      isEligibleForYoungTransition(child({ date_of_birth: dobForAge(15), class_group: "Class A" })),
    ).toBe(true);
  });

  it('15yo already in "Young" is not eligible', () => {
    expect(
      isEligibleForYoungTransition(child({ date_of_birth: dobForAge(15), class_group: "Young" })),
    ).toBe(false);
  });

  it('15yo in "young" (lowercase) is not eligible', () => {
    expect(
      isEligibleForYoungTransition(child({ date_of_birth: dobForAge(15), class_group: "young" })),
    ).toBe(false);
  });

  it('15yo in " YOUNG " (case + whitespace) is not eligible', () => {
    expect(
      isEligibleForYoungTransition(child({ date_of_birth: dobForAge(15), class_group: " YOUNG " })),
    ).toBe(false);
  });
});

describe("isYoungMember", () => {
  it("is false for a blank group", () => {
    expect(isYoungMember({ class_group: "" })).toBe(false);
  });

  it("is false for null", () => {
    expect(isYoungMember({ class_group: null })).toBe(false);
  });

  it('is true for "Young" and case/whitespace variants', () => {
    expect(isYoungMember({ class_group: "Young" })).toBe(true);
    expect(isYoungMember({ class_group: "young" })).toBe(true);
    expect(isYoungMember({ class_group: " YOUNG " })).toBe(true);
  });

  it('is false for "Children" or any other label', () => {
    expect(isYoungMember({ class_group: "Children" })).toBe(false);
    expect(isYoungMember({ class_group: "Class A" })).toBe(false);
  });
});

describe("childAge", () => {
  it("prefers the exact date of birth over approximate_age", () => {
    const result = childAge({ date_of_birth: dobForAge(15), approximate_age: 99 });
    expect(result.age).toBe(15);
    expect(result.approximate).toBe(false);
  });

  it("falls back to approximate_age when there is no date of birth", () => {
    const result = childAge({ date_of_birth: null, approximate_age: 19 });
    expect(result.age).toBe(19);
    expect(result.approximate).toBe(true);
  });

  it("returns null age when neither is available", () => {
    const result = childAge({ date_of_birth: null, approximate_age: null });
    expect(result.age).toBeNull();
  });
});

describe("deleteRedirectTarget", () => {
  // Delete Child must send the user back to whichever list the deleted
  // record actually belonged to — a Young member's list is /young, and
  // every other child (Children, blank, or any other group) is /children.
  it('sends a Young member ("Young") to /young', () => {
    expect(deleteRedirectTarget({ class_group: "Young" })).toBe("/young");
  });

  it('sends a Young member with case/whitespace variants ("  young  ") to /young', () => {
    expect(deleteRedirectTarget({ class_group: "  young  " })).toBe("/young");
  });

  it('sends a "Children" group member to /children', () => {
    expect(deleteRedirectTarget({ class_group: "Children" })).toBe("/children");
  });

  it("sends a blank group member to /children", () => {
    expect(deleteRedirectTarget({ class_group: "" })).toBe("/children");
  });

  it("sends a null group member to /children", () => {
    expect(deleteRedirectTarget({ class_group: null })).toBe("/children");
  });

  it('sends an arbitrary other group ("Class A") to /children', () => {
    expect(deleteRedirectTarget({ class_group: "Class A" })).toBe("/children");
  });
});
