import { promises as fs } from "fs";
import path from "path";
import { createSeedStore, defaultAssumptions } from "./seed";
import type { AppStore } from "../types";

/**
 * Local durable JSON store for Phase 1 pilot.
 * TODO(supabase): Replace with Postgres (Supabase) + RLS. Keep the same
 * domain types in src/lib/types.ts when migrating.
 */
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "propertmax-store.json");

let writeChain: Promise<unknown> = Promise.resolve();

function migrateStore(store: AppStore): AppStore {
  if (!store.ledger) store.ledger = [];
  if (!store.projectionAssumptions) store.projectionAssumptions = [];
  for (const p of store.properties || []) {
    if (!store.projectionAssumptions.some((a) => a.propertyId === p.id)) {
      store.projectionAssumptions.push(defaultAssumptions(p.id));
    }
  }
  store.version = 2;
  return store;
}

async function ensureStore(): Promise<AppStore> {
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

export async function readStore(): Promise<AppStore> {
  return ensureStore();
}

export async function updateStore(
  mutator: (store: AppStore) => void | Promise<void>,
): Promise<AppStore> {
  const run = writeChain.then(async () => {
    const store = await ensureStore();
    await mutator(store);
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
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
