import { supabase } from "@/integrations/supabase/client";

/**
 * All writes here go through a single upsert keyed on the table's own
 * UNIQUE (event_id, occurrence_date) constraint, so calling these more than
 * once for the same occurrence updates the existing exception row instead
 * of violating the constraint or creating a duplicate.
 */
async function upsertException(
  eventId: string,
  occurrenceDate: string,
  patch: {
    cancelled: boolean;
    override_title?: string | null;
    override_start_time?: string | null;
    override_end_time?: string | null;
    override_location?: string | null;
    notes?: string | null;
  },
) {
  const { error } = await supabase.from("event_exceptions").upsert(
    {
      event_id: eventId,
      occurrence_date: occurrenceDate,
      ...patch,
    },
    { onConflict: "event_id,occurrence_date" },
  );
  if (error) throw error;
}

/** Cancels a single occurrence without touching the parent recurring event. */
export async function cancelOccurrence(eventId: string, occurrenceDate: string) {
  await upsertException(eventId, occurrenceDate, { cancelled: true });
}

/**
 * Saves an override (title/time/location/notes) for a single occurrence.
 * Saving an override implies the occurrence is active (not cancelled) —
 * pass explicit `null` for a field to clear a previously-set override.
 */
export async function saveOccurrenceOverride(
  eventId: string,
  occurrenceDate: string,
  overrides: {
    title?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    notes?: string | null;
  },
) {
  await upsertException(eventId, occurrenceDate, {
    cancelled: false,
    override_title: overrides.title ?? null,
    override_start_time: overrides.startTime ?? null,
    override_end_time: overrides.endTime ?? null,
    override_location: overrides.location ?? null,
    notes: overrides.notes ?? null,
  });
}

/**
 * Restores an occurrence to the normal recurring schedule — removes the
 * exception entirely rather than leaving an empty, meaningless row, since a
 * fully-restored occurrence has no exception data left to keep.
 */
export async function restoreOccurrence(eventId: string, occurrenceDate: string) {
  const { error } = await supabase
    .from("event_exceptions")
    .delete()
    .eq("event_id", eventId)
    .eq("occurrence_date", occurrenceDate);
  if (error) throw error;
}
