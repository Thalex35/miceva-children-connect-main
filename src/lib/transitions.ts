import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/audit";
import { childAge, fullName, type Child } from "@/lib/children";

export type TransitionResult =
  { status: "moved" } | { status: "already-young" } | { status: "error"; message: string };

type TransitionableChild = Pick<
  Child,
  "id" | "first_name" | "last_name" | "date_of_birth" | "approximate_age"
>;

/**
 * Moves a single child from Children to Young: sets class_group = "Young"
 * on their existing record and logs an audit entry. This is the one place
 * that performs the transition write — the manual "Move to Young" button
 * and the automatic background transition both call this, so the guard
 * against re-transitioning and the audit trail stay identical either way.
 *
 * No new record is ever created and the child's id never changes — this is
 * a plain UPDATE of one existing row, so duplication is structurally
 * impossible and the id is preserved by construction.
 *
 * The `.or(...)` guard mirrors the same NULL-safety reasoning used
 * elsewhere: class_group can be NULL, and SQL's `<> 'Young'` is never true
 * against NULL, so a plain `.neq()` would wrongly refuse to transition a
 * child with a blank group. If the row no longer matches (someone already
 * moved it to Young since this was read), zero rows update and this
 * reports "already-young" instead of quietly doing nothing.
 */
export async function transitionChildToYoung(
  child: TransitionableChild,
  actor: { userId: string | undefined; username: string | null | undefined },
  trigger: "manual" | "automatic",
): Promise<TransitionResult> {
  const { data: updated, error } = await supabase
    .from("children")
    .update({ class_group: "Young" })
    .eq("id", child.id)
    .or("class_group.is.null,class_group.neq.Young")
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!updated) return { status: "already-young" };

  const { age } = childAge(child);
  await logActivity({
    userId: actor.userId,
    username: actor.username,
    action: "updated",
    entityType: "child",
    entityId: child.id,
    description:
      trigger === "automatic"
        ? `Automatically transitioned ${fullName(child)} to Young (age ${age ?? "unknown"})`
        : `Moved ${fullName(child)} to Young`,
  });

  return { status: "moved" };
}
