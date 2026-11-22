import { systemStatus } from "@/lib/server/config";
import { persistenceLabel } from "@/lib/server/db";
import { listJobs } from "@/lib/server/jobs/queue";

export async function GET() {
  const status = systemStatus();
  let recentJobs: { id: string; kind: string; status: string }[] = [];
  try {
    recentJobs = (await listJobs(5)).map((j) => ({
      id: j.id,
      kind: j.kind,
      status: j.status,
    }));
  } catch {
    recentJobs = [];
  }
  return Response.json({
    ...status,
    persistenceLabel: persistenceLabel(),
    recentJobs,
  });
}
