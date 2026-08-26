import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { childrenKey, useChildren } from "@/lib/queries";
import { fullName, normalize, type ChildWithGuardians } from "@/lib/children";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^[0-9+][0-9 ()+\-.]{5,}$/.test(v), "Enter a valid phone number");

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  date_of_birth: z.string().trim(),
  approximate_age: z.string().trim(),
  gender: z.string(),
  address: z.string().trim().max(300),
  class_group: z.string().trim().max(80),
  registration_date: z.string().trim(),
  status: z.string(),
  notes: z.string().trim().max(2000),
  guardian_name: z.string().trim().max(120),
  guardian_phone: phoneSchema,
  guardian2_name: z.string().trim().max(120),
  guardian2_phone: phoneSchema,
  emergency_name: z.string().trim().max(120),
  emergency_phone: phoneSchema,
});

type FormValues = z.infer<typeof schema>;

function initial(child?: ChildWithGuardians): FormValues {
  const primary = child?.guardians.find((g) => g.is_primary && !g.is_emergency);
  const second = child?.guardians.find((g) => !g.is_primary && !g.is_emergency);
  const emergency = child?.guardians.find((g) => g.is_emergency);
  return {
    first_name: child?.first_name ?? "",
    last_name: child?.last_name ?? "",
    date_of_birth: child?.date_of_birth ?? "",
    approximate_age: child?.approximate_age != null ? String(child.approximate_age) : "",
    gender: child?.gender ?? "",
    address: child?.address ?? "",
    class_group: child?.class_group ?? "",
    registration_date: child?.registration_date ?? "",
    status: child?.status ?? "active",
    notes: child?.notes ?? "",
    guardian_name: primary?.name ?? "",
    guardian_phone: primary?.phone ?? "",
    guardian2_name: second?.name ?? "",
    guardian2_phone: second?.phone ?? "",
    emergency_name: emergency?.name ?? "",
    emergency_phone: emergency?.phone ?? "",
  };
}

const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v.trim());

export function ChildForm({ child }: { child?: ChildWithGuardians }) {
  const [values, setValues] = useState<FormValues>(() => initial(child));
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [duplicateAck, setDuplicateAck] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const all = useChildren();

  const set = (key: keyof FormValues, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const duplicates = useMemo(() => {
    const name = normalize(`${values.last_name} ${values.first_name}`).trim();
    if (name.length < 3) return [];
    return (all.data ?? []).filter(
      (c) =>
        c.id !== child?.id &&
        (normalize(fullName(c)).trim() === name ||
          (Boolean(values.date_of_birth) && c.date_of_birth === values.date_of_birth)),
    );
  }, [all.data, values.first_name, values.last_name, values.date_of_birth, child?.id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as keyof FormValues] = issue.message;
      }
      setErrors(next);
      toast.error("Please correct the highlighted fields.");
      return;
    }
    const v = parsed.data;

    if (v.date_of_birth) {
      const d = new Date(v.date_of_birth);
      const year = d.getFullYear();
      if (Number.isNaN(d.getTime()) || d > new Date() || year < 1990) {
        setErrors({ date_of_birth: "Enter a realistic date of birth." });
        toast.error("Please check the date of birth.");
        return;
      }
    }
    setErrors({});

    if (duplicates.length > 0 && !duplicateAck) {
      setDuplicateAck(true);
      toast.warning("A similar child already exists. Review below, then save again to confirm.");
      return;
    }

    setSaving(true);
    const payload = {
      first_name: v.first_name.trim(),
      last_name: v.last_name.trim(),
      date_of_birth: nullIfEmpty(v.date_of_birth),
      approximate_age: v.approximate_age.trim() === "" ? null : Number(v.approximate_age),
      gender: nullIfEmpty(v.gender),
      address: nullIfEmpty(v.address),
      class_group: nullIfEmpty(v.class_group),
      registration_date: nullIfEmpty(v.registration_date),
      status: v.status,
      notes: nullIfEmpty(v.notes),
      updated_by: user?.id ?? null,
    };

    let childId = child?.id;
    if (child) {
      const { error } = await supabase.from("children").update(payload).eq("id", child.id);
      if (error) {
        setSaving(false);
        toast.error("Changes could not be saved. Please try again.");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("children")
        .insert({ ...payload, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast.error("The child could not be added. Please try again.");
        return;
      }
      childId = data.id;
    }

    // Replace guardian rows with the submitted values.
    if (childId) {
      await supabase.from("guardians").delete().eq("child_id", childId);
      const rows = [
        {
          child_id: childId,
          name: nullIfEmpty(v.guardian_name),
          phone: nullIfEmpty(v.guardian_phone),
          relationship: "Parent / Guardian",
          is_primary: true,
          is_emergency: false,
        },
        {
          child_id: childId,
          name: nullIfEmpty(v.guardian2_name),
          phone: nullIfEmpty(v.guardian2_phone),
          relationship: "Second guardian",
          is_primary: false,
          is_emergency: false,
        },
        {
          child_id: childId,
          name: nullIfEmpty(v.emergency_name),
          phone: nullIfEmpty(v.emergency_phone),
          relationship: "Emergency contact",
          is_primary: false,
          is_emergency: true,
        },
      ].filter((r) => r.name || r.phone);
      if (rows.length) await supabase.from("guardians").insert(rows);
    }

    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: child ? "updated" : "created",
      entityType: "child",
      entityId: childId ?? null,
      description: `${child ? "Updated" : "Added"} ${payload.last_name} ${payload.first_name}`,
    });

    await queryClient.invalidateQueries({ queryKey: childrenKey });
    setSaving(false);
    toast.success(child ? "Changes saved." : "Child successfully added.");
    navigate({ to: "/children/$childId", params: { childId: childId! } });
  };

  const field = (key: keyof FormValues, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type={type} value={values[key]} onChange={(e) => set(key, e.target.value)} />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("last_name", "Last name *")}
          {field("first_name", "First name *")}
          {field("date_of_birth", "Date of birth", "date")}
          {field("approximate_age", "Approximate age (if no date of birth)", "number")}
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={values.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger id="gender"><SelectValue placeholder="Not provided" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Girl</SelectItem>
                <SelectItem value="M">Boy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {field("class_group", "Class / group")}
          {field("address", "Address")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parent / guardian</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("guardian_name", "Guardian name")}
          {field("guardian_phone", "Guardian phone", "tel")}
          {field("guardian2_name", "Second guardian")}
          {field("guardian2_phone", "Second phone", "tel")}
          {field("emergency_name", "Emergency contact")}
          {field("emergency_phone", "Emergency phone", "tel")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Department information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("registration_date", "Registration date", "date")}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={values.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={values.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium">Possible duplicate</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
            {duplicates.map((d) => (
              <li key={d.id}>
                {fullName(d)}
                {d.date_of_birth ? ` — ${d.date_of_birth}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Nothing was changed. Save again if this is genuinely a different child.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {child ? "Save changes" : "Add child"}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
