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

export function isEligibleForYoungTransition(child: Pick<Child, "date_of_birth" | "class_group">) {
  return child.class_group === "Children" && (ageFromDob(child.date_of_birth) ?? -1) >= 14;
}

export function primaryGuardian(guardians: Guardian[] | undefined) {
  if (!guardians?.length) return null;
  return guardians.find((g) => g.is_primary) ?? guardians[0] ?? null;
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
