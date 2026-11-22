import { randomUUID } from "crypto";
import type {
  AppStore,
  OwnerStatement,
  SessionUser,
  WorkOrder,
} from "../types";
import { buildMonthSnapshot, getAssumptions } from "./financials";
import { registerJobHandler } from "./jobs/queue";
import { updateStore } from "./db";

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

export function ensureReportDefaults(store: AppStore) {
  if (!store.ownerStatements) store.ownerStatements = [];
}

export function generateOwnerStatement(
  store: AppStore,
  actor: SessionUser,
  propertyId: string,
  month: string,
): OwnerStatement {
  ensureReportDefaults(store);
  const property = store.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error("Property not found");
  if (actor.role === "owner" && property.ownerId !== actor.id) {
    throw new Error("Forbidden");
  }
  if (actor.role === "manager" && property.managerId !== actor.id) {
    throw new Error("Forbidden");
  }
  if (actor.role !== "owner" && actor.role !== "manager") {
    throw new Error("Only owner or manager can generate statements");
  }

  const snap = buildMonthSnapshot(store, propertyId, month);
  const maintenanceWos = store.workOrders.filter(
    (w) =>
      w.propertyId === propertyId &&
      (w.createdAt.startsWith(month) || w.updatedAt.startsWith(month)),
  );
  const expenseByCategory: Record<string, number> = {};
  for (const e of snap.entries) {
    if (e.amountCents >= 0) continue;
    expenseByCategory[e.category] =
      (expenseByCategory[e.category] || 0) + Math.abs(e.amountCents);
  }

  const statement: OwnerStatement = {
    id: id("stmt"),
    propertyId,
    month,
    generatedAt: now(),
    generatedByUserId: actor.id,
    rentCollectedCents: snap.actual.rent,
    operatingExpensesCents: snap.actual.operatingExpenses,
    maintenanceCents: expenseByCategory.maintenance || 0,
    mortgageCents: snap.actual.mortgage,
    noiCents: snap.actual.noi,
    cashFlowCents: snap.actual.cashFlow,
    renovationCents: snap.actual.renovation,
    workOrderCount: maintenanceWos.length,
    workOrderIds: maintenanceWos.map((w) => w.id),
    expenseByCategory,
    notes: `Auto-generated from ledger + ${maintenanceWos.length} maintenance item(s). Illustrative / not bank-verified.`,
  };

  // Replace same-month statement if regenerating
  store.ownerStatements = store.ownerStatements.filter(
    (s) => !(s.propertyId === propertyId && s.month === month),
  );
  store.ownerStatements.unshift(statement);

  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId,
    actorUserId: actor.id,
    kind: "report.owner_statement",
    message: `${actor.name} generated owner statement for ${month}.`,
    createdAt: now(),
  });

  store.notifications.unshift({
    id: id("notif"),
    userId: property.ownerId,
    workOrderId: null,
    title: `Owner statement · ${month}`,
    body: `Cash flow ${(statement.cashFlowCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} · ${statement.workOrderCount} maintenance item(s)`,
    read: false,
    createdAt: now(),
  });

  return statement;
}

export function expenseMaintenanceSummary(
  store: AppStore,
  propertyId: string,
  months: string[],
) {
  const entries = store.ledger.filter(
    (e) => e.propertyId === propertyId && months.includes(e.month),
  );
  const byMonth: Record<
    string,
    { expensesCents: number; maintenanceCents: number; rentCents: number }
  > = {};
  for (const m of months) {
    byMonth[m] = { expensesCents: 0, maintenanceCents: 0, rentCents: 0 };
  }
  for (const e of entries) {
    const bucket = byMonth[e.month];
    if (!bucket) continue;
    if (e.category === "rent") bucket.rentCents += e.amountCents;
    if (e.amountCents < 0) {
      bucket.expensesCents += Math.abs(e.amountCents);
      if (e.category === "maintenance") {
        bucket.maintenanceCents += Math.abs(e.amountCents);
      }
    }
  }

  const workOrders: WorkOrder[] = store.workOrders.filter(
    (w) =>
      w.propertyId === propertyId &&
      months.some(
        (m) => w.createdAt.startsWith(m) || w.updatedAt.startsWith(m),
      ),
  );

  return { byMonth, workOrders, entryCount: entries.length };
}

export function buildTaxExport(
  store: AppStore,
  propertyId: string,
  year: string,
): {
  json: Record<string, unknown>;
  csv: string;
} {
  const property = store.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error("Property not found");
  const entries = store.ledger.filter(
    (e) => e.propertyId === propertyId && e.month.startsWith(year),
  );
  const categories = [
    "rent",
    "mortgage",
    "pm_fee",
    "maintenance",
    "insurance",
    "taxes",
    "hoa",
    "utilities",
    "renovation",
    "other",
  ] as const;
  const totals: Record<string, number> = {};
  for (const c of categories) totals[c] = 0;
  for (const e of entries) {
    totals[e.category] = (totals[e.category] || 0) + e.amountCents;
  }

  const assumptions = getAssumptions(store, propertyId);
  const json = {
    exportType: "tax-oriented",
    disclaimer:
      "Pilot export for bookkeeping handoff — not CPA advice; illustrative/manual entries may be mixed with verified payment_refs.",
    property: {
      id: property.id,
      name: property.name,
      address: property.address,
    },
    year,
    generatedAt: now(),
    totalsCents: totals,
    lineItems: entries.map((e) => ({
      id: e.id,
      month: e.month,
      category: e.category,
      label: e.label,
      amountCents: e.amountCents,
      source: e.source,
    })),
    vacancyAssumption: {
      vacancyRatePct: assumptions.vacancyRatePct,
      vacancyMonthsOnTurnover: assumptions.vacancyMonthsOnTurnover,
    },
  };

  const header = "month,category,label,amount_cents,source,id";
  const rows = entries.map(
    (e) =>
      `${e.month},${e.category},"${e.label.replaceAll('"', '""')}",${e.amountCents},${e.source},${e.id}`,
  );
  const csv = [header, ...rows].join("\n");

  return { json, csv };
}

export function registerReportJobHandlers() {
  registerJobHandler("report.owner_statement", async (job) => {
    const propertyId = String(job.payload.propertyId || "prop-maple");
    const month =
      String(job.payload.month || "") ||
      new Date().toISOString().slice(0, 7);
    const actorId = String(job.payload.actorUserId || "user-manager");
    await updateStore((store) => {
      const actor =
        store.users.find((u) => u.id === actorId) ||
        store.users.find((u) => u.role === "manager");
      if (!actor) return;
      generateOwnerStatement(
        store,
        {
          id: actor.id,
          email: actor.email,
          name: actor.name,
          role: actor.role,
        },
        propertyId,
        month,
      );
    });
  });
}
