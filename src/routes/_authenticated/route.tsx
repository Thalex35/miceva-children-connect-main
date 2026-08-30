import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAutoYoungTransition } from "@/lib/useAutoYoungTransition";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // Runs the automatic Children -> Young transition in the background for
  // every authenticated page, not just the Children list.
  useAutoYoungTransition();
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
