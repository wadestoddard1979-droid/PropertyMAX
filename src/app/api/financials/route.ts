import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import {
  addLedgerEntry,
  buildMonthSnapshot,
  buildProjection,
  getAssumptions,
  pendingApprovalsForOwner,
  updateAssumptions,
  type Horizon,
} from "@/lib/server/financials";
import type { LedgerEntry, ProjectionAssumptions } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId") || "prop-maple";
    const month = url.searchParams.get("month") || "2026-11";
    const horizon = (url.searchParams.get("horizon") || "12m") as Horizon;
    if (!["12m", "36m", "60m"].includes(horizon)) {
      throw new AuthError("horizon must be 12m, 36m, or 60m", 400);
    }

    const store = await readStore();
    const property = store.properties.find((p) => p.id === propertyId);
    if (!property) throw new AuthError("Property not found", 404);
    if (
      session.role === "owner" &&
      property.ownerId !== session.id
    ) {
      throw new AuthError("Forbidden", 403);
    }
    if (
      session.role === "manager" &&
      property.managerId !== session.id
    ) {
      throw new AuthError("Forbidden", 403);
    }

    const assumptions = getAssumptions(store, propertyId);
    const snapshot = buildMonthSnapshot(store, propertyId, month);
    const projection = buildProjection(assumptions, horizon);
    const pendingApprovals =
      session.role === "owner"
        ? pendingApprovalsForOwner(store, session.id)
        : store.workOrders.filter(
            (w) =>
              w.propertyId === propertyId &&
              w.status === "awaiting_owner_approval",
          );

    return Response.json({
      property,
      month,
      horizon,
      snapshot,
      assumptions,
      projection,
      pendingApprovals,
      disclaimer:
        "Figures are illustrative or manually entered for the Phase 1 pilot. Not bank-verified. Projections are not guarantees; appreciation is excluded.",
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const body = (await req.json()) as {
      propertyId?: string;
      assumptions?: Partial<ProjectionAssumptions>;
    };
    if (!body.propertyId || !body.assumptions) {
      throw new AuthError("propertyId and assumptions required", 400);
    }
    let assumptions;
    await updateStore((store) => {
      assumptions = updateAssumptions(
        store,
        session,
        body.propertyId!,
        body.assumptions!,
      );
    });
    return Response.json({ assumptions });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const body = (await req.json()) as {
      propertyId?: string;
      month?: string;
      category?: LedgerEntry["category"];
      label?: string;
      amountCents?: number;
    };
    if (
      !body.propertyId ||
      !body.month ||
      !body.category ||
      !body.label?.trim() ||
      typeof body.amountCents !== "number"
    ) {
      throw new AuthError(
        "propertyId, month, category, label, amountCents required",
        400,
      );
    }
    let entry;
    await updateStore((store) => {
      entry = addLedgerEntry(store, session, {
        propertyId: body.propertyId!,
        month: body.month!,
        category: body.category!,
        label: body.label!,
        amountCents: body.amountCents!,
      });
    });
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
