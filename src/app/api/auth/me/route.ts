import { getSession } from "@/lib/server/auth";
import { systemStatus } from "@/lib/server/config";
import { persistenceLabel, readStore } from "@/lib/server/db";
import { propertiesVisibleTo } from "@/lib/server/records";

export async function GET() {
  const store = await readStore();
  const fallbackProperty = store.properties[0] ?? null;
  const sys = systemStatus();
  const policy = {
    ownerApprovalThresholdCents:
      fallbackProperty?.ownerApprovalThresholdCents ?? 20000,
    persistence: persistenceLabel(),
    auth: sys.auth,
    jobQueue: sys.jobQueue,
    documentStorage: sys.documentStorage,
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
