import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "created" | "updated" | "deleted" | "voided" | "enabled" | "disabled";

export async function logActivity(params: {
  userId: string | undefined;
  username: string | null | undefined;
  action: AuditAction | string;
  entityType: string;
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
