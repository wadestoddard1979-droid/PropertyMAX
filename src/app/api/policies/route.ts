import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import {
  ensurePolicies,
  getPolicyForProperty,
  updatePolicy,
} from "@/lib/server/policies";
import type { AutomationPolicy } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId") || "prop-maple";
    const store = await readStore();
    ensurePolicies(store);
    const property = store.properties.find((p) => p.id === propertyId);
    if (!property) throw new AuthError("Property not found", 404);

    // Access: manager/owner of property; tenant/contractor read limited
    if (session.role === "manager" && property.managerId !== session.id) {
      throw new AuthError("Forbidden", 403);
    }
    if (session.role === "owner" && property.ownerId !== session.id) {
      throw new AuthError("Forbidden", 403);
    }
    if (session.role === "tenant" && !property.tenantIds.includes(session.id)) {
      throw new AuthError("Forbidden", 403);
    }

    const policy = getPolicyForProperty(store, propertyId);
    const preferredVendors = store.vendors.filter((v) =>
      policy.preferredVendorIds.includes(v.id),
    );
    return Response.json({
      policy,
      vendors: store.vendors,
      preferredVendors,
      people: store.users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
      })),
      canEdit: session.role === "manager",
      hardRule:
        "Spending policies are deterministic. AI recommendations never authorize spend past policy.",
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession(["manager"]);
    const body = (await req.json()) as {
      propertyId?: string;
      patch?: Partial<AutomationPolicy>;
    };
    if (!body.propertyId || !body.patch) {
      throw new AuthError("propertyId and patch required", 400);
    }
    let policy;
    await updateStore((store) => {
      policy = updatePolicy(store, session, body.propertyId!, body.patch!);
    });
    return Response.json({
      policy,
      hardRule:
        "Policy saved. AI recommendations cannot override these thresholds.",
    });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
