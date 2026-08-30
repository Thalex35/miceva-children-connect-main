import { createFileRoute } from "@tanstack/react-router";
import { ChildForm } from "@/components/ChildForm";

export const Route = createFileRoute("/_authenticated/children/new")({
  head: () => ({
    meta: [
      { title: "Add a child — MICEVA Children's Department" },
      {
        name: "description",
        content: "Register a new child in the department's private register.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Add a child — MICEVA Children's Department" },
      { property: "og:description", content: "Register a new child." },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <h1 className="page-title mx-auto max-w-3xl">Add a child</h1>
      <ChildForm />
    </div>
  ),
});
