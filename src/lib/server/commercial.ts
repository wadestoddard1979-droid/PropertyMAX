import { randomUUID } from "crypto";
import type {
  AccountingImportLine,
  AppStore,
  AuditLogEntry,
  BenchmarkSnapshot,
  Membership,
  MonitoringEvent,
  Organization,
  Property,
  SaasInvoice,
  SaasPlan,
  SaasSubscription,
  SessionUser,
  WhiteLabelTheme,
} from "../types";
import { buildProjection, getAssumptions, type Horizon } from "./financials";
import { isStripeConfigured } from "./config";

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

export function ensureCommercialDefaults(store: AppStore) {
  if (!store.organizations) store.organizations = [];
  if (!store.memberships) store.memberships = [];
  if (!store.saasSubscriptions) store.saasSubscriptions = [];
  if (!store.saasInvoices) store.saasInvoices = [];
  if (!store.whiteLabelThemes) store.whiteLabelThemes = [];
  if (!store.accountingImports) store.accountingImports = [];
  if (!store.auditLogs) store.auditLogs = [];
  if (!store.monitoringEvents) store.monitoringEvents = [];
  for (const p of store.properties || []) {
    if (!p.orgId) p.orgId = "org-pilot";
  }
  for (const v of store.vendors || []) {
    if (v.orgId === undefined) v.orgId = "org-pilot";
    if (v.preferred === undefined) v.preferred = true;
  }
  for (const u of store.users || []) {
    if (!u.orgIds) u.orgIds = ["org-pilot"];
    if (u.mfaEnabled === undefined) u.mfaEnabled = false;
  }
}

export function pushAudit(
  store: AppStore,
  entry: Omit<AuditLogEntry, "id" | "createdAt">,
) {
  ensureCommercialDefaults(store);
  store.auditLogs.unshift({
    ...entry,
    id: id("audit"),
    createdAt: now(),
  });
}

export function pushMonitor(
  store: AppStore,
  level: MonitoringEvent["level"],
  source: string,
  message: string,
) {
  ensureCommercialDefaults(store);
  store.monitoringEvents.unshift({
    id: id("mon"),
    level,
    source,
    message,
    createdAt: now(),
  });
}

export function orgsForUser(store: AppStore, userId: string): Organization[] {
  ensureCommercialDefaults(store);
  const ids = new Set(
    store.memberships.filter((m) => m.userId === userId).map((m) => m.orgId),
  );
  return store.organizations.filter((o) => ids.has(o.id));
}

export function propertiesForOrg(store: AppStore, orgId: string): Property[] {
  return store.properties.filter((p) => (p.orgId || "org-pilot") === orgId);
}

export function assertOrgAccess(
  store: AppStore,
  actor: SessionUser,
  orgId: string,
) {
  ensureCommercialDefaults(store);
  const ok = store.memberships.some(
    (m) => m.orgId === orgId && m.userId === actor.id,
  );
  if (!ok) throw new Error("No membership in this organization");
}

export function requireMfaIfEnabled(store: AppStore, actor: SessionUser) {
  const user = store.users.find((u) => u.id === actor.id);
  if (!user?.mfaEnabled) return;
  if (actor.role !== "owner" && actor.role !== "manager") return;
  if (!actor.mfaVerified) {
    throw new Error("MFA required — verify with demo code 123456");
  }
}

export function setMfaEnabled(
  store: AppStore,
  actor: SessionUser,
  enabled: boolean,
) {
  const user = store.users.find((u) => u.id === actor.id);
  if (!user) throw new Error("User not found");
  if (user.role !== "owner" && user.role !== "manager") {
    throw new Error("MFA toggle is for owner/manager roles");
  }
  user.mfaEnabled = enabled;
  pushAudit(store, {
    orgId: actor.orgId || user.orgIds?.[0] || null,
    actorUserId: actor.id,
    action: enabled ? "mfa.enabled" : "mfa.disabled",
    entityType: "user",
    entityId: actor.id,
    detail: `MFA ${enabled ? "enabled" : "disabled"} for ${user.email}`,
  });
  return user;
}

export function getSubscription(
  store: AppStore,
  orgId: string,
): SaasSubscription | null {
  ensureCommercialDefaults(store);
  return store.saasSubscriptions.find((s) => s.orgId === orgId) || null;
}

export function upsertSubscription(
  store: AppStore,
  actor: SessionUser,
  orgId: string,
  plan: SaasPlan,
): { subscription: SaasSubscription; invoice: SaasInvoice } {
  assertOrgAccess(store, actor, orgId);
  requireMfaIfEnabled(store, actor);
  ensureCommercialDefaults(store);
  const unit =
    plan === "pilot" ? 0 : plan === "growth" ? 9900 : 24900;
  let sub = store.saasSubscriptions.find((s) => s.orgId === orgId);
  const ts = now();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  if (!sub) {
    sub = {
      id: id("sub"),
      orgId,
      plan,
      status: "active",
      provider: isStripeConfigured() ? "stripe" : "demo",
      externalId: null,
      seats: Math.max(1, store.memberships.filter((m) => m.orgId === orgId).length),
      unitAmountCents: unit,
      currentPeriodEnd: periodEnd.toISOString(),
      updatedAt: ts,
    };
    store.saasSubscriptions.unshift(sub);
  } else {
    sub.plan = plan;
    sub.unitAmountCents = unit;
    sub.status = "active";
    sub.provider = isStripeConfigured() ? "stripe" : "demo";
    sub.currentPeriodEnd = periodEnd.toISOString();
    sub.updatedAt = ts;
  }

  const invoice: SaasInvoice = {
    id: id("inv"),
    orgId,
    subscriptionId: sub.id,
    amountCents: unit,
    status: sub.provider === "demo" ? "demo" : "paid",
    label:
      sub.provider === "demo"
        ? `DEMO invoice — ${plan} plan (not a real charge)`
        : `${plan} plan · Stripe Billing`,
    issuedAt: ts,
    demo: sub.provider === "demo",
  };
  store.saasInvoices.unshift(invoice);
  pushAudit(store, {
    orgId,
    actorUserId: actor.id,
    action: "saas.subscription_updated",
    entityType: "saas_subscription",
    entityId: sub.id,
    detail: `Plan → ${plan} via ${sub.provider}`,
  });
  pushMonitor(
    store,
    "info",
    "saas.billing",
    `Org ${orgId} subscription set to ${plan} (${sub.provider})`,
  );
  return { subscription: sub, invoice };
}

export function getTheme(
  store: AppStore,
  orgId: string,
): WhiteLabelTheme | null {
  ensureCommercialDefaults(store);
  return store.whiteLabelThemes.find((t) => t.orgId === orgId) || null;
}

export function updateTheme(
  store: AppStore,
  actor: SessionUser,
  orgId: string,
  patch: Partial<WhiteLabelTheme>,
): WhiteLabelTheme {
  assertOrgAccess(store, actor, orgId);
  ensureCommercialDefaults(store);
  let theme = store.whiteLabelThemes.find((t) => t.orgId === orgId);
  if (!theme) {
    theme = {
      orgId,
      brandName: "PropertMax",
      logoText: "PropertMax",
      tagline: "Property operations",
      primaryColor: "#0f766e",
      accentColor: "#134e4a",
      surfaceColor: "#f0fdfa",
      mark: "PM",
    };
    store.whiteLabelThemes.push(theme);
  }
  Object.assign(theme, patch, { orgId });
  pushAudit(store, {
    orgId,
    actorUserId: actor.id,
    action: "theme.updated",
    entityType: "white_label",
    entityId: orgId,
    detail: `Brand → ${theme.brandName}`,
  });
  return theme;
}

export function portfolioProjection(
  store: AppStore,
  orgId: string,
  horizon: Horizon = "12m",
) {
  const props = propertiesForOrg(store, orgId);
  const perProperty = props.map((p) => {
    const assumptions = getAssumptions(store, p.id);
    const projection = buildProjection(assumptions, horizon);
    return {
      propertyId: p.id,
      name: p.name,
      occupancy: p.occupancy,
      monthlyRentCents: Math.round(p.monthlyRent * 100),
      projection,
    };
  });
  const totals = perProperty.reduce(
    (acc, row) => {
      acc.rent += row.projection.totals.rent;
      acc.noi += row.projection.totals.noi;
      acc.cashFlow += row.projection.totals.cashFlow;
      acc.renovationSpend += row.projection.totals.renovationSpend;
      return acc;
    },
    { rent: 0, noi: 0, cashFlow: 0, renovationSpend: 0 },
  );
  return {
    orgId,
    propertyCount: props.length,
    occupiedCount: props.filter((p) => p.occupancy === "Occupied").length,
    perProperty,
    totals,
    horizon,
  };
}

export function buildBenchmark(store: AppStore, orgId: string): BenchmarkSnapshot {
  const props = propertiesForOrg(store, orgId);
  const rents = props.map((p) => Math.round(p.monthlyRent * 100));
  const avgRent =
    rents.length === 0
      ? 0
      : Math.round(rents.reduce((a, b) => a + b, 0) / rents.length);
  const occupied = props.filter((p) => p.occupancy === "Occupied").length;
  const occupancyPct =
    props.length === 0 ? 0 : Math.round((occupied / props.length) * 1000) / 10;

  let maint = 0;
  for (const p of props) {
    const entries = store.ledger.filter(
      (e) => e.propertyId === p.id && e.category === "maintenance",
    );
    maint += entries.reduce((s, e) => s + Math.abs(e.amountCents), 0);
  }
  const maintenancePerDoor =
    props.length === 0 ? 0 : Math.round(maint / props.length);

  let cashFlowSum = 0;
  for (const p of props) {
    const a = getAssumptions(store, p.id);
    const rent = Math.round(a.monthlyRentCents * (1 - a.vacancyRatePct / 100));
    const opex =
      a.monthlyPmFeeCents +
      a.monthlyRepairsCents +
      a.monthlyInsuranceCents +
      a.monthlyTaxesCents +
      a.monthlyHoaCents +
      a.monthlyUtilitiesOwnerCents;
    cashFlowSum += rent - opex - a.monthlyMortgageCents;
  }
  const avgCashFlow =
    props.length === 0 ? 0 : Math.round(cashFlowSum / props.length);

  // Peer metrics from all orgs in the seed (simple peer set)
  const peerProps = store.properties;
  const peerRent =
    peerProps.length === 0
      ? avgRent
      : Math.round(
          peerProps.reduce((s, p) => s + p.monthlyRent * 100, 0) /
            peerProps.length,
        );
  const peerOcc =
    peerProps.length === 0
      ? occupancyPct
      : Math.round(
          (peerProps.filter((p) => p.occupancy === "Occupied").length /
            peerProps.length) *
            1000,
        ) / 10;
  let peerMaint = 0;
  for (const p of peerProps) {
    peerMaint += store.ledger
      .filter((e) => e.propertyId === p.id && e.category === "maintenance")
      .reduce((s, e) => s + Math.abs(e.amountCents), 0);
  }
  const peerMaintDoor =
    peerProps.length === 0 ? 0 : Math.round(peerMaint / peerProps.length);

  return {
    orgId,
    generatedAt: now(),
    metrics: {
      avgRentCents: avgRent,
      avgCashFlowCents: avgCashFlow,
      occupancyPct,
      maintenancePerDoorCents: maintenancePerDoor,
      peerAvgRentCents: peerRent,
      peerOccupancyPct: peerOcc,
      peerMaintenancePerDoorCents: peerMaintDoor,
    },
    notes:
      "Simple peer metrics from seeded portfolio data — not a live market index.",
  };
}

export function importAccountingCsv(
  store: AppStore,
  actor: SessionUser,
  orgId: string,
  csv: string,
): AccountingImportLine[] {
  assertOrgAccess(store, actor, orgId);
  ensureCommercialDefaults(store);
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const start = lines[0]?.toLowerCase().includes("external") ? 1 : 0;
  const created: AccountingImportLine[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [externalRef, label, amount, postedOn, propertyId] = cols;
    if (!externalRef || !label || !amount) continue;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (Number.isNaN(amountCents)) continue;
    const match = store.ledger.find(
      (e) =>
        Math.abs(e.amountCents) === Math.abs(amountCents) &&
        e.label.toLowerCase().includes(label.slice(0, 12).toLowerCase()),
    );
    const row: AccountingImportLine = {
      id: id("acc"),
      orgId,
      propertyId: propertyId || match?.propertyId || null,
      externalRef,
      label,
      amountCents,
      postedOn: postedOn || now().slice(0, 10),
      matchedLedgerId: match?.id || null,
      status: match ? "matched" : "unmatched",
    };
    store.accountingImports.unshift(row);
    created.push(row);
  }
  pushAudit(store, {
    orgId,
    actorUserId: actor.id,
    action: "accounting.csv_import",
    entityType: "accounting_import",
    entityId: null,
    detail: `Imported ${created.length} line(s)`,
  });
  return created;
}

export function exportAccountingCsv(store: AppStore, orgId: string): string {
  ensureCommercialDefaults(store);
  const rows = store.accountingImports.filter((r) => r.orgId === orgId);
  const header =
    "external_ref,label,amount_dollars,posted_on,property_id,status,matched_ledger_id";
  const body = rows.map(
    (r) =>
      `${r.externalRef},"${r.label.replaceAll('"', '""')}",${(r.amountCents / 100).toFixed(2)},${r.postedOn},${r.propertyId || ""},${r.status},${r.matchedLedgerId || ""}`,
  );
  return [header, ...body].join("\n");
}

export function exportAuditJson(store: AppStore, orgId: string | null) {
  ensureCommercialDefaults(store);
  const logs = store.auditLogs.filter((a) =>
    orgId ? a.orgId === orgId : true,
  );
  return {
    exportedAt: now(),
    orgId,
    count: logs.length,
    logs,
  };
}

export function preferredVendors(store: AppStore, orgId: string) {
  ensureCommercialDefaults(store);
  return store.vendors.filter(
    (v) => (v.orgId || "org-pilot") === orgId && v.preferred !== false,
  );
}

export function seedPhase3Commercial(store: AppStore) {
  ensureCommercialDefaults(store);
  if (store.organizations.some((o) => o.id === "org-pilot")) {
    // still ensure beachy org exists
  } else {
    store.organizations.push({
      id: "org-pilot",
      name: "PropertMax Pilot Org",
      slug: "pilot",
      billingUserId: "user-owner",
      createdAt: "2026-08-01T12:00:00.000Z",
    });
  }

  if (!store.organizations.some((o) => o.id === "org-beachy")) {
    store.organizations.push({
      id: "org-beachy",
      name: "Beachy Renovations PM",
      slug: "beachy",
      billingUserId: "user-beachy-owner",
      createdAt: "2026-10-01T12:00:00.000Z",
    });
  }

  // Beachy users
  if (!store.users.some((u) => u.id === "user-beachy-owner")) {
    store.users.push({
      id: "user-beachy-owner",
      email: "owner@beachy.demo",
      name: "Taylor Beach",
      role: "owner",
      password: "pilot",
      orgIds: ["org-beachy"],
      mfaEnabled: false,
    });
  }
  if (!store.users.some((u) => u.id === "user-beachy-manager")) {
    store.users.push({
      id: "user-beachy-manager",
      email: "manager@beachy.demo",
      name: "Riley Sands",
      role: "manager",
      password: "pilot",
      orgIds: ["org-beachy"],
      mfaEnabled: false,
    });
  }
  if (!store.users.some((u) => u.id === "user-beachy-tenant")) {
    store.users.push({
      id: "user-beachy-tenant",
      email: "tenant@beachy.demo",
      name: "Casey Dunes",
      role: "tenant",
      password: "pilot",
      orgIds: ["org-beachy"],
      mfaEnabled: false,
    });
  }

  // Ensure pilot users have orgIds
  for (const uid of [
    "user-owner",
    "user-manager",
    "user-tenant",
    "user-contractor",
  ]) {
    const u = store.users.find((x) => x.id === uid);
    if (u) {
      u.orgIds = Array.from(new Set([...(u.orgIds || []), "org-pilot"]));
    }
  }

  const ensureMembership = (
    orgId: string,
    userId: string,
    role: Membership["role"],
  ) => {
    if (
      !store.memberships.some((m) => m.orgId === orgId && m.userId === userId)
    ) {
      store.memberships.push({
        id: `mem-${orgId}-${userId}`,
        orgId,
        userId,
        role,
        createdAt: "2026-10-01T12:00:00.000Z",
      });
    }
  };
  ensureMembership("org-pilot", "user-owner", "owner");
  ensureMembership("org-pilot", "user-manager", "manager");
  ensureMembership("org-pilot", "user-tenant", "tenant");
  ensureMembership("org-pilot", "user-contractor", "contractor");
  ensureMembership("org-beachy", "user-beachy-owner", "owner");
  ensureMembership("org-beachy", "user-beachy-manager", "manager");
  ensureMembership("org-beachy", "user-beachy-tenant", "tenant");

  // Maple belongs to pilot
  const maple = store.properties.find((p) => p.id === "prop-maple");
  if (maple) maple.orgId = "org-pilot";

  // Second property in pilot + Beachy property
  if (!store.properties.some((p) => p.id === "prop-ocean")) {
    store.properties.push({
      id: "prop-ocean",
      orgId: "org-pilot",
      name: "12 Ocean View Ct",
      address: "12 Ocean View Ct, Virginia Beach, VA 23451",
      type: "Condo",
      beds: 2,
      baths: 2,
      sqft: 1120,
      occupancy: "Occupied",
      ownerId: "user-owner",
      managerId: "user-manager",
      tenantIds: ["user-tenant"],
      ownerApprovalThresholdCents: 15000,
      monthlyRent: 1650,
      leaseEnd: "Jun 30, 2027",
      notes: "Second door in pilot portfolio for multi-property projections.",
    });
    store.units.push({
      id: "unit-ocean-main",
      propertyId: "prop-ocean",
      label: "Unit A",
      beds: 2,
      baths: 2,
      sqft: 1120,
      occupancy: "Occupied",
      monthlyRentCents: 165000,
    });
    store.leases.push({
      id: "lease-ocean-2026",
      propertyId: "prop-ocean",
      unitId: "unit-ocean-main",
      tenantIds: ["user-tenant"],
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      monthlyRentCents: 165000,
      depositCents: 165000,
      status: "active",
      notes: "Condo lease · HOA dues owner-paid.",
    });
    store.projectionAssumptions.push({
      propertyId: "prop-ocean",
      monthlyRentCents: 165000,
      vacancyRatePct: 5,
      monthlyRepairsCents: 7500,
      monthlyMortgageCents: 52000,
      monthlyTaxesCents: 21000,
      monthlyInsuranceCents: 9000,
      monthlyPmFeeCents: 13200,
      monthlyHoaCents: 28500,
      monthlyUtilitiesOwnerCents: 2500,
      annualRentGrowthPct: 2,
      renovationSpendCents: 0,
      renovationMonthOffset: 6,
      renovationRentUpliftCents: 0,
      vacancyMonthsOnTurnover: 1,
    });
    store.automationPolicies.push({
      id: "policy-prop-ocean",
      propertyId: "prop-ocean",
      name: "Ocean View spend policy",
      spendThresholdCents: 15000,
      preapprovedCategories: ["Plumbing"],
      emergencyProcess:
        "Notify manager then owner. AI recommendations never authorize spend.",
      preferredVendorIds: ["vendor-beach-plumbing"],
      escalationContactUserId: "user-manager",
      maxWaitHours: 36,
      enabled: true,
    });
    store.ledger.push({
      id: "led-ocean-rent",
      propertyId: "prop-ocean",
      month: "2026-11",
      category: "rent",
      label: "November rent collected",
      amountCents: 165000,
      source: "illustrative",
      createdAt: "2026-11-02T12:00:00.000Z",
    });
    store.ledger.push({
      id: "led-ocean-pm",
      propertyId: "prop-ocean",
      month: "2026-11",
      category: "pm_fee",
      label: "Property management fee (8%)",
      amountCents: -13200,
      source: "illustrative",
      createdAt: "2026-11-02T12:05:00.000Z",
    });
  }

  if (!store.properties.some((p) => p.id === "prop-beachy-1")) {
    store.properties.push({
      id: "prop-beachy-1",
      orgId: "org-beachy",
      name: "88 Coastal Ave",
      address: "88 Coastal Ave, Virginia Beach, VA 23451",
      type: "Single-family",
      beds: 4,
      baths: 3,
      sqft: 2200,
      occupancy: "Vacant",
      ownerId: "user-beachy-owner",
      managerId: "user-beachy-manager",
      tenantIds: [],
      ownerApprovalThresholdCents: 25000,
      monthlyRent: 2450,
      leaseEnd: "Vacant · marketing",
      notes: "Beachy Renovations white-label demo property.",
    });
    store.units.push({
      id: "unit-beachy-1",
      propertyId: "prop-beachy-1",
      label: "Main house",
      beds: 4,
      baths: 3,
      sqft: 2200,
      occupancy: "Vacant",
      monthlyRentCents: 245000,
    });
    store.projectionAssumptions.push({
      propertyId: "prop-beachy-1",
      monthlyRentCents: 245000,
      vacancyRatePct: 8,
      monthlyRepairsCents: 12000,
      monthlyMortgageCents: 98000,
      monthlyTaxesCents: 34000,
      monthlyInsuranceCents: 14000,
      monthlyPmFeeCents: 19600,
      monthlyHoaCents: 0,
      monthlyUtilitiesOwnerCents: 8000,
      annualRentGrowthPct: 3,
      renovationSpendCents: 4200000,
      renovationMonthOffset: 1,
      renovationRentUpliftCents: 25000,
      vacancyMonthsOnTurnover: 2,
    });
    store.automationPolicies.push({
      id: "policy-prop-beachy-1",
      propertyId: "prop-beachy-1",
      name: "Beachy default policy",
      spendThresholdCents: 25000,
      preapprovedCategories: ["Plumbing", "Electrical"],
      emergencyProcess: "Escalate to Beachy ops lead immediately.",
      preferredVendorIds: [],
      escalationContactUserId: "user-beachy-manager",
      maxWaitHours: 24,
      enabled: true,
    });
  }

  // Vendor network
  const beachPlumbing = store.vendors.find((v) => v.id === "vendor-beach-plumbing");
  if (beachPlumbing) {
    beachPlumbing.orgId = "org-pilot";
    beachPlumbing.preferred = true;
    beachPlumbing.serviceArea = "Virginia Beach";
    beachPlumbing.rating = 4.8;
  }
  if (!store.vendors.some((v) => v.id === "vendor-beachy-hvac")) {
    store.vendors.push({
      id: "vendor-beachy-hvac",
      name: "Coastal Air Pros",
      trade: "HVAC",
      contractorUserId: "user-contractor",
      orgId: "org-pilot",
      preferred: true,
      serviceArea: "Hampton Roads",
      rating: 4.6,
    });
  }
  if (!store.vendors.some((v) => v.id === "vendor-beachy-paint")) {
    store.vendors.push({
      id: "vendor-beachy-paint",
      name: "Beachy Finish Co.",
      trade: "Paint / finishes",
      contractorUserId: "user-contractor",
      orgId: "org-beachy",
      preferred: true,
      serviceArea: "Virginia Beach",
      rating: 4.9,
    });
  }

  // SaaS subscriptions
  if (!store.saasSubscriptions.some((s) => s.orgId === "org-pilot")) {
    store.saasSubscriptions.push({
      id: "sub-pilot",
      orgId: "org-pilot",
      plan: "growth",
      status: "active",
      provider: "demo",
      externalId: null,
      seats: 4,
      unitAmountCents: 9900,
      currentPeriodEnd: "2026-12-22T00:00:00.000Z",
      updatedAt: "2026-11-01T12:00:00.000Z",
    });
    store.saasInvoices.push({
      id: "inv-pilot-1",
      orgId: "org-pilot",
      subscriptionId: "sub-pilot",
      amountCents: 9900,
      status: "demo",
      label: "DEMO invoice — growth plan (not a real charge)",
      issuedAt: "2026-11-01T12:00:00.000Z",
      demo: true,
    });
  }
  if (!store.saasSubscriptions.some((s) => s.orgId === "org-beachy")) {
    store.saasSubscriptions.push({
      id: "sub-beachy",
      orgId: "org-beachy",
      plan: "portfolio",
      status: "trialing",
      provider: "demo",
      externalId: null,
      seats: 3,
      unitAmountCents: 24900,
      currentPeriodEnd: "2026-12-01T00:00:00.000Z",
      updatedAt: "2026-11-01T12:00:00.000Z",
    });
  }

  // White-label Beachy
  if (!store.whiteLabelThemes.some((t) => t.orgId === "org-beachy")) {
    store.whiteLabelThemes.push({
      orgId: "org-beachy",
      brandName: "Beachy Renovations",
      logoText: "Beachy Renovations",
      tagline: "Coastal property ops · renovation-led PM",
      primaryColor: "#0ea5e9",
      accentColor: "#0369a1",
      surfaceColor: "#e0f2fe",
      mark: "BR",
    });
  }
  if (!store.whiteLabelThemes.some((t) => t.orgId === "org-pilot")) {
    store.whiteLabelThemes.push({
      orgId: "org-pilot",
      brandName: "PropertMax",
      logoText: "PropertMax",
      tagline: "Phase 3 commercial pilot",
      primaryColor: "#0f766e",
      accentColor: "#134e4a",
      surfaceColor: "#f0fdfa",
      mark: "PM",
    });
  }

  if (store.monitoringEvents.length === 0) {
    pushMonitor(
      store,
      "info",
      "phase3.boot",
      "Commercial platform seeded (multi-org, SaaS demo billing, white-label).",
    );
  }
}
