import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { submitMaintenanceIntake } from "@/lib/server/ai/intake";
import { classifyIntake } from "@/lib/server/ai/classifier";
import { readStore, updateStore } from "@/lib/server/db";
import type { IntakeAnswers } from "@/lib/types";

function parseAnswers(body: Partial<IntakeAnswers>): IntakeAnswers {
  return {
    summary: body.summary || "",
    location: body.location || "",
    flooding: body.flooding || "no",
    waterShutoffKnown: body.waterShutoffKnown || "na",
    electricityHazard: body.electricityHazard || "no",
    smellGas: body.smellGas || "no",
    canUseHome: body.canUseHome || "yes",
    photoNotes: body.photoNotes || "",
    freeText: body.freeText || "",
  };
}

/** Preview classification without creating a work order. */
export async function PUT(req: Request) {
  try {
    await requireSession(["tenant", "manager"]);
    const body = (await req.json()) as { answers?: Partial<IntakeAnswers> };
    if (!body.answers) throw new AuthError("answers required", 400);
    const result = await classifyIntake(parseAnswers(body.answers));
    return Response.json({
      classification: result.classification,
      trace: result.trace,
      hardRule:
        "AI may recommend category/urgency only. Spend is never auto-authorized.",
    });
  } catch (err) {
    return jsonError(err);
  }
}

/** Submit intake → classify → create structured work order. */
export async function POST(req: Request) {
  try {
    const session = await requireSession(["tenant", "manager"]);
    const body = (await req.json()) as {
      propertyId?: string;
      answers?: Partial<IntakeAnswers>;
    };
    if (!body.propertyId || !body.answers) {
      throw new AuthError("propertyId and answers required", 400);
    }
    let payload;
    await updateStore(async (store) => {
      payload = await submitMaintenanceIntake(store, session, {
        propertyId: body.propertyId!,
        answers: parseAnswers(body.answers!),
      });
    });
    return Response.json(payload, { status: 201 });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const auditId = url.searchParams.get("auditId");
    const workOrderId = url.searchParams.get("workOrderId");
    const store = await readStore();
    const audits = store.intakeAudits || [];

    if (auditId) {
      const audit = audits.find((a) => a.id === auditId);
      if (!audit) throw new AuthError("Audit not found", 404);
      return Response.json({ audit });
    }
    if (workOrderId) {
      const audit = audits.find((a) => a.workOrderId === workOrderId);
      return Response.json({ audit: audit || null });
    }

    // Managers/owners see recent audits for visibility
    if (session.role === "tenant") {
      return Response.json({
        audits: audits.filter((a) => a.actorUserId === session.id).slice(0, 20),
      });
    }
    return Response.json({ audits: audits.slice(0, 40) });
  } catch (err) {
    return jsonError(err);
  }
}
