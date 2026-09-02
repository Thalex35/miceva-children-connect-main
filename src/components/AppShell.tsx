import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Repeat,
  Settings,
  Users,
  UsersRound,
  UserRound,
  FileBarChart,
  Menu,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { notificationsKey, useEventExceptions, useEvents, useNotifications } from "@/lib/queries";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  syncEventNotifications,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/children", label: "Children", icon: Users },
  { to: "/young", label: "Young", icon: UserRound },
  { to: "/administration", label: "Administration", icon: UsersRound },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/activities", label: "Activities", icon: Repeat },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const MOBILE_NAV = NAV.filter((n) =>
  ["/dashboard", "/children", "/calendar", "/activities"].includes(n.to),
);

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          activeOptions={{ exact: false }}
        >
          <Icon className="size-4.5 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="px-3 py-4">
      <p className="font-[family-name:var(--font-display)] text-lg leading-tight font-semibold text-sidebar-foreground">
        MICEVA Children&rsquo;s Department
      </p>
      <p className="mt-1 text-xs text-sidebar-foreground/60">Private Management System — 2026</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: events } = useEvents();
  const { data: exceptions } = useEventExceptions();
  const { data: notifications } = useNotifications(8);
  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;
  const title = useRouterState({
    select: (s) => {
      const path = s.location.pathname;
      return NAV.find((n) => path.startsWith(n.to))?.label ?? "Dashboard";
    },
  });

  useEffect(() => {
    if (!user?.id || !events) return;
    void syncEventNotifications(user.id, events, exceptions ?? []).then(async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsKey });
    });
  }, [exceptions, events, queryClient, user?.id]);

  const markReadAndOpen = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    await queryClient.invalidateQueries({ queryKey: notificationsKey });
    navigate({ to: "/calendar" });
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await markAllNotificationsAsRead(user.id);
    await queryClient.invalidateQueries({ queryKey: notificationsKey });
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <div>
          <Brand />
          <NavLinks />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <p className="text-sm font-medium text-sidebar-foreground">
            {profile?.display_name ?? profile?.username ?? "—"}
          </p>
          <p className="text-xs text-sidebar-foreground/60">
            {role === "admin" ? "Administrator" : "Committee member"}
          </p>
          <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={signOut}>
            <LogOut className="size-4" /> Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-3">
                <Brand />
                <NavLinks onNavigate={() => setOpen(false)} />
                <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={signOut}>
                  <LogOut className="size-4" /> Log out
                </Button>
              </SheetContent>
            </Sheet>
            <span className="font-[family-name:var(--font-display)] text-base font-semibold">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium">
                  <span>Notifications</span>
                  {unreadCount > 0 && <span className="text-xs text-muted-foreground">{unreadCount} unread</span>}
                </DropdownMenuLabel>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="w-full px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-accent"
                  >
                    Mark all as read
                  </button>
                )}
                <DropdownMenuSeparator />
                {(notifications ?? []).length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground">No notifications yet.</div>
                )}
                {(notifications ?? []).slice(0, 6).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onSelect={() => void markReadAndOpen(notification.id)}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-1 rounded-none px-3 py-2 text-left",
                      !notification.read_at && "bg-accent/30",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-medium">{notification.title}</span>
                      {!notification.read_at && <span className="size-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground">{notification.message}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {notification.event_occurrence_date
                        ? new Date(`${notification.event_occurrence_date}T00:00:00`).toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })
                        : new Date(notification.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Link to="/notifications" className="block text-center text-sm font-medium text-primary">
                    View all notifications
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-24 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur lg:hidden">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground",
              )}
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
