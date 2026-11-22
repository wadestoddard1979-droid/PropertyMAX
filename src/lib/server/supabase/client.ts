import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "../config";

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (!adminClient) {
    const { url, serviceRoleKey } = getSupabaseEnv();
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function getAnonClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  if (!anonClient) {
    const { url, anonKey } = getSupabaseEnv();
    anonClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anonClient;
}
