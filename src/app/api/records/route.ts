import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import {
  activityVisibleTo,
  documentsVisibleTo,
  leasesVisibleTo,
  propertiesVisibleTo,
  unitsForProperties,
  updateLease,
  updateProperty,
  updateUnit,
} from "@/lib/server/records";
import type { Lease, Property, Unit } from "@/lib/types";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await readStore();
    const properties = propertiesVisibleTo(store, session);
    const propertyIds = properties.map((p) => p.id);
    const units = unitsForProperties(store, propertyIds);
    const leases = leasesVisibleTo(store, session, propertyIds);
    const documents = documentsVisibleTo(store, session);
    const activity = activityVisibleTo(store, session);
    const people = store.users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      email: u.email,
    }));
    return Response.json({
      properties,
      units,
      leases,
      documents,
      activity,
      people,
      canEdit: session.role === "manager",
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession(["manager"]);
    const body = (await req.json()) as {
      entity?: "property" | "unit" | "lease";
      id?: string;
      patch?: Record<string, unknown>;
    };
    if (!body.entity || !body.id || !body.patch) {
      throw new AuthError("entity, id, and patch required", 400);
    }
    let result: Property | Unit | Lease | undefined;
    await updateStore((store) => {
      if (body.entity === "property") {
        result = updateProperty(
          store,
          session,
          body.id!,
          body.patch as Partial<Property>,
        );
      } else if (body.entity === "unit") {
        result = updateUnit(
          store,
          session,
          body.id!,
          body.patch as Partial<Unit>,
        );
      } else if (body.entity === "lease") {
        result = updateLease(
          store,
          session,
          body.id!,
          body.patch as Partial<Lease>,
        );
      } else {
        throw new AuthError("Unknown entity", 400);
      }
    });
    return Response.json({ entity: body.entity, record: result });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
