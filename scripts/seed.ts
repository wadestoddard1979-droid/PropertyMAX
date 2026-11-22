/**
 * Seed entrypoint.
 * - Without Supabase env: writes data/propertmax-store.json
 * - With Supabase env: applies createSeedStore() into Postgres
 *
 *   npm run seed
 *   npm run seed:supabase   (alias; requires env)
 */
import { createSeedStore } from "../src/lib/server/seed";
import { promises as fs } from "fs";
import path from "path";

async function seedLocal() {
  const store = createSeedStore();
  const dir = path.join(process.cwd(), "data");
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, "propertmax-store.json");
  await fs.writeFile(target, JSON.stringify(store, null, 2), "utf8");
  console.log(`Seeded local JSON → ${target}`);
}

async function seedSupabase() {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !service || !anon) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  const { persistStoreToSupabase } = await import(
    "../src/lib/server/supabase/store"
  );
  const store = createSeedStore();
  await persistStoreToSupabase(store);
  console.log("Seeded Supabase Postgres from createSeedStore()");
  console.log(
    "Optional: create matching auth.users in Supabase Auth for each pilot email, then link profiles.auth_user_id.",
  );
}

async function main() {
  const forceSupabase =
    process.argv.includes("--supabase") ||
    process.env.SEED_TARGET === "supabase";
  if (forceSupabase) {
    await seedSupabase();
    return;
  }
  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SEED_TARGET !== "local"
  ) {
    await seedSupabase();
    return;
  }
  await seedLocal();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
