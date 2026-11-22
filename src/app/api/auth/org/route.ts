import { AuthError, jsonError, requireSession, switchOrg } from "@/lib/server/auth";
import { readStore } from "@/lib/server/db";
import { orgsForUser } from "@/lib/server/commercial";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await readStore();
    const orgs = orgsForUser(store, session.id);
    return Response.json({
      orgs,
      activeOrgId: session.orgId || null,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = (await req.json()) as { orgId?: string };
    if (!body.orgId) throw new AuthError("orgId required", 400);
    const user = await switchOrg(body.orgId);
    return Response.json({ user });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
