import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import {
  createWorkOrder,
  workOrdersVisibleTo,
} from "@/lib/server/workflow";
import type { Urgency } from "@/lib/types";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await readStore();
    const workOrders = workOrdersVisibleTo(store, session);
    return Response.json({
      workOrders,
      vendors: store.vendors,
      activity: store.activity.filter((a) =>
        workOrders.some((w) => w.id === a.workOrderId),
      ),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["tenant", "manager"]);
    const body = (await req.json()) as {
      propertyId?: string;
      title?: string;
      details?: string;
      urgency?: Urgency;
      category?: string;
    };
    if (!body.propertyId || !body.title?.trim() || !body.details?.trim()) {
      throw new AuthError("propertyId, title, and details are required", 400);
    }
    const urgency = body.urgency || "routine";
    let created;
    await updateStore((store) => {
      created = createWorkOrder(store, session, {
        propertyId: body.propertyId!,
        title: body.title!,
        details: body.details!,
        urgency,
        category: body.category,
      });
    });
    return Response.json({ workOrder: created }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
