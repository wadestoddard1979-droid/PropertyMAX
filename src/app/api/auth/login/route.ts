import { readStore } from "@/lib/server/db";
import { setSessionCookie } from "@/lib/server/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  if (!body?.email || !body?.password) {
    return Response.json({ error: "Email and password required" }, { status: 400 });
  }
  const store = await readStore();
  const user = store.users.find(
    (u) =>
      u.email.toLowerCase() === body.email!.toLowerCase() &&
      u.password === body.password,
  );
  if (!user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const session = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  await setSessionCookie(session);
  return Response.json({ user: session });
}
