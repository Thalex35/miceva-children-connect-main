import { createFileRoute } from "@tanstack/react-router";
import { ChildForm } from "@/components/ChildForm";
import { useChild } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { fullName } from "@/lib/children";

export const Route = createFileRoute("/_authenticated/children/$childId/edit")({
  head: () => ({
    meta: [
      { title: "Edit child — MICEVA Children's Department" },
      { name: "description", content: "Update a child's information and guardian contacts." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Edit child — MICEVA Children's Department" },
      { property: "og:description", content: "Update a child's record." },
    ],
  }),
  component: EditChild,
});

function EditChild() {
  const { childId } = Route.useParams();
  const { data: child, isLoading } = useChild(childId);

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-3xl w-full" />;
  if (!child) return <p className="text-center text-sm text-muted-foreground">Profile not found.</p>;

  return (
    <div className="space-y-4">
      <h1 className="page-title mx-auto max-w-3xl">Edit {fullName(child)}</h1>
      <ChildForm child={child} />
    </div>
  );
}
