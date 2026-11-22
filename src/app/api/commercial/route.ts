import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { isStripeConfigured } from "@/lib/server/config";
import { readStore, updateStore } from "@/lib/server/db";
import {
  assertOrgAccess,
  buildBenchmark,
  exportAccountingCsv,
  exportAuditJson,
  getSubscription,
  getTheme,
  importAccountingCsv,
  orgsForUser,
  portfolioProjection,
  preferredVendors,
  propertiesForOrg,
  pushMonitor,
  requireMfaIfEnabled,
  updateTheme,
  upsertSubscription,
} from "@/lib/server/commercial";
import type { SaasPlan, WhiteLabelTheme } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId") || session.orgId || "org-pilot";
    const view = url.searchParams.get("view") || "overview";

    const store = await readStore();
    assertOrgAccess(store, session, orgId);

    if (view === "audit") {
      const format = url.searchParams.get("format") || "json";
      const payload = exportAuditJson(store, orgId);
      if (format === "download") {
        return new Response(JSON.stringify(payload, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="audit-${orgId}.json"`,
          },
        });
      }
      return Response.json(payload);
    }

    if (view === "accounting_export") {
      const csv = exportAccountingCsv(store, orgId);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="accounting-${orgId}.csv"`,
        },
      });
    }

    const org = store.organizations.find((o) => o.id === orgId);
    const properties = propertiesForOrg(store, orgId);
    const subscription = getSubscription(store, orgId);
    const invoices = store.saasInvoices.filter((i) => i.orgId === orgId);
    const theme = getTheme(store, orgId);
    const vendors = preferredVendors(store, orgId);
    const portfolio = portfolioProjection(store, orgId, "12m");
    const benchmark = buildBenchmark(store, orgId);
    const accounting = store.accountingImports.filter((a) => a.orgId === orgId);
    const monitoring = store.monitoringEvents.slice(0, 20);
    const memberships = store.memberships
      .filter((m) => m.orgId === orgId)
      .map((m) => {
        const u = store.users.find((x) => x.id === m.userId);
        return {
          ...m,
          userName: u?.name || m.userId,
          userEmail: u?.email || "",
        };
      });

    return Response.json({
      org,
      orgs: orgsForUser(store, session.id),
      memberships,
      properties,
      subscription,
      invoices,
      theme,
      vendors,
      portfolio,
      benchmark,
      accounting,
      monitoring,
      stripeConfigured: isStripeConfigured(),
      billingMode: isStripeConfigured() ? "stripe" : "demo",
      session: {
        orgId: session.orgId,
        mfaVerified: Boolean(session.mfaVerified),
      },
    });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const body = (await req.json()) as {
      action?: string;
      orgId?: string;
      plan?: SaasPlan;
      theme?: Partial<WhiteLabelTheme>;
      csv?: string;
    };
    const orgId = body.orgId || session.orgId || "org-pilot";
    const store0 = await readStore();
    assertOrgAccess(store0, session, orgId);

    if (body.action === "subscribe") {
      if (!body.plan) throw new AuthError("plan required", 400);
      let result;
      await updateStore((store) => {
        requireMfaIfEnabled(store, session);
        result = upsertSubscription(store, session, orgId, body.plan!);
      });
      return Response.json(result);
    }

    if (body.action === "theme") {
      if (!body.theme) throw new AuthError("theme required", 400);
      let theme;
      await updateStore((store) => {
        theme = updateTheme(store, session, orgId, body.theme!);
      });
      return Response.json({ theme });
    }

    if (body.action === "accounting_import") {
      if (!body.csv) throw new AuthError("csv required", 400);
      let lines;
      await updateStore((store) => {
        lines = importAccountingCsv(store, session, orgId, body.csv!);
      });
      return Response.json({ lines }, { status: 201 });
    }

    if (body.action === "monitor_ping") {
      await updateStore((store) => {
        pushMonitor(
          store,
          "info",
          "commercial.ui",
          `Heartbeat from ${session.email} @ ${orgId}`,
        );
      });
      return Response.json({ ok: true });
    }

    throw new AuthError("Unknown action", 400);
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
