import { jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await readStore();
    const notifications = store.notifications.filter(
      (n) => n.userId === session.id,
    );
    return Response.json({ notifications });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json()) as { markAllRead?: boolean; id?: string };
    await updateStore((store) => {
      for (const n of store.notifications) {
        if (n.userId !== session.id) continue;
        if (body.markAllRead || (body.id && n.id === body.id)) n.read = true;
      }
    });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
