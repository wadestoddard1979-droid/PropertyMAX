import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { answerFaqOrEscalate, ensureCommsDefaults } from "@/lib/server/comms";
import { readStore, updateStore } from "@/lib/server/db";

export async function GET() {
  try {
    await requireSession(["tenant", "manager", "owner"]);
    const store = await readStore();
    ensureCommsDefaults(store);
    return Response.json({ faqs: store.verifiedFaqs });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(["tenant", "manager", "owner"]);
    const body = (await req.json()) as { text?: string };
    if (!body.text?.trim()) throw new AuthError("text required", 400);

    let result;
    await updateStore((store) => {
      result = answerFaqOrEscalate(store, session, body.text!.trim());
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
