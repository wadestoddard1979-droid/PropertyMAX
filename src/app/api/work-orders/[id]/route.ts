import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import {
  addEstimate,
  assignContractor,
  contractorUpdateStatus,
  ownerDecide,
  workOrdersVisibleTo,
} from "@/lib/server/workflow";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const store = await readStore();
    const visible = workOrdersVisibleTo(store, session);
    const workOrder = visible.find((w) => w.id === id);
    if (!workOrder) throw new AuthError("Not found", 404);
    const activity = store.activity.filter((a) => a.workOrderId === id);
    return Response.json({
      workOrder,
      activity,
      vendors: store.vendors,
      property: store.properties.find((p) => p.id === workOrder.propertyId),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      action?: string;
      estimateCents?: number;
      estimateNotes?: string;
      vendorId?: string;
      decision?: "approved" | "declined" | "asked";
      note?: string;
      status?: "scheduled" | "in_progress" | "completed";
    };

    let workOrder;
    await updateStore((store) => {
      switch (body.action) {
        case "add_estimate": {
          if (typeof body.estimateCents !== "number") {
            throw new AuthError("estimateCents required", 400);
          }
          workOrder = addEstimate(
            store,
            session,
            id,
            body.estimateCents,
            body.estimateNotes || "",
            body.vendorId,
          );
          break;
        }
        case "owner_decide": {
          if (
            body.decision !== "approved" &&
            body.decision !== "declined" &&
            body.decision !== "asked"
          ) {
            throw new AuthError("decision required", 400);
          }
          workOrder = ownerDecide(
            store,
            session,
            id,
            body.decision,
            body.note,
          );
          break;
        }
        case "assign": {
          if (!body.vendorId) throw new AuthError("vendorId required", 400);
          workOrder = assignContractor(store, session, id, body.vendorId);
          break;
        }
        case "status": {
          if (
            body.status !== "scheduled" &&
            body.status !== "in_progress" &&
            body.status !== "completed"
          ) {
            throw new AuthError("status required", 400);
          }
          workOrder = contractorUpdateStatus(
            store,
            session,
            id,
            body.status,
          );
          break;
        }
        default:
          throw new AuthError("Unknown action", 400);
      }
    });

    return Response.json({ workOrder });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
