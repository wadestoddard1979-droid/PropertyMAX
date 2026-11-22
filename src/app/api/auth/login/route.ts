import { AuthError, jsonError, loginWithPassword } from "@/lib/server/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      email?: string;
      password?: string;
    } | null;
    if (!body?.email || !body?.password) {
      return Response.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }
    const result = await loginWithPassword(body.email, body.password);
    return Response.json({
      user: result.user,
      authVia: result.via,
    });
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err);
    return jsonError(err);
  }
}
