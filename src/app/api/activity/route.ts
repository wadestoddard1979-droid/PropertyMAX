import { jsonError, requireSession } from "@/lib/server/auth";
import { readStore } from "@/lib/server/db";
import { activityVisibleTo } from "@/lib/server/records";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await readStore();
    return Response.json({ activity: activityVisibleTo(store, session) });
  } catch (err) {
    return jsonError(err);
  }
}
