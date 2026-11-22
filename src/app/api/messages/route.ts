import { AuthError, jsonError, requireSession } from "@/lib/server/auth";
import { readStore, updateStore } from "@/lib/server/db";
import {
  createThread,
  messagesForThread,
  postMessage,
  threadsVisibleTo,
} from "@/lib/server/messages";

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const store = await readStore();
    const url = new URL(req.url);
    const threadId = url.searchParams.get("threadId");
    const workOrderId = url.searchParams.get("workOrderId");
    const threads = threadsVisibleTo(store, session);

    if (threadId) {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) throw new AuthError("Thread not found", 404);
      const messages = messagesForThread(store, session, threadId);
      return Response.json({ thread, messages, threads });
    }

    if (workOrderId) {
      const thread = threads.find((t) => t.workOrderId === workOrderId) || null;
      const messages = thread
        ? messagesForThread(store, session, thread.id)
        : [];
      return Response.json({ thread, messages, threads });
    }

    return Response.json({
      threads,
      people: store.users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
      })),
    });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json()) as {
      action?: "reply" | "create";
      threadId?: string;
      body?: string;
      propertyId?: string;
      subject?: string;
      workOrderId?: string | null;
    };
    const text = body.body?.trim();
    if (!text) throw new AuthError("body required", 400);

    if (body.action === "create" || (!body.threadId && body.propertyId)) {
      if (session.role === "contractor") {
        throw new AuthError("Contractors cannot start threads", 403);
      }
      if (!body.propertyId || !body.subject?.trim()) {
        throw new AuthError("propertyId and subject required to create", 400);
      }
      let result;
      await updateStore((store) => {
        result = createThread(store, session, {
          propertyId: body.propertyId!,
          subject: body.subject!,
          body: text,
          workOrderId: body.workOrderId,
        });
      });
      return Response.json(result, { status: 201 });
    }

    if (!body.threadId) throw new AuthError("threadId required", 400);
    let result;
    await updateStore((store) => {
      result = postMessage(store, session, {
        threadId: body.threadId!,
        body: text,
      });
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error && !(err instanceof AuthError)) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
