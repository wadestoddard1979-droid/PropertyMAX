import { randomUUID } from "crypto";
import type {
  AppStore,
  LedgerEntry,
  ProjectionAssumptions,
  SessionUser,
  WorkOrder,
} from "../types";
import { defaultAssumptions } from "./seed";
import { assertPropertyAccess } from "./workflow";

export type Horizon = "12m" | "36m" | "60m";

const HORIZON_MONTHS: Record<Horizon, number> = {
  "12m": 12,
  "36m": 36,
  "60m": 60,
};

export type MonthlyCashFlow = {
  month: string;
  rent: number;
  operatingExpenses: number;
  noi: number;
  mortgage: number;
  cashFlow: number;
  renovationSpend: number;
  note?: string;
};

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function sumBy(
  entries: LedgerEntry[],
  pred: (e: LedgerEntry) => boolean,
) {
  return entries.filter(pred).reduce((s, e) => s + e.amountCents, 0);
}

export function ensureFinancialDefaults(store: AppStore) {
  if (!store.ledger) store.ledger = [];
  if (!store.projectionAssumptions) store.projectionAssumptions = [];
  for (const p of store.properties) {
    if (!store.projectionAssumptions.some((a) => a.propertyId === p.id)) {
      store.projectionAssumptions.push(defaultAssumptions(p.id));
    }
  }
  store.version = 6;
}

export function getAssumptions(
  store: AppStore,
  propertyId: string,
): ProjectionAssumptions {
  ensureFinancialDefaults(store);
  return (
    store.projectionAssumptions.find((a) => a.propertyId === propertyId) ||
    defaultAssumptions(propertyId)
  );
}

export function buildMonthSnapshot(
  store: AppStore,
  propertyId: string,
  month: string,
) {
  const entries = store.ledger.filter(
    (e) => e.propertyId === propertyId && e.month === month,
  );
  const rent = sumBy(entries, (e) => e.category === "rent");
  const mortgage = Math.abs(
    sumBy(entries, (e) => e.category === "mortgage"),
  );
  const operatingExpenseCats = new Set([
    "pm_fee",
    "maintenance",
    "insurance",
    "taxes",
    "hoa",
    "utilities",
    "other",
  ]);
  const operatingExpenses = Math.abs(
    sumBy(entries, (e) => operatingExpenseCats.has(e.category)),
  );
  const renovation = Math.abs(
    sumBy(entries, (e) => e.category === "renovation" && e.amountCents < 0),
  );
  const noi = rent - operatingExpenses;
  const cashFlow = noi - mortgage;
  const assumptions = getAssumptions(store, propertyId);
  const forecastRent = assumptions.monthlyRentCents;
  const forecastOps =
    assumptions.monthlyPmFeeCents +
    assumptions.monthlyRepairsCents +
    assumptions.monthlyInsuranceCents +
    assumptions.monthlyTaxesCents +
    assumptions.monthlyHoaCents +
    assumptions.monthlyUtilitiesOwnerCents;
  const forecastNoi =
    Math.round(forecastRent * (1 - assumptions.vacancyRatePct / 100)) -
    forecastOps;
  const forecastCashFlow = forecastNoi - assumptions.monthlyMortgageCents;

  return {
    month,
    entries,
    actual: {
      rent,
      operatingExpenses,
      noi,
      mortgage,
      cashFlow,
      renovation,
    },
    forecast: {
      rent: Math.round(forecastRent * (1 - assumptions.vacancyRatePct / 100)),
      operatingExpenses: forecastOps,
      noi: forecastNoi,
      mortgage: assumptions.monthlyMortgageCents,
      cashFlow: forecastCashFlow,
    },
    labels: {
      dataQuality:
        "Illustrative / manual Phase 1 books — not bank-verified.",
      noi: "NOI = rent − operating expenses (before mortgage)",
      cashFlow: "Cash flow = NOI − mortgage (after debt service)",
    },
  };
}

export function buildProjection(
  assumptions: ProjectionAssumptions,
  horizon: Horizon,
): {
  months: MonthlyCashFlow[];
  totals: {
    rent: number;
    operatingExpenses: number;
    noi: number;
    mortgage: number;
    cashFlow: number;
    renovationSpend: number;
  };
  insights: {
    renovationRoiLabel: string;
    renovationPaybackMonths: number | null;
    vacancyCostCents: number;
    vacancyCostLabel: string;
    disclaimer: string;
  };
} {
  const n = HORIZON_MONTHS[horizon];
  const start = new Date(2026, 10, 1); // Nov 2026 pilot
  const months: MonthlyCashFlow[] = [];
  let upliftActive = false;

  for (let i = 0; i < n; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const yearIndex = Math.floor(i / 12);
    const growth = Math.pow(1 + assumptions.annualRentGrowthPct / 100, yearIndex);
    let rentBase = Math.round(assumptions.monthlyRentCents * growth);
    if (i >= assumptions.renovationMonthOffset) {
      upliftActive = true;
    }
    if (upliftActive) {
      rentBase += assumptions.renovationRentUpliftCents;
    }
    const effectiveRent = Math.round(
      rentBase * (1 - assumptions.vacancyRatePct / 100),
    );
    const operatingExpenses =
      assumptions.monthlyPmFeeCents +
      assumptions.monthlyRepairsCents +
      assumptions.monthlyInsuranceCents +
      assumptions.monthlyTaxesCents +
      assumptions.monthlyHoaCents +
      assumptions.monthlyUtilitiesOwnerCents;
    const mortgage = assumptions.monthlyMortgageCents;
    const renovationSpend =
      i === assumptions.renovationMonthOffset
        ? assumptions.renovationSpendCents
        : 0;
    const noi = effectiveRent - operatingExpenses;
    const cashFlow = noi - mortgage - renovationSpend;
    months.push({
      month: key,
      rent: effectiveRent,
      operatingExpenses,
      noi,
      mortgage,
      cashFlow,
      renovationSpend,
      note:
        renovationSpend > 0
          ? "Renovation spend modeled this month"
          : upliftActive && i === assumptions.renovationMonthOffset
            ? "Rent uplift begins"
            : undefined,
    });
  }

  const totals = months.reduce(
    (acc, m) => ({
      rent: acc.rent + m.rent,
      operatingExpenses: acc.operatingExpenses + m.operatingExpenses,
      noi: acc.noi + m.noi,
      mortgage: acc.mortgage + m.mortgage,
      cashFlow: acc.cashFlow + m.cashFlow,
      renovationSpend: acc.renovationSpend + m.renovationSpend,
    }),
    {
      rent: 0,
      operatingExpenses: 0,
      noi: 0,
      mortgage: 0,
      cashFlow: 0,
      renovationSpend: 0,
    },
  );

  const monthlyUplift = assumptions.renovationRentUpliftCents;
  const payback =
    monthlyUplift > 0
      ? Math.ceil(assumptions.renovationSpendCents / monthlyUplift)
      : null;
  const vacancyCostCents = Math.round(
    assumptions.monthlyRentCents * assumptions.vacancyMonthsOnTurnover,
  );

  return {
    months,
    totals,
    insights: {
      renovationRoiLabel:
        monthlyUplift > 0
          ? `Illustrative payback ~${payback} months at +$${Math.round(monthlyUplift / 100)}/mo rent uplift — not a guaranteed return.`
          : "Set a rent uplift to estimate renovation payback.",
      renovationPaybackMonths: payback,
      vacancyCostCents,
      vacancyCostLabel: `One turnover vacancy (~${assumptions.vacancyMonthsOnTurnover} mo) costs about $${Math.round(vacancyCostCents / 100).toLocaleString()} in unrealized rent (illustrative).`,
      disclaimer:
        "Projections are planning tools with adjustable assumptions. They do not guarantee future returns. Appreciation is not included.",
    },
  };
}

export function addLedgerEntry(
  store: AppStore,
  actor: SessionUser,
  input: {
    propertyId: string;
    month: string;
    category: LedgerEntry["category"];
    label: string;
    amountCents: number;
  },
) {
  if (actor.role !== "owner" && actor.role !== "manager") {
    throw new Error("Only owner or manager can add ledger entries");
  }
  assertPropertyAccess(store, actor, input.propertyId);
  ensureFinancialDefaults(store);
  // Phase 1: human-entered lines are always "manual" (never bank-verified).
  const entry: LedgerEntry = {
    id: id("led"),
    propertyId: input.propertyId,
    month: input.month,
    category: input.category,
    label: input.label.trim(),
    amountCents: input.amountCents,
    source: "manual",
    createdAt: new Date().toISOString(),
  };
  store.ledger.unshift(entry);
  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: input.propertyId,
    actorUserId: actor.id,
    kind: "ledger.manual_entry",
    message: `${actor.name} added manual ledger entry “${entry.label}” (not bank-verified).`,
    createdAt: entry.createdAt,
  });
  return entry;
}

export function updateAssumptions(
  store: AppStore,
  actor: SessionUser,
  propertyId: string,
  patch: Partial<ProjectionAssumptions>,
) {
  if (actor.role !== "owner" && actor.role !== "manager") {
    throw new Error("Only owner or manager can edit assumptions");
  }
  assertPropertyAccess(store, actor, propertyId);
  ensureFinancialDefaults(store);
  const idx = store.projectionAssumptions.findIndex(
    (a) => a.propertyId === propertyId,
  );
  const current =
    idx >= 0
      ? store.projectionAssumptions[idx]
      : defaultAssumptions(propertyId);
  const next = {
    ...current,
    ...patch,
    propertyId,
  };
  if (idx >= 0) store.projectionAssumptions[idx] = next;
  else store.projectionAssumptions.push(next);
  return next;
}

export function pendingApprovalsForOwner(
  store: AppStore,
  ownerId: string,
): WorkOrder[] {
  return store.workOrders.filter((w) => {
    const p = store.properties.find((x) => x.id === w.propertyId);
    return (
      p?.ownerId === ownerId && w.status === "awaiting_owner_approval"
    );
  });
}
