import { promises as fs } from "fs";
import path from "path";
import { getPersistenceMode } from "./config";
import { createSeedStore, defaultAssumptions } from "./seed";
import {
  loadStoreFromSupabase,
  persistStoreToSupabase,
} from "./supabase/store";
import type { AppStore } from "../types";

/**
 * Persistence facade.
 * - Without Supabase env: local JSON (demo / CI / build without secrets)
 * - With Supabase env: Postgres is the primary store (JSON is not written)
 */
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "propertmax-store.json");

let writeChain: Promise<unknown> = Promise.resolve();
let supabaseMemory: AppStore | null = null;

function migrateStore(store: AppStore): AppStore {
  if (!store.ledger) store.ledger = [];
  if (!store.projectionAssumptions) store.projectionAssumptions = [];
  if (!store.units) store.units = [];
  if (!store.leases) store.leases = [];
  if (!store.documents) store.documents = [];
  if (!store.messageThreads) store.messageThreads = [];
  if (!store.messages) store.messages = [];
  if (!store.intakeAudits) store.intakeAudits = [];
  if (!store.automationPolicies) store.automationPolicies = [];
  for (const w of store.workOrders || []) {
    if (w.intakeAuditId === undefined) w.intakeAuditId = null;
    if (w.emergencyFlag === undefined) w.emergencyFlag = false;
    if (w.policyDecisionReason === undefined) w.policyDecisionReason = null;
    if (w.quoteRequestedAt === undefined) w.quoteRequestedAt = null;
    if (w.escalationDueAt === undefined) w.escalationDueAt = null;
  }
  for (const p of store.properties || []) {
    if (!store.automationPolicies.some((x) => x.propertyId === p.id)) {
      store.automationPolicies.push({
        id: `policy-${p.id}`,
        propertyId: p.id,
        name: "Default spend & vendor policy",
        spendThresholdCents: p.ownerApprovalThresholdCents,
        preapprovedCategories: ["Plumbing", "Electrical"],
        emergencyProcess:
          "If emergency flag: notify manager immediately, then owner. AI recommendations never authorize spend.",
        preferredVendorIds: (store.vendors || []).map((v) => v.id),
        escalationContactUserId: p.managerId,
        maxWaitHours: 48,
        enabled: true,
      });
    }
  }

  for (const p of store.properties || []) {
    if (!store.projectionAssumptions.some((a) => a.propertyId === p.id)) {
      store.projectionAssumptions.push(defaultAssumptions(p.id));
    }
    if (!store.units.some((u) => u.propertyId === p.id)) {
      store.units.push({
        id: `unit-${p.id}`,
        propertyId: p.id,
        label: "Main unit",
        beds: p.beds,
        baths: p.baths,
        sqft: p.sqft,
        occupancy: p.occupancy,
        monthlyRentCents: Math.round(p.monthlyRent * 100),
      });
    }
    if (!store.leases.some((l) => l.propertyId === p.id)) {
      const unit = store.units.find((u) => u.propertyId === p.id)!;
      store.leases.push({
        id: `lease-${p.id}`,
        propertyId: p.id,
        unitId: unit.id,
        tenantIds: [...p.tenantIds],
        startDate: "2026-09-01",
        endDate: "2027-08-31",
        monthlyRentCents: unit.monthlyRentCents,
        depositCents: unit.monthlyRentCents,
        status: p.occupancy === "Occupied" ? "active" : "ended",
        notes: "Migrated from Phase 1 property fields.",
      });
    }
  }

  store.version = 5;
  return store;
}

async function ensureJsonStore(): Promise<AppStore> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return migrateStore(JSON.parse(raw) as AppStore);
  } catch {
    const seeded = createSeedStore();
    await fs.writeFile(STORE_PATH, JSON.stringify(seeded, null, 2), "utf8");
    return seeded;
  }
}

async function ensureStore(): Promise<AppStore> {
  if (getPersistenceMode() === "supabase") {
    if (!supabaseMemory) {
      supabaseMemory = migrateStore(await loadStoreFromSupabase());
    }
    return supabaseMemory;
  }
  return ensureJsonStore();
}

export async function readStore(): Promise<AppStore> {
  return ensureStore();
}

export async function updateStore(
  mutator: (store: AppStore) => void | Promise<void>,
): Promise<AppStore> {
  const run = writeChain.then(async () => {
    const store = await ensureStore();
    await mutator(store);
    if (getPersistenceMode() === "supabase") {
      supabaseMemory = store;
      await persistStoreToSupabase(store);
    } else {
      await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
    }
    return store;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function resetStore(): Promise<AppStore> {
  return updateStore(async (store) => {
    const fresh = createSeedStore();
    Object.assign(store, fresh);
  });
}

export function formatMoneyFromCents(cents: number) {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function persistenceLabel() {
  return getPersistenceMode() === "supabase"
    ? "supabase-postgres"
    : "local-json";
}
