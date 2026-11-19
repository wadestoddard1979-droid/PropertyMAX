import { jsonError, requireSession } from "@/lib/server/auth";
import { readStore } from "@/lib/server/db";
import { workOrdersVisibleTo } from "@/lib/server/workflow";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await readStore();
    const visibleIds = new Set(
      workOrdersVisibleTo(store, session).map((w) => w.id),
    );
    const activity = store.activity.filter(
      (a) => a.workOrderId && visibleIds.has(a.workOrderId),
    );
    return Response.json({ activity });
  } catch (err) {
    return jsonError(err);
  }
}
