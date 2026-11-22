import { AuthError, jsonError, requireSession, verifyMfaDemo } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import { setMfaEnabled } from "@/lib/server/commercial";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json()) as {
      action?: "verify" | "toggle";
      code?: string;
      enabled?: boolean;
    };
    if (body.action === "verify") {
      if (!body.code) throw new AuthError("code required", 400);
      const user = await verifyMfaDemo(body.code);
      return Response.json({ user, ok: true });
    }
    if (body.action === "toggle") {
      let user;
      await updateStore((store) => {
        user = setMfaEnabled(store, session, Boolean(body.enabled));
      });
      return Response.json({
        mfaEnabled: Boolean(body.enabled),
        user,
      });
    }
    throw new AuthError("Unknown action", 400);
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    const store = await readStore();
    const user = store.users.find((u) => u.id === session.id);
    return Response.json({
      mfaEnabled: Boolean(user?.mfaEnabled),
      mfaVerified: Boolean(session.mfaVerified),
      demoCodeHint: "123456",
    });
  } catch (err) {
    return jsonError(err);
  }
}
