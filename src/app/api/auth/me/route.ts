import { getSession } from "@/lib/server/auth";
import { readStore } from "@/lib/server/db";
import { propertiesVisibleTo } from "@/lib/server/records";

export async function GET() {
  const store = await readStore();
  const fallbackProperty = store.properties[0] ?? null;
  const policy = {
    ownerApprovalThresholdCents:
      fallbackProperty?.ownerApprovalThresholdCents ?? 20000,
    persistence: "local-json",
    // TODO(supabase): auth + Postgres
  };
  const pilotUsers = store.users.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    passwordHint: "pilot",
  }));

  const session = await getSession();
  if (!session) {
    return Response.json({
      user: null,
      property: fallbackProperty,
      policy,
      pilotUsers,
    });
  }

  const visible = propertiesVisibleTo(store, session);
  const property = visible[0] ?? fallbackProperty;

  return Response.json({
    user: session,
    property,
    policy: {
      ...policy,
      ownerApprovalThresholdCents:
        property?.ownerApprovalThresholdCents ??
        policy.ownerApprovalThresholdCents,
    },
    pilotUsers,
  });
}
