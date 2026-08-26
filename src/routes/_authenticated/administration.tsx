import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { adminKey, useAdminMembers, type AdminMember } from "@/lib/queries";
import { NOT_PROVIDED, telHref } from "@/lib/children";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/administration")({
  head: () => ({
    meta: [
      { title: "Administration — MICEVA Children's Department" },
      { name: "description", content: "Committee members, their roles and contact details." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Administration — MICEVA Children's Department" },
      { property: "og:description", content: "Committee members and roles." },
    ],
  }),
  component: AdministrationPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.string().trim().max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^[0-9+][0-9 ()+\-.]{5,}$/.test(v), "Enter a valid phone number"),
  email: z.string().trim().max(255).refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email"),
  responsibilities: z.string().trim().max(1000),
});

type Values = z.infer<typeof schema>;

const empty: Values = { name: "", role: "", phone: "", email: "", responsibilities: "" };

function MemberDialog({
  member,
  trigger,
}: {
  member?: AdminMember;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(
    member
      ? {
          name: member.name,
          role: member.role ?? "",
          phone: member.phone ?? "",
          email: member.email ?? "",
          responsibilities: member.responsibilities ?? "",
        }
      : empty,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof Values, string>> = {};
      for (const i of parsed.error.issues) next[i.path[0] as keyof Values] = i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    const payload = {
      name: parsed.data.name,
      role: parsed.data.role || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      responsibilities: parsed.data.responsibilities || null,
    };
    const { error } = member
      ? await supabase.from("administration_members").update(payload).eq("id", member.id)
      : await supabase.from("administration_members").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("The member could not be saved.");
      return;
    }
    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: member ? "updated" : "created",
      entityType: "administration_member",
      entityId: member?.id ?? null,
      description: `${member ? "Updated" : "Added"} committee member ${payload.name}`,
    });
    await queryClient.invalidateQueries({ queryKey: adminKey });
    toast.success(member ? "Member updated." : "Member added.");
    setOpen(false);
  };

  const field = (key: keyof Values, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`m-${key}`}>{label}</Label>
      <Input
        id={`m-${key}`}
        type={type}
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? "Edit member" : "Add committee member"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {field("name", "Name *")}
          {field("role", "Role")}
          {field("phone", "Phone", "tel")}
          {field("email", "Email", "email")}
          <div className="space-y-2">
            <Label htmlFor="m-resp">Responsibilities</Label>
            <Textarea
              id="m-resp"
              rows={3}
              value={values.responsibilities}
              onChange={(e) => setValues((v) => ({ ...v, responsibilities: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdministrationPage() {
  const { data, isLoading } = useAdminMembers();
  const { isAdmin, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const remove = async (member: AdminMember) => {
    const { error } = await supabase.from("administration_members").delete().eq("id", member.id);
    if (error) {
      toast.error("This member could not be removed.");
      return;
    }
    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: "deleted",
      entityType: "administration_member",
      entityId: member.id,
      description: `Removed committee member ${member.name}`,
    });
    await queryClient.invalidateQueries({ queryKey: adminKey });
    toast.success("Member removed.");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="text-sm text-muted-foreground">Children&rsquo;s department committee</p>
        </div>
        <MemberDialog
          trigger={
            <Button>
              <Plus className="size-4" /> Add member
            </Button>
          }
        />
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(data ?? []).map((m) => (
          <Card key={m.id}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-primary">{m.role ?? NOT_PROVIDED}</p>
                </div>
                {!m.active && <Badge variant="outline">Inactive</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{m.responsibilities ?? "No responsibilities recorded."}</p>
              <p className="text-sm">{m.phone ?? NOT_PROVIDED}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {m.phone && (
                  <Button asChild size="sm" variant="secondary">
                    <a href={telHref(m.phone)}>
                      <Phone className="size-4" /> Call
                    </a>
                  </Button>
                )}
                {m.email && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`mailto:${m.email}`}>
                      <Mail className="size-4" /> Email
                    </a>
                  </Button>
                )}
                <MemberDialog
                  member={m}
                  trigger={
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  }
                />
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label={`Remove ${m.name}`}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
