import { getSession } from "@/lib/server/auth";
import { systemStatus } from "@/lib/server/config";
import {
  getTheme,
  orgsForUser,
  propertiesForOrg,
} from "@/lib/server/commercial";
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
    orgIds: u.orgIds || [],
  }));

  const session = await getSession();
  if (!session) {
    return Response.json({
      user: null,
      property: fallbackProperty,
      properties: store.properties.slice(0, 1),
      orgs: store.organizations || [],
      theme: null,
      policy,
      pilotUsers,
    });
  }

  const orgId = session.orgId || "org-pilot";
  const orgProps = propertiesForOrg(store, orgId);
  const visible = propertiesVisibleTo(store, session).filter(
    (p) => (p.orgId || "org-pilot") === orgId,
  );
  const property = visible[0] ?? orgProps[0] ?? fallbackProperty;
  const theme = getTheme(store, orgId);
  const userRecord = store.users.find((u) => u.id === session.id);

  return Response.json({
    user: {
      ...session,
      mfaEnabled: Boolean(userRecord?.mfaEnabled),
    },
    property,
    properties: visible.length ? visible : orgProps,
    orgs: orgsForUser(store, session.id),
    theme,
    policy: {
      ...policy,
      ownerApprovalThresholdCents:
        property?.ownerApprovalThresholdCents ??
        policy.ownerApprovalThresholdCents,
    },
    pilotUsers,
  });
}
