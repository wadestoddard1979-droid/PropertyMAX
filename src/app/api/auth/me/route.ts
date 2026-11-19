import { getSession } from "@/lib/server/auth";
import { readStore } from "@/lib/server/db";

export async function GET() {
  const store = await readStore();
  const property = store.properties[0] ?? null;
  const policy = {
    ownerApprovalThresholdCents:
      property?.ownerApprovalThresholdCents ?? 20000,
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
      property,
      policy,
      pilotUsers,
    });
  }

  return Response.json({
    user: session,
    property,
    policy,
    pilotUsers,
  });
}
