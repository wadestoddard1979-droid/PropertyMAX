import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { getPersistenceMode } from "../config";
import { getServiceClient } from "../supabase/client";

export type JobKind =
  | "reminder.rent"
  | "reminder.lease_expiry"
  | "approval.escalation"
  | "webhook.payment"
  | "notify.digest"
  | "document.scan";

export type JobRecord = {
  id: string;
  kind: JobKind | string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed" | "dead";
  attempts: number;
  runAfter: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobHandler = (job: JobRecord) => Promise<void>;

/**
 * Durable job queue abstraction.
 *
 * - local-json mode: file-backed queue under data/job-queue.json + in-process drain
 * - supabase mode: Postgres `job_queue` table (service role)
 *
 * Production choice: keep this DB-backed queue for pilot volume, or swap the
 * adapter implementation to Inngest / Cloud Tasks / SQS without changing
 * enqueueJob / processDueJobs call sites.
 */
const LOCAL_PATH = path.join(process.cwd(), "data", "job-queue.json");
const handlers = new Map<string, JobHandler>();

async function readLocal(): Promise<JobRecord[]> {
  try {
    const raw = await fs.readFile(LOCAL_PATH, "utf8");
    return JSON.parse(raw) as JobRecord[];
  } catch {
    return [];
  }
}

async function writeLocal(jobs: JobRecord[]) {
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, JSON.stringify(jobs, null, 2), "utf8");
}

export function registerJobHandler(kind: string, handler: JobHandler) {
  handlers.set(kind, handler);
}

export async function enqueueJob(
  kind: JobKind | string,
  payload: Record<string, unknown> = {},
  opts?: { runAfter?: Date },
): Promise<JobRecord> {
  const now = new Date().toISOString();
  const job: JobRecord = {
    id: `job-${randomUUID().slice(0, 8)}`,
    kind,
    payload,
    status: "pending",
    attempts: 0,
    runAfter: (opts?.runAfter || new Date()).toISOString(),
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  if (getPersistenceMode() === "supabase") {
    const sb = getServiceClient();
    const { error } = await sb.from("job_queue").insert({
      id: job.id,
      kind: job.kind,
      payload: job.payload,
      status: job.status,
      attempts: job.attempts,
      run_after: job.runAfter,
      last_error: null,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    });
    if (error) throw error;
    return job;
  }

  const jobs = await readLocal();
  jobs.push(job);
  await writeLocal(jobs);
  return job;
}

export async function listJobs(limit = 50): Promise<JobRecord[]> {
  if (getPersistenceMode() === "supabase") {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("job_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      kind: row.kind,
      payload: row.payload || {},
      status: row.status,
      attempts: row.attempts,
      runAfter: row.run_after,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
  const jobs = await readLocal();
  return jobs.slice(-limit).reverse();
}

export async function processDueJobs(max = 10): Promise<number> {
  const now = new Date().toISOString();
  let processed = 0;

  if (getPersistenceMode() === "supabase") {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("job_queue")
      .select("*")
      .eq("status", "pending")
      .lte("run_after", now)
      .order("run_after", { ascending: true })
      .limit(max);
    if (error) throw error;
    for (const row of data || []) {
      const job: JobRecord = {
        id: row.id,
        kind: row.kind,
        payload: row.payload || {},
        status: row.status,
        attempts: row.attempts,
        runAfter: row.run_after,
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      await runOne(job, async (next) => {
        await sb
          .from("job_queue")
          .update({
            status: next.status,
            attempts: next.attempts,
            last_error: next.lastError,
            updated_at: next.updatedAt,
          })
          .eq("id", next.id);
      });
      processed += 1;
    }
    return processed;
  }

  const jobs = await readLocal();
  for (const job of jobs) {
    if (processed >= max) break;
    if (job.status !== "pending" || job.runAfter > now) continue;
    await runOne(job, async () => {
      await writeLocal(jobs);
    });
    processed += 1;
  }
  return processed;
}

async function runOne(
  job: JobRecord,
  save: (job: JobRecord) => Promise<void>,
) {
  job.status = "processing";
  job.attempts += 1;
  job.updatedAt = new Date().toISOString();
  await save(job);
  const handler = handlers.get(job.kind);
  try {
    if (handler) await handler(job);
    else {
      // Default no-op completes so reminders/webhooks can be wired later.
      console.info(`[job-queue] no handler for ${job.kind}; marking completed`);
    }
    job.status = "completed";
    job.lastError = null;
  } catch (err) {
    job.lastError = err instanceof Error ? err.message : String(err);
    job.status = job.attempts >= 5 ? "dead" : "failed";
  }
  job.updatedAt = new Date().toISOString();
  if (job.status === "failed") {
    // retry later
    job.status = "pending";
    job.runAfter = new Date(Date.now() + 60_000 * job.attempts).toISOString();
  }
  await save(job);
}

// Built-in handlers for foundation smoke tests
registerJobHandler("reminder.rent", async (job) => {
  console.info("[job-queue] rent reminder", job.payload);
});
registerJobHandler("webhook.payment", async (job) => {
  console.info("[job-queue] payment webhook placeholder", job.payload);
});
registerJobHandler("approval.escalation", async (job) => {
  console.info(
    "[job-queue] approval escalation timer fired",
    job.payload,
  );
});
