import { jsonError, requireSession } from "@/lib/server/auth";
import { resetStore } from "@/lib/server/db";

/** Pilot-only: reseed sample data. TODO: remove or gate in production. */
export async function POST() {
  try {
    await requireSession(["manager", "owner"]);
    const store = await resetStore();
    return Response.json({
      ok: true,
      seededAt: store.seededAt,
      workOrderCount: store.workOrders.length,
    });
  } catch (err) {
    return jsonError(err);
  }
}
