import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChild } from "@/lib/queries";
import { childrenKey } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import {
  childAge,
  completeness,
  formatDate,
  fullName,
  NOT_PROVIDED,
  telHref,
  type Guardian,
} from "@/lib/children";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/children/$childId")({
  head: () => ({
    meta: [
      { title: "Child profile — MICEVA Children's Department" },
      { name: "description", content: "Full child profile with guardian contacts and department notes." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Child profile — MICEVA Children's Department" },
      { property: "og:description", content: "Private child profile." },
    ],
  }),
  component: ChildDetail,
});

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value || NOT_PROVIDED}</span>
    </div>
  );
}

function GuardianCard({ guardian }: { guardian: Guardian }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{guardian.name ?? NOT_PROVIDED}</p>
      <p className="text-xs text-muted-foreground">{guardian.relationship ?? "Guardian"}</p>
      <p className="mt-1 text-sm">{guardian.phone ?? NOT_PROVIDED}</p>
      {guardian.phone && (
        <div className="mt-2 flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <a href={telHref(guardian.phone)}>
              <Phone className="size-4" /> Call
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a
              href={`https://wa.me/${guardian.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function ChildDetail() {
  const { childId } = Route.useParams();
  const { data: child, isLoading } = useChild(childId);
  const { isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm text-muted-foreground">This child profile no longer exists.</p>
        <Button asChild className="mt-4">
          <Link to="/children">Back to children</Link>
        </Button>
      </div>
    );
  }

  const info = completeness(child);
  const { age, approximate } = childAge(child);

  const remove = async () => {
    const { error } = await supabase.from("children").delete().eq("id", child.id);
    if (error) {
      toast.error("This profile could not be deleted.");
      return;
    }
    await logActivity({
      userId: user?.id,
      username: profile?.username,
      action: "deleted",
      entityType: "child",
      entityId: child.id,
      description: `Deleted ${fullName(child)}`,
    });
    await queryClient.invalidateQueries({ queryKey: childrenKey });
    toast.success("Profile deleted.");
    navigate({ to: "/children" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/children" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Children
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{fullName(child)}</h1>
          <p className="text-sm text-muted-foreground">
            {age !== null ? `${age} years${approximate ? " (approx.)" : ""}` : "Age not provided"} ·{" "}
            {child.gender === "F" ? "Girl" : child.gender === "M" ? "Boy" : NOT_PROVIDED}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to="/children/$childId/edit" params={{ childId: child.id }}>
              <Pencil className="size-4" /> Edit
            </Link>
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" aria-label="Delete profile">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {fullName(child)} will be removed from the register permanently. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium">Profile completeness</p>
            <Badge variant={info.complete ? "secondary" : "outline"}>{info.percent}%</Badge>
          </div>
          <Progress value={info.percent} className="mt-3" />
          {info.missing.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Missing: {info.missing.join(", ")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal information</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Row label="Date of birth" value={child.date_of_birth ? formatDate(child.date_of_birth) : null} />
          <Row label="Approximate age" value={child.approximate_age ? `${child.approximate_age} years` : null} />
          <Row label="Address" value={child.address} />
          <Row label="Class / group" value={child.class_group} />
          <Row label="Registration date" value={child.registration_date ? formatDate(child.registration_date) : null} />
          <Row label="Status" value={child.status === "active" ? "Active" : "Inactive"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
          {child.guardians.length === 0 && (
            <p className="text-sm text-muted-foreground">No guardian contact recorded yet.</p>
          )}
          {child.guardians.map((g) => (
            <GuardianCard key={g.id} guardian={g} />
          ))}
        </CardContent>
      </Card>

      {child.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm whitespace-pre-wrap">{child.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
