import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import {
  addChangeOrder,
  createRenoProject,
  createTurnoverChecklist,
  decideChangeOrder,
  decideRenoProject,
  listAssets,
  listRenoProjects,
  patchTurnoverChecklist,
  updateRenoProgress,
  upsertAsset,
  vacancyCostInsight,
} from "@/lib/server/renovation";
import type {
  AssetRecord,
  RenoStatus,
  TurnoverChecklistItem,
} from "@/lib/types";

export async function GET(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId") || "prop-maple";
    const store = await readStore();
    const property = store.properties.find((p) => p.id === propertyId);
    if (!property) throw new AuthError("Property not found", 404);
    if (session.role === "owner" && property.ownerId !== session.id) {
      throw new AuthError("Forbidden", 403);
    }
    if (session.role === "manager" && property.managerId !== session.id) {
      throw new AuthError("Forbidden", 403);
    }

    return Response.json({
      property,
      projects: listRenoProjects(store, propertyId),
      turnovers: (store.turnoverChecklists || []).filter(
        (t) => t.propertyId === propertyId,
      ),
      assets: listAssets(store, propertyId),
      vacancyInsight: vacancyCostInsight(store, propertyId),
      canDrive: session.role === "manager" || session.role === "owner",
      role: session.role,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const body = (await req.json()) as {
      action?: string;
      propertyId?: string;
      projectId?: string;
      changeOrderId?: string;
      checklistId?: string;
      title?: string;
      scope?: string;
      budgetCents?: number;
      vendorId?: string | null;
      decision?: "approved" | "declined";
      note?: string;
      status?: RenoStatus;
      spentCents?: number;
      progressPct?: number;
      amountCents?: number;
      moveOutDate?: string;
      leaseId?: string | null;
      items?: TurnoverChecklistItem[];
      turnoverStatus?: "open" | "in_progress" | "ready" | "completed";
      asset?: Partial<AssetRecord> & {
        propertyId: string;
        name: string;
        category: AssetRecord["category"];
      };
    };

    if (body.action === "create_project") {
      if (!body.propertyId || !body.title || !body.scope || body.budgetCents == null) {
        throw new AuthError("propertyId, title, scope, budgetCents required", 400);
      }
      let project;
      await updateStore((store) => {
        project = createRenoProject(store, session, {
          propertyId: body.propertyId!,
          title: body.title!,
          scope: body.scope!,
          budgetCents: body.budgetCents!,
          vendorId: body.vendorId,
        });
      });
      return Response.json({ project }, { status: 201 });
    }

    if (body.action === "decide_project") {
      if (!body.projectId || !body.decision) {
        throw new AuthError("projectId and decision required", 400);
      }
      let project;
      await updateStore((store) => {
        project = decideRenoProject(
          store,
          session,
          body.projectId!,
          body.decision!,
          body.note,
        );
      });
      return Response.json({ project });
    }

    if (body.action === "progress") {
      if (!body.projectId) throw new AuthError("projectId required", 400);
      let project;
      await updateStore((store) => {
        project = updateRenoProgress(store, session, body.projectId!, {
          status: body.status,
          spentCents: body.spentCents,
          progressPct: body.progressPct,
        });
      });
      return Response.json({ project });
    }

    if (body.action === "change_order") {
      if (!body.projectId || !body.title || body.amountCents == null) {
        throw new AuthError("projectId, title, amountCents required", 400);
      }
      let changeOrder;
      await updateStore((store) => {
        changeOrder = addChangeOrder(store, session, body.projectId!, {
          title: body.title!,
          amountCents: body.amountCents!,
          note: body.note,
        });
      });
      return Response.json({ changeOrder }, { status: 201 });
    }

    if (body.action === "decide_change_order") {
      if (!body.projectId || !body.changeOrderId || !body.decision) {
        throw new AuthError(
          "projectId, changeOrderId, decision required",
          400,
        );
      }
      let result;
      await updateStore((store) => {
        result = decideChangeOrder(
          store,
          session,
          body.projectId!,
          body.changeOrderId!,
          body.decision!,
        );
      });
      return Response.json(result);
    }

    if (body.action === "create_turnover") {
      if (!body.propertyId || !body.moveOutDate) {
        throw new AuthError("propertyId and moveOutDate required", 400);
      }
      let checklist;
      await updateStore((store) => {
        checklist = createTurnoverChecklist(store, session, {
          propertyId: body.propertyId!,
          moveOutDate: body.moveOutDate!,
          leaseId: body.leaseId,
        });
      });
      return Response.json({ checklist }, { status: 201 });
    }

    if (body.action === "patch_turnover") {
      if (!body.checklistId) throw new AuthError("checklistId required", 400);
      let checklist;
      await updateStore((store) => {
        checklist = patchTurnoverChecklist(store, session, body.checklistId!, {
          status: body.turnoverStatus,
          items: body.items,
        });
      });
      return Response.json({ checklist });
    }

    if (body.action === "upsert_asset") {
      if (!body.asset) throw new AuthError("asset required", 400);
      let asset;
      await updateStore((store) => {
        asset = upsertAsset(store, session, body.asset!);
      });
      return Response.json({ asset }, { status: 201 });
    }

    throw new AuthError("Unknown action", 400);
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
