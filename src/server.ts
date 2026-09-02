import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { syncEventNotificationsForUsers } from "./lib/notifications";
import { supabaseAdmin } from "./integrations/supabase/client.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

function authorizeCronRequest(request: Request): boolean {
  const secret =
    process.env["LOVABLE_CRON_SECRET"] ??
    process.env["LOVABLE_CRON_SECRET_PREVIOUS"] ??
    process.env["CRON_SECRET"] ??
    "";

  if (!secret) return false;

  const auth = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) return false;

  return match[1] === secret;
}

async function handleNotificationSyncRequest(request: Request): Promise<Response | null> {
  if (!/^(GET|POST)$/i.test(request.method)) return null;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!["/api/notifications/sync", "/api/cron/notifications-sync"].includes(path)) return null;

  if (!authorizeCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [{ data: profilesData, error: profilesError }, { data: eventsData, error: eventsError }, { data: exceptionsData, error: exceptionsError }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id"),
        supabaseAdmin.from("events").select("*").eq("active", true),
        supabaseAdmin.from("event_exceptions").select("*"),
      ]);

    if (profilesError) throw profilesError;
    if (eventsError) throw eventsError;
    if (exceptionsError) throw exceptionsError;

    const userIds = (profilesData ?? []).map((row) => row.id).filter(Boolean) as string[];
    const events = (eventsData ?? []) as any[];
    const exceptions = (exceptionsData ?? []) as any[];

    const result = await syncEventNotificationsForUsers(userIds, events, exceptions);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("notification sync failed", error);
    return new Response("Notification sync failed", { status: 500 });
  }
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handled = await handleNotificationSyncRequest(request);
      if (handled) return handled;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
