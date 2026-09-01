import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAuditLogs } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MICEVA Children's Department" },
      { name: "description", content: "Account security and the department's activity log." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Settings — MICEVA Children's Department" },
      { property: "og:description", content: "Account settings and audit log." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, role } = useAuth();
  const queryClient = useQueryClient();
  const audit = useAuditLogs(100);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearingLog, setClearingLog] = useState(false);

  const clearActivityLog = async () => {
    if (!window.confirm("Clear the activity log for everyone? This cannot be undone.")) {
      return;
    }

    setClearingLog(true);
    const { error } = await supabase.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setClearingLog(false);

    if (error) {
      toast.error("The activity log could not be cleared.");
      return;
    }

    toast.success("Activity log cleared.");
    await queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error("The password could not be changed.");
      return;
    }
    setPassword("");
    setConfirm("");
    toast.success("Password updated.");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-muted-foreground">Account and activity history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-0 text-sm">
          <p>
            Username: <span className="font-medium">{profile?.username ?? "—"}</span>
          </p>
          <p>
            Name: <span className="font-medium">{profile?.display_name ?? "—"}</span>
          </p>
          <div className="flex items-center gap-2">
            Access level:{" "}
            <Badge variant="secondary">
              {role === "admin" ? "Administrator" : "Committee member"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <Input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Confirm password</Label>
              <Input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Update password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Activity log</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearActivityLog}
            disabled={clearingLog}
            className="gap-2"
          >
            {clearingLog ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Clear log
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {audit.isLoading && <Skeleton className="h-32 w-full" />}
          {!audit.isLoading && (audit.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
          {(audit.data ?? []).map((row) => (
            <div key={row.id} className="border-b border-border py-2 last:border-0">
              <p className="text-sm">{row.description ?? `${row.action} ${row.entity_type}`}</p>
              <p className="text-xs text-muted-foreground">
                {row.username ?? "Unknown"} ·{" "}
                {new Date(row.created_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
