import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChildWithGuardians } from "@/lib/children";
import type { EventException, EventRow } from "@/lib/recurrence";

export type AdminMember = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  responsibilities: string | null;
  notes: string | null;
  active: boolean;
};

export type AuditRow = {
  id: string;
  username: string | null;
  action: string;
  entity_type: string;
  description: string | null;
  created_at: string;
};

export const childrenKey = ["children"] as const;
export const eventsKey = ["events"] as const;
export const eventExceptionsKey = ["event_exceptions"] as const;
export const adminKey = ["administration_members"] as const;
export const auditKey = ["audit_logs"] as const;

export function useChildren() {
  return useQuery({
    queryKey: childrenKey,
    queryFn: async (): Promise<ChildWithGuardians[]> => {
      const { data, error } = await supabase
        .from("children")
        .select("*, guardians(*)")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ChildWithGuardians[];
    },
  });
}

export function useChild(id: string) {
  return useQuery({
    queryKey: [...childrenKey, id],
    queryFn: async (): Promise<ChildWithGuardians | null> => {
      const { data, error } = await supabase
        .from("children")
        .select("*, guardians(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ChildWithGuardians) ?? null;
    },
  });
}

export function useEvents() {
  return useQuery({
    queryKey: eventsKey,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_datetime", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventRow[];
    },
  });
}

export function useEventExceptions() {
  return useQuery({
    queryKey: eventExceptionsKey,
    queryFn: async (): Promise<EventException[]> => {
      const { data, error } = await supabase.from("event_exceptions").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as EventException[];
    },
  });
}

export function useAdminMembers() {
  return useQuery({
    queryKey: adminKey,
    queryFn: async (): Promise<AdminMember[]> => {
      const { data, error } = await supabase
        .from("administration_members")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AdminMember[];
    },
  });
}

export function useAuditLogs(limit = 100) {
  return useQuery({
    queryKey: [...auditKey, limit],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, username, action, entity_type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });
}
