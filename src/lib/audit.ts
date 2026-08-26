import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "created" | "updated" | "deleted";

export async function logActivity(params: {
  userId: string | undefined;
  username: string | null | undefined;
  action: AuditAction;
  entityType: "child" | "guardian" | "administration_member" | "event";
  entityId?: string | null;
  description: string;
}) {
  if (!params.userId) return;
  await supabase.from("audit_logs").insert({
    user_id: params.userId,
    username: params.username ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    description: params.description,
  });
}
