export type Guardian = {
  id: string;
  child_id: string;
  name: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_primary: boolean;
  is_emergency: boolean;
  notes: string | null;
};

export type Child = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  approximate_age: number | null;
  gender: string | null;
  address: string | null;
  class_group: string | null;
  registration_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ChildWithGuardians = Child & { guardians: Guardian[] };

export const NOT_PROVIDED = "Not provided";

export function fullName(child: Pick<Child, "first_name" | "last_name">) {
  return `${child.last_name} ${child.first_name}`.trim();
}

export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const birth = new Date(dob + "T00:00:00");
  if (
    Number.isNaN(birth.getTime()) ||
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  )
    return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Exact age when a date of birth exists, otherwise the approximate value. */
export function childAge(child: Pick<Child, "date_of_birth" | "approximate_age">) {
  const exact = ageFromDob(child.date_of_birth);
  if (exact !== null) return { age: exact, approximate: false };
  if (child.approximate_age !== null && child.approximate_age !== undefined) {
    return { age: child.approximate_age, approximate: true };
  }
  return { age: null, approximate: false };
}

/**
 * A child is eligible for the 14+ transition (Children department -> Young
 * department) whenever they are 14 or older and have not already been moved
 * to Young.
 *
 * `class_group` is a free-text field on the child record (no fixed list of
 * values, no default, not required by the registration form) — it is not a
 * reliable marker of "currently in the Children department". A child can be
 * 19 years old with `class_group` left completely blank, or set to any other
 * label a staff member typed. So eligibility here is age-based first: any
 * child whose age is 14+ is a transition candidate, *unless* their
 * `class_group` already reads "Young" (normalized for case/accents/
 * whitespace), which means the move already happened.
 *
 * `childAge` is used instead of `ageFromDob` alone so a child recorded with
 * only `approximate_age` (no exact date of birth) is still correctly
 * evaluated, using the same age a staff member sees displayed for them.
 */
export function isEligibleForYoungTransition(
  child: Pick<Child, "date_of_birth" | "approximate_age" | "class_group">,
) {
  if (isYoungMember(child)) return false;
  return (childAge(child).age ?? -1) >= 14;
}

/** True once a child's `class_group` has been set to Young (case/accents/whitespace-insensitive). */
export function isYoungMember(child: Pick<Child, "class_group">) {
  const value = normalize(child.class_group).trim();
  if (!value) return false;
  return value === "young" || value.split("/").some((part) => part.trim() === "young");
}

/**
 * Where to send the user after successfully deleting a child. A Young
 * member's list lives at /young; every other child belongs on the main
 * Children register at /children. This only inspects the (already-loaded)
 * child record and has no side effects, so it's safe to compute before the
 * delete request is even sent.
 */
export function deleteRedirectTarget(child: Pick<Child, "class_group">): "/young" | "/children" {
  return isYoungMember(child) ? "/young" : "/children";
}

export function primaryGuardian(guardians: Guardian[] | undefined) {
  if (!guardians?.length) return null;
  return guardians.find((g) => g.is_primary) ?? guardians[0] ?? null;
}

export function splitClassGroup(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return { className: "", groupName: "" };

  const parts = raw.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { className: "", groupName: "" };
  }
  if (parts.length === 1) {
    return { className: parts[0] || "", groupName: "" };
  }

  return {
    className: parts[0] || "",
    groupName: parts.slice(1).join(" / "),
  };
}

export function joinClassGroup(className: string | null | undefined, groupName: string | null | undefined) {
  const classValue = (className ?? "").trim();
  const groupValue = (groupName ?? "").trim();

  if (!classValue && !groupValue) return null;
  if (!classValue) return groupValue;
  if (!groupValue) return classValue;
  return `${classValue} / ${groupValue}`;
}

export function getDerivedGroupName(
  dateOfBirth: string | null | undefined,
  approximateAge: number | string | null | undefined,
) {
  const ageValue =
    typeof approximateAge === "string" ? approximateAge.trim() : approximateAge ?? null;
  const age =
    ageValue !== null && ageValue !== ""
      ? Number(ageValue)
      : dateOfBirth
        ? childAge({ date_of_birth: dateOfBirth, approximate_age: null }).age
        : null;

  return age !== null && age >= 14 ? "Young" : "Child";
}

export function buildChildGuardianRows(
  childId: string,
  guardianName: string | null | undefined,
  guardianPhone: string | null | undefined,
) {
  const normalizedName = guardianName?.trim() ?? "";
  const normalizedPhone = guardianPhone?.trim() ?? "";

  if (!normalizedName && !normalizedPhone) {
    return [];
  }

  return [
    {
      child_id: childId,
      name: normalizedName || null,
      phone: normalizedPhone || null,
      relationship: "Parent / Guardian",
      is_primary: true,
      is_emergency: false,
    },
  ];
}

const COMPLETENESS_FIELDS = [
  "Date of birth",
  "Gender",
  "Parent/guardian name",
  "Parent/guardian phone",
  "Address",
  "Class/group",
] as const;

export function completeness(child: ChildWithGuardians) {
  const g = primaryGuardian(child.guardians);
  const present: Record<(typeof COMPLETENESS_FIELDS)[number], boolean> = {
    "Date of birth": Boolean(child.date_of_birth),
    Gender: Boolean(child.gender),
    "Parent/guardian name": Boolean(g?.name),
    "Parent/guardian phone": Boolean(g?.phone),
    Address: Boolean(child.address),
    "Class/group": Boolean(child.class_group),
  };
  const missing = COMPLETENESS_FIELDS.filter((f) => !present[f]);
  const percent = Math.round(
    ((COMPLETENESS_FIELDS.length - missing.length) / COMPLETENESS_FIELDS.length) * 100,
  );
  return { percent, missing, complete: missing.length === 0 };
}

export function formatDate(value: string | null | undefined) {
  if (!value) return NOT_PROVIDED;
  const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  if (Number.isNaN(d.getTime())) return NOT_PROVIDED;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

export function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
