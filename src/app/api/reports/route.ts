import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import { enqueueJob, processDueJobs } from "@/lib/server/jobs/queue";
import {
  buildTaxExport,
  expenseMaintenanceSummary,
  generateOwnerStatement,
} from "@/lib/server/reports";

export async function GET(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId") || "prop-maple";
    const year = url.searchParams.get("year") || "2026";
    const format = url.searchParams.get("format") || "json";
    const exportTax = url.searchParams.get("export") === "tax";

    const store = await readStore();
    const property = store.properties.find((p) => p.id === propertyId);
    if (!property) throw new AuthError("Property not found", 404);
    if (session.role === "owner" && property.ownerId !== session.id) {
      throw new AuthError("Forbidden", 403);
    }
    if (session.role === "manager" && property.managerId !== session.id) {
      throw new AuthError("Forbidden", 403);
    }

    if (exportTax) {
      const tax = buildTaxExport(store, propertyId, year);
      if (format === "csv") {
        return new Response(tax.csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="propertmax-tax-${propertyId}-${year}.csv"`,
          },
        });
      }
      return Response.json(tax.json);
    }

    const months = [
      `${year}-09`,
      `${year}-10`,
      `${year}-11`,
      `${year}-12`,
    ];
    const summary = expenseMaintenanceSummary(store, propertyId, months);
    const statements = (store.ownerStatements || []).filter(
      (s) => s.propertyId === propertyId,
    );

    return Response.json({
      property,
      statements,
      summary,
      months,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["owner", "manager"]);
    const body = (await req.json()) as {
      action?: "generate" | "enqueue_monthly";
      propertyId?: string;
      month?: string;
    };
    const propertyId = body.propertyId || "prop-maple";
    const month = body.month || "2026-11";

    if (body.action === "enqueue_monthly") {
      const job = await enqueueJob("report.owner_statement", {
        propertyId,
        month,
        actorUserId: session.id,
      });
      await processDueJobs(5);
      const store = await readStore();
      const statement = store.ownerStatements.find(
        (s) => s.propertyId === propertyId && s.month === month,
      );
      return Response.json({ job, statement }, { status: 201 });
    }

    let statement;
    await updateStore((store) => {
      statement = generateOwnerStatement(store, session, propertyId, month);
    });
    return Response.json({ statement }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
