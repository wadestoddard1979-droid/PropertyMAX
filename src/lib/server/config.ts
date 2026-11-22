/**
 * Runtime persistence / auth mode.
 * Without Supabase env vars the app stays on the local JSON demo store so
 * `npm run build` and pilot logins work with zero secrets.
 */

export type PersistenceMode = "local-json" | "supabase";

export function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL?.trim() || "";
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  return { url, anonKey, serviceRoleKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  return Boolean(url && anonKey && serviceRoleKey);
}

export function getPersistenceMode(): PersistenceMode {
  return isSupabaseConfigured() ? "supabase" : "local-json";
}

/** Demo cookie logins for *.propertmax.demo — default on unless explicitly disabled. */
export function allowDemoLogin(): boolean {
  if (process.env.ALLOW_DEMO_LOGIN === "false") return false;
  if (process.env.ALLOW_DEMO_LOGIN === "true") return true;
  // Keep pilot UX working in local/dev even when Supabase is wired.
  return true;
}

export function systemStatus() {
  const mode = getPersistenceMode();
  return {
    persistence: mode,
    supabaseConfigured: isSupabaseConfigured(),
    allowDemoLogin: allowDemoLogin(),
    auth:
      mode === "supabase"
        ? "supabase-auth-with-demo-fallback"
        : "cookie-demo",
    jobQueue:
      mode === "supabase" ? "db-backed (job_queue)" : "in-process + local JSON",
    documentStorage:
      mode === "supabase" ? "supabase-storage:documents" : "metadata-only",
    productionQueueNote:
      "Production choice: keep DB-backed job_queue for pilot volume, or swap the JobQueue adapter to Inngest / Cloud Tasks / SQS without changing call sites.",
  };
}
