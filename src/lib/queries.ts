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

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_event_id: string | null;
  event_occurrence_date: string | null;
  related_child_id: string | null;
  birthday_year: number | null;
  scheduled_for: string | null;
  read_at: string | null;
  created_at: string;
};

export type FinanceCategoryRow = {
  id: string;
  name: string;
  type: "income" | "expense";
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceTransactionRow = {
  id: string;
  date: string;
  type: "income" | "expense";
  amount: number;
  currency?: "HTG" | "USD";
  category_id: string;
  description: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_voided: boolean;
  void_reason: string | null;
  category_name?: string | null;
};

export const childrenKey = ["children"] as const;
export const eventsKey = ["events"] as const;
export const eventExceptionsKey = ["event_exceptions"] as const;
export const adminKey = ["administration_members"] as const;
export const auditKey = ["audit_logs"] as const;
export const notificationsKey = ["notifications"] as const;
export const financeCategoriesKey = ["finance_categories"] as const;
export const financeTransactionsKey = ["financial_transactions"] as const;

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

export function useNotifications(limit = 10) {
  return useQuery({
    queryKey: [...notificationsKey, limit],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as NotificationRow[];
    },
  });
}

export function useFinanceCategories() {
  return useQuery({
    queryKey: financeCategoriesKey,
    queryFn: async (): Promise<FinanceCategoryRow[]> => {
      const { data, error } = await supabase
        .from("finance_categories")
        .select("*")
        .order("type", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FinanceCategoryRow[];
    },
  });
}

export function useFinanceTransactions(limit?: number) {
  return useQuery({
    queryKey: [...financeTransactionsKey, limit ?? "all"],
    queryFn: async (): Promise<FinanceTransactionRow[]> => {
      let query = supabase.from("financial_transactions").select("*").order("date", { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as FinanceTransactionRow[];
      const categories = await supabase.from("finance_categories").select("id, name");
      if (categories.error) throw categories.error;
      const byId = new Map<string, string>((categories.data ?? []).map((row) => [row.id, row.name]));
      return rows.map((row) => ({ ...row, category_name: byId.get(row.category_id) ?? null }));
    },
  });
}
