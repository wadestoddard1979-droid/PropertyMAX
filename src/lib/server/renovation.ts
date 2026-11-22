import { randomUUID } from "crypto";
import type {
  AppStore,
  AssetRecord,
  RenovationChangeOrder,
  RenovationMilestone,
  RenovationProject,
  RenoStatus,
  SessionUser,
  TurnoverChecklist,
  TurnoverChecklistItem,
} from "../types";
import { getAssumptions } from "./financials";

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

export function ensureRenoDefaults(store: AppStore) {
  if (!store.renovationProjects) store.renovationProjects = [];
  if (!store.turnoverChecklists) store.turnoverChecklists = [];
  if (!store.assets) store.assets = [];
}

function assertOwnerOrManager(
  store: AppStore,
  actor: SessionUser,
  propertyId: string,
) {
  const property = store.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error("Property not found");
  if (actor.role === "owner" && property.ownerId === actor.id) return property;
  if (actor.role === "manager" && property.managerId === actor.id)
    return property;
  throw new Error("Forbidden");
}

export function listRenoProjects(store: AppStore, propertyId: string) {
  ensureRenoDefaults(store);
  return store.renovationProjects.filter((p) => p.propertyId === propertyId);
}

export function createRenoProject(
  store: AppStore,
  actor: SessionUser,
  input: {
    propertyId: string;
    title: string;
    scope: string;
    budgetCents: number;
    vendorId?: string | null;
  },
): RenovationProject {
  ensureRenoDefaults(store);
  if (actor.role !== "manager" && actor.role !== "owner") {
    throw new Error("Only manager or owner can create renovation projects");
  }
  const property = assertOwnerOrManager(store, actor, input.propertyId);
  const unit = store.units.find((u) => u.propertyId === property.id) || null;
  const project: RenovationProject = {
    id: id("reno"),
    propertyId: property.id,
    unitId: unit?.id ?? null,
    title: input.title.trim(),
    scope: input.scope.trim(),
    budgetCents: input.budgetCents,
    spentCents: 0,
    status: "proposed",
    ownerDecision: "pending",
    ownerNote: null,
    managerUserId: property.managerId,
    vendorId: input.vendorId ?? null,
    milestones: [
      {
        id: id("ms"),
        title: "Scope locked",
        status: "done",
        percent: 10,
        updatedAt: now(),
      },
      {
        id: id("ms"),
        title: "Owner approval",
        status: "in_progress",
        percent: 0,
        updatedAt: now(),
      },
      {
        id: id("ms"),
        title: "Demo / prep",
        status: "pending",
        percent: 0,
        updatedAt: now(),
      },
      {
        id: id("ms"),
        title: "Install / finishes",
        status: "pending",
        percent: 0,
        updatedAt: now(),
      },
      {
        id: id("ms"),
        title: "Punch / closeout",
        status: "pending",
        percent: 0,
        updatedAt: now(),
      },
    ],
    changeOrders: [],
    progressPct: 10,
    createdAt: now(),
    updatedAt: now(),
  };
  store.renovationProjects.unshift(project);
  project.status = "awaiting_owner_approval";
  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: property.id,
    actorUserId: actor.id,
    kind: "reno.created",
    message: `${actor.name} proposed renovation “${project.title}” (budget $${(project.budgetCents / 100).toFixed(0)}).`,
    createdAt: now(),
  });
  store.notifications.unshift({
    id: id("notif"),
    userId: property.ownerId,
    workOrderId: null,
    title: "Renovation approval needed",
    body: `${project.title} · $${(project.budgetCents / 100).toFixed(0)} budget`,
    read: false,
    createdAt: now(),
  });
  return project;
}

export function decideRenoProject(
  store: AppStore,
  actor: SessionUser,
  projectId: string,
  decision: "approved" | "declined",
  note?: string,
) {
  ensureRenoDefaults(store);
  if (actor.role !== "owner") throw new Error("Only owner can approve renovations");
  const project = store.renovationProjects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  assertOwnerOrManager(store, actor, project.propertyId);
  project.ownerDecision = decision;
  project.ownerNote = note?.trim() || null;
  project.status = decision === "approved" ? "approved" : "canceled";
  project.updatedAt = now();
  const approvalMs = project.milestones.find((m) =>
    m.title.toLowerCase().includes("approval"),
  );
  if (approvalMs) {
    approvalMs.status = decision === "approved" ? "done" : "pending";
    approvalMs.percent = decision === "approved" ? 100 : 0;
    approvalMs.updatedAt = now();
  }
  if (decision === "approved") project.progressPct = Math.max(project.progressPct, 20);
  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: project.propertyId,
    actorUserId: actor.id,
    kind: `reno.${decision}`,
    message: `Owner ${decision} renovation “${project.title}”.`,
    createdAt: now(),
  });
  store.notifications.unshift({
    id: id("notif"),
    userId: project.managerUserId,
    workOrderId: null,
    title: `Renovation ${decision}`,
    body: project.title,
    read: false,
    createdAt: now(),
  });
  return project;
}

export function updateRenoProgress(
  store: AppStore,
  actor: SessionUser,
  projectId: string,
  input: {
    status?: RenoStatus;
    spentCents?: number;
    progressPct?: number;
    milestones?: RenovationMilestone[];
  },
) {
  ensureRenoDefaults(store);
  if (actor.role !== "manager" && actor.role !== "owner") {
    throw new Error("Forbidden");
  }
  const project = store.renovationProjects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  assertOwnerOrManager(store, actor, project.propertyId);
  if (input.status) project.status = input.status;
  if (typeof input.spentCents === "number") project.spentCents = input.spentCents;
  if (typeof input.progressPct === "number") {
    project.progressPct = Math.min(100, Math.max(0, input.progressPct));
  }
  if (input.milestones) project.milestones = input.milestones;
  project.updatedAt = now();
  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: project.propertyId,
    actorUserId: actor.id,
    kind: "reno.progress",
    message: `Progress on “${project.title}” → ${project.progressPct}% (${project.status}).`,
    createdAt: now(),
  });
  return project;
}

export function addChangeOrder(
  store: AppStore,
  actor: SessionUser,
  projectId: string,
  input: { title: string; amountCents: number; note?: string },
): RenovationChangeOrder {
  ensureRenoDefaults(store);
  if (actor.role !== "manager") {
    throw new Error("Managers propose change orders");
  }
  const project = store.renovationProjects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  assertOwnerOrManager(store, actor, project.propertyId);
  const co: RenovationChangeOrder = {
    id: id("co"),
    title: input.title.trim(),
    amountCents: input.amountCents,
    status: "proposed",
    note: input.note?.trim() || "",
    createdAt: now(),
    decidedAt: null,
  };
  project.changeOrders.unshift(co);
  project.updatedAt = now();
  const property = store.properties.find((p) => p.id === project.propertyId)!;
  store.notifications.unshift({
    id: id("notif"),
    userId: property.ownerId,
    workOrderId: null,
    title: "Change order proposed",
    body: `${co.title} · $${(co.amountCents / 100).toFixed(0)} on ${project.title}`,
    read: false,
    createdAt: now(),
  });
  return co;
}

export function decideChangeOrder(
  store: AppStore,
  actor: SessionUser,
  projectId: string,
  changeOrderId: string,
  decision: "approved" | "declined",
) {
  ensureRenoDefaults(store);
  if (actor.role !== "owner") throw new Error("Only owner decides change orders");
  const project = store.renovationProjects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  assertOwnerOrManager(store, actor, project.propertyId);
  const co = project.changeOrders.find((c) => c.id === changeOrderId);
  if (!co) throw new Error("Change order not found");
  co.status = decision;
  co.decidedAt = now();
  if (decision === "approved") {
    project.budgetCents += co.amountCents;
  }
  project.updatedAt = now();
  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: project.propertyId,
    actorUserId: actor.id,
    kind: `reno.change_order_${decision}`,
    message: `Change order “${co.title}” ${decision}.`,
    createdAt: now(),
  });
  return { project, changeOrder: co };
}

export function vacancyCostInsight(
  store: AppStore,
  propertyId: string,
  vacancyMonths?: number,
) {
  const assumptions = getAssumptions(store, propertyId);
  const months = vacancyMonths ?? assumptions.vacancyMonthsOnTurnover;
  const monthlyRent = assumptions.monthlyRentCents;
  const carrying =
    assumptions.monthlyMortgageCents +
    assumptions.monthlyTaxesCents +
    assumptions.monthlyInsuranceCents +
    assumptions.monthlyHoaCents +
    assumptions.monthlyUtilitiesOwnerCents;
  const lostRent = Math.round(monthlyRent * months);
  const carryingCost = Math.round(carrying * months);
  return {
    vacancyMonths: months,
    lostRentCents: lostRent,
    carryingCostCents: carryingCost,
    totalVacancyCostCents: lostRent + carryingCost,
    label: `${months} mo vacancy ≈ $${((lostRent + carryingCost) / 100).toLocaleString()} (lost rent + carrying costs)`,
  };
}

export function createTurnoverChecklist(
  store: AppStore,
  actor: SessionUser,
  input: {
    propertyId: string;
    moveOutDate: string;
    leaseId?: string | null;
  },
): TurnoverChecklist {
  ensureRenoDefaults(store);
  if (actor.role !== "manager" && actor.role !== "owner") {
    throw new Error("Forbidden");
  }
  const property = assertOwnerOrManager(store, actor, input.propertyId);
  const unit = store.units.find((u) => u.propertyId === property.id) || null;
  const insight = vacancyCostInsight(store, property.id);
  const defaults: Omit<TurnoverChecklistItem, "id">[] = [
    { label: "Notice received / keys timeline confirmed", done: false, note: null },
    { label: "Move-out inspection scheduled", done: false, note: null },
    { label: "Photos & condition report", done: false, note: null },
    { label: "Cleaning bid", done: false, note: null },
    { label: "Paint / patch touch-ups", done: false, note: null },
    { label: "Appliance function check", done: false, note: null },
    { label: "HVAC filter + thermostat check", done: false, note: null },
    { label: "Lock / rekey if required", done: false, note: null },
    { label: "Utilities transfer / vacancy set", done: false, note: null },
    { label: "Listing photos / marketing ready", done: false, note: null },
  ];
  const checklist: TurnoverChecklist = {
    id: id("turn"),
    propertyId: property.id,
    unitId: unit?.id ?? null,
    leaseId: input.leaseId ?? store.leases.find((l) => l.propertyId === property.id)?.id ?? null,
    title: `Turnover · ${property.name}`,
    moveOutDate: input.moveOutDate,
    status: "open",
    items: defaults.map((d) => ({ ...d, id: id("ti") })),
    vacancyMonthsAssumed: insight.vacancyMonths,
    vacancyCostCents: insight.totalVacancyCostCents,
    createdAt: now(),
    updatedAt: now(),
  };
  store.turnoverChecklists.unshift(checklist);
  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: property.id,
    actorUserId: actor.id,
    kind: "turnover.created",
    message: `Turnover checklist opened for move-out ${input.moveOutDate}. ${insight.label}`,
    createdAt: now(),
  });
  return checklist;
}

export function patchTurnoverChecklist(
  store: AppStore,
  actor: SessionUser,
  checklistId: string,
  input: {
    status?: TurnoverChecklist["status"];
    items?: TurnoverChecklistItem[];
  },
) {
  ensureRenoDefaults(store);
  const checklist = store.turnoverChecklists.find((c) => c.id === checklistId);
  if (!checklist) throw new Error("Checklist not found");
  assertOwnerOrManager(store, actor, checklist.propertyId);
  if (input.status) checklist.status = input.status;
  if (input.items) checklist.items = input.items;
  const done = checklist.items.filter((i) => i.done).length;
  if (done === checklist.items.length) checklist.status = "ready";
  else if (done > 0 && checklist.status === "open") checklist.status = "in_progress";
  checklist.updatedAt = now();
  return checklist;
}

export function listAssets(store: AppStore, propertyId: string) {
  ensureRenoDefaults(store);
  return store.assets.filter((a) => a.propertyId === propertyId);
}

export function upsertAsset(
  store: AppStore,
  actor: SessionUser,
  input: Partial<AssetRecord> & {
    propertyId: string;
    name: string;
    category: AssetRecord["category"];
  },
): AssetRecord {
  ensureRenoDefaults(store);
  assertOwnerOrManager(store, actor, input.propertyId);
  const existing = input.id
    ? store.assets.find((a) => a.id === input.id)
    : undefined;
  if (existing) {
    Object.assign(existing, {
      ...input,
      updatedAt: now(),
    });
    return existing;
  }
  const unit =
    store.units.find((u) => u.propertyId === input.propertyId) || null;
  const asset: AssetRecord = {
    id: id("asset"),
    propertyId: input.propertyId,
    unitId: input.unitId ?? unit?.id ?? null,
    category: input.category,
    name: input.name.trim(),
    makeModel: input.makeModel ?? null,
    serialNumber: input.serialNumber ?? null,
    installedAt: input.installedAt ?? null,
    warrantyEndsAt: input.warrantyEndsAt ?? null,
    expectedLifeYears: input.expectedLifeYears ?? null,
    notes: input.notes ?? null,
    createdAt: now(),
    updatedAt: now(),
  };
  store.assets.unshift(asset);
  return asset;
}

export function seedMapleRenoBundle(store: AppStore) {
  ensureRenoDefaults(store);
  if (store.renovationProjects.some((p) => p.propertyId === "prop-maple")) {
    return;
  }
  const ts = "2026-10-01T12:00:00.000Z";
  store.renovationProjects.push({
    id: "reno-maple-kitchen",
    propertyId: "prop-maple",
    unitId: "unit-maple-main",
    title: "Kitchen turnover refresh",
    scope:
      "Countertop refresh, faucet, cabinet hardware, paint, and appliance deep-clean for post-tenant turnover readiness.",
    budgetCents: 1850000,
    spentCents: 420000,
    status: "in_progress",
    ownerDecision: "approved",
    ownerNote: "Approved with preferred vendor set.",
    managerUserId: "user-manager",
    vendorId: "vendor-beach-plumbing",
    milestones: [
      {
        id: "ms-1",
        title: "Scope locked",
        status: "done",
        percent: 100,
        updatedAt: ts,
      },
      {
        id: "ms-2",
        title: "Owner approval",
        status: "done",
        percent: 100,
        updatedAt: "2026-10-05T15:00:00.000Z",
      },
      {
        id: "ms-3",
        title: "Demo / prep",
        status: "done",
        percent: 100,
        updatedAt: "2026-10-20T15:00:00.000Z",
      },
      {
        id: "ms-4",
        title: "Install / finishes",
        status: "in_progress",
        percent: 55,
        updatedAt: "2026-11-10T15:00:00.000Z",
      },
      {
        id: "ms-5",
        title: "Punch / closeout",
        status: "pending",
        percent: 0,
        updatedAt: ts,
      },
    ],
    changeOrders: [
      {
        id: "co-maple-1",
        title: "Upgrade to soft-close drawer hardware",
        amountCents: 85000,
        status: "proposed",
        note: "Labor + materials delta vs base hardware allowance.",
        createdAt: "2026-11-12T16:00:00.000Z",
        decidedAt: null,
      },
    ],
    progressPct: 62,
    createdAt: ts,
    updatedAt: "2026-11-12T16:00:00.000Z",
  });

  if (!store.turnoverChecklists.some((t) => t.propertyId === "prop-maple")) {
    const insight = vacancyCostInsight(store, "prop-maple", 1.5);
    store.turnoverChecklists.push({
      id: "turn-maple-1",
      propertyId: "prop-maple",
      unitId: "unit-maple-main",
      leaseId: "lease-maple-2026",
      title: "Turnover · 847 Maple Lane",
      moveOutDate: "2027-08-31",
      status: "open",
      items: [
        {
          id: "ti-1",
          label: "Notice received / keys timeline confirmed",
          done: false,
          note: null,
        },
        {
          id: "ti-2",
          label: "Move-out inspection scheduled",
          done: false,
          note: null,
        },
        {
          id: "ti-3",
          label: "Photos & condition report",
          done: false,
          note: null,
        },
        {
          id: "ti-4",
          label: "Cleaning bid",
          done: false,
          note: null,
        },
        {
          id: "ti-5",
          label: "Paint / patch touch-ups",
          done: false,
          note: null,
        },
        {
          id: "ti-6",
          label: "Appliance function check",
          done: false,
          note: null,
        },
        {
          id: "ti-7",
          label: "HVAC filter + thermostat check",
          done: false,
          note: null,
        },
        {
          id: "ti-8",
          label: "Lock / rekey if required",
          done: false,
          note: null,
        },
        {
          id: "ti-9",
          label: "Utilities transfer / vacancy set",
          done: false,
          note: null,
        },
        {
          id: "ti-10",
          label: "Listing photos / marketing ready",
          done: false,
          note: null,
        },
      ],
      vacancyMonthsAssumed: insight.vacancyMonths,
      vacancyCostCents: insight.totalVacancyCostCents,
      createdAt: "2026-11-01T12:00:00.000Z",
      updatedAt: "2026-11-01T12:00:00.000Z",
    });
  }

  if (!store.assets.some((a) => a.propertyId === "prop-maple")) {
    const base = "2026-11-01T12:00:00.000Z";
    const starters: Omit<AssetRecord, "id" | "createdAt" | "updatedAt">[] = [
      {
        propertyId: "prop-maple",
        unitId: "unit-maple-main",
        category: "hvac",
        name: "Central HVAC",
        makeModel: "Carrier 24ACC636",
        serialNumber: "HVAC-MAPLE-001",
        installedAt: "2021-06-15",
        warrantyEndsAt: "2031-06-15",
        expectedLifeYears: 15,
        notes: "Annual filter change each spring.",
      },
      {
        propertyId: "prop-maple",
        unitId: "unit-maple-main",
        category: "water_heater",
        name: "Water heater",
        makeModel: "Rheem 50gal",
        serialNumber: "WH-MAPLE-001",
        installedAt: "2019-03-01",
        warrantyEndsAt: "2029-03-01",
        expectedLifeYears: 12,
        notes: null,
      },
      {
        propertyId: "prop-maple",
        unitId: "unit-maple-main",
        category: "appliance",
        name: "Refrigerator",
        makeModel: "GE GTE18GTHWW",
        serialNumber: null,
        installedAt: "2022-09-01",
        warrantyEndsAt: "2025-09-01",
        expectedLifeYears: 12,
        notes: null,
      },
      {
        propertyId: "prop-maple",
        unitId: "unit-maple-main",
        category: "appliance",
        name: "Dishwasher",
        makeModel: "Bosch 300",
        serialNumber: null,
        installedAt: "2022-09-01",
        warrantyEndsAt: "2025-09-01",
        expectedLifeYears: 10,
        notes: null,
      },
      {
        propertyId: "prop-maple",
        unitId: "unit-maple-main",
        category: "appliance",
        name: "Range / oven",
        makeModel: "Frigidaire electric",
        serialNumber: null,
        installedAt: "2020-01-10",
        warrantyEndsAt: null,
        expectedLifeYears: 12,
        notes: null,
      },
      {
        propertyId: "prop-maple",
        unitId: "unit-maple-main",
        category: "appliance",
        name: "Washer / dryer",
        makeModel: "LG stack",
        serialNumber: null,
        installedAt: "2021-11-01",
        warrantyEndsAt: "2024-11-01",
        expectedLifeYears: 10,
        notes: "Tenant-accessible laundry closet.",
      },
    ];
    for (const s of starters) {
      store.assets.push({
        ...s,
        id: id("asset"),
        createdAt: base,
        updatedAt: base,
      });
    }
  }
}
