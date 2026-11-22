import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import {
  enqueueJob,
  listJobs,
  processDueJobs,
} from "@/lib/server/jobs/queue";

export async function GET() {
  try {
    await requireSession(["manager"]);
    const jobs = await listJobs(25);
    return Response.json({ jobs });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["manager"]);
    const body = (await req.json()) as {
      action?: "enqueue" | "drain";
      kind?: string;
      payload?: Record<string, unknown>;
    };

    if (body.action === "drain") {
      const processed = await processDueJobs(10);
      return Response.json({ processed });
    }

    if (!body.kind) throw new AuthError("kind required", 400);
    const job = await enqueueJob(body.kind, {
      ...(body.payload || {}),
      enqueuedBy: session.id,
    });
    return Response.json({ job }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
