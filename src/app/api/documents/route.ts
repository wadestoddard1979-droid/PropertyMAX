import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import { addDocument, documentsVisibleTo } from "@/lib/server/records";
import type { DocumentRecord, Role } from "@/lib/types";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await readStore();
    return Response.json({
      documents: documentsVisibleTo(store, session),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["manager", "owner", "tenant"]);
    const body = (await req.json()) as {
      propertyId?: string;
      title?: string;
      category?: DocumentRecord["category"];
      fileName?: string;
      note?: string;
      workOrderId?: string | null;
      leaseId?: string | null;
      visibility?: Role[];
    };
    if (!body.propertyId || !body.title?.trim() || !body.category) {
      throw new AuthError("propertyId, title, and category required", 400);
    }
    let document: DocumentRecord | undefined;
    await updateStore((store) => {
      document = addDocument(store, session, {
        propertyId: body.propertyId!,
        title: body.title!,
        category: body.category!,
        fileName: body.fileName || `${body.title!.trim().replace(/\s+/g, "-").toLowerCase()}.pdf`,
        note: body.note,
        workOrderId: body.workOrderId,
        leaseId: body.leaseId,
        visibility: body.visibility,
      });
    });
    return Response.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
