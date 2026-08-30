import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { childrenKey, useChildren } from "@/lib/queries";
import { isEligibleForYoungTransition } from "@/lib/children";
import { transitionChildToYoung } from "@/lib/transitions";
import type { ChildWithGuardians } from "@/lib/children";

/**
 * Runs the Children -> Young transition automatically, without requiring an
 * admin to click anything. Mounted once at the authenticated layout so it
 * applies no matter which page is open.
 *
 * Idempotent by construction: every candidate is re-derived from
 * `isEligibleForYoungTransition` on each data snapshot, and a child that has
 * already been moved to Young no longer satisfies that check — so re-running
 * this on the same or a later snapshot never reprocesses, re-transitions, or
 * duplicates anything. `runningRef` additionally prevents two overlapping
 * runs (e.g. a fast refetch while a previous batch is still in flight) from
 * racing each other.
 */
export function useAutoYoungTransition() {
  const { data } = useChildren();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const runningRef = useRef(false);
  const lastSnapshotRef = useRef<ChildWithGuardians[] | undefined>(undefined);

  useEffect(() => {
    if (!data || data === lastSnapshotRef.current) return;
    lastSnapshotRef.current = data;

    const candidates = data.filter(isEligibleForYoungTransition);
    if (candidates.length === 0 || runningRef.current) return;
    runningRef.current = true;

    void (async () => {
      try {
        let movedAny = false;
        for (const child of candidates) {
          const result = await transitionChildToYoung(
            child,
            { userId: user?.id, username: profile?.username },
            "automatic",
          );
          if (result.status === "moved") movedAny = true;
        }
        if (movedAny) {
          await queryClient.invalidateQueries({ queryKey: childrenKey });
        }
      } finally {
        runningRef.current = false;
      }
    })();
  }, [data, user?.id, profile?.username, queryClient]);
}
