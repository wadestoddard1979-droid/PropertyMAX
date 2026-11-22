import { randomUUID } from "crypto";
import type {
  ActivityEvent,
  AppStore,
  Message,
  MessageThread,
  Notification,
  SessionUser,
} from "../types";
import { assertPropertyAccess } from "./workflow";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function pushActivity(
  store: AppStore,
  partial: Omit<ActivityEvent, "id" | "createdAt">,
) {
  store.activity.unshift({
    ...partial,
    id: id("act"),
    createdAt: now(),
  });
}

function notify(
  store: AppStore,
  partial: Omit<Notification, "id" | "createdAt" | "read">,
) {
  store.notifications.unshift({
    ...partial,
    id: id("notif"),
    read: false,
    createdAt: now(),
  });
}

function canAccessThread(
  store: AppStore,
  user: SessionUser,
  thread: MessageThread,
) {
  assertPropertyAccess(store, user, thread.propertyId);
  if (user.role === "manager" || user.role === "owner") return true;
  if (thread.participantIds.includes(user.id)) return true;
  if (user.role === "tenant") {
    const property = store.properties.find((p) => p.id === thread.propertyId);
    return !!property?.tenantIds.includes(user.id);
  }
  if (user.role === "contractor" && thread.workOrderId) {
    const wo = store.workOrders.find((w) => w.id === thread.workOrderId);
    return wo?.contractorUserId === user.id;
  }
  return false;
}

export function threadsVisibleTo(store: AppStore, user: SessionUser) {
  return store.messageThreads
    .filter((t) => {
      try {
        return canAccessThread(store, user, t);
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function messagesForThread(
  store: AppStore,
  user: SessionUser,
  threadId: string,
) {
  const thread = store.messageThreads.find((t) => t.id === threadId);
  if (!thread) throw new Error("Thread not found");
  if (!canAccessThread(store, user, thread)) {
    throw new Error("No access to this thread");
  }
  return store.messages
    .filter((m) => m.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function postMessage(
  store: AppStore,
  actor: SessionUser,
  input: { threadId: string; body: string },
) {
  const body = input.body.trim();
  if (body.length < 1) throw new Error("Message body required");
  const thread = store.messageThreads.find((t) => t.id === input.threadId);
  if (!thread) throw new Error("Thread not found");
  if (!canAccessThread(store, actor, thread)) {
    throw new Error("No access to this thread");
  }
  if (!thread.participantIds.includes(actor.id)) {
    thread.participantIds.push(actor.id);
  }
  const message: Message = {
    id: id("msg"),
    threadId: thread.id,
    authorUserId: actor.id,
    body,
    createdAt: now(),
  };
  store.messages.push(message);
  thread.updatedAt = now();
  pushActivity(store, {
    workOrderId: thread.workOrderId,
    propertyId: thread.propertyId,
    actorUserId: actor.id,
    kind: "message.posted",
    message: `${actor.name} posted on “${thread.subject}”.`,
  });
  for (const uid of thread.participantIds) {
    if (uid === actor.id) continue;
    notify(store, {
      userId: uid,
      workOrderId: thread.workOrderId,
      title: "New message",
      body: `${actor.name}: ${body.slice(0, 80)}${body.length > 80 ? "…" : ""}`,
    });
  }
  return { thread, message };
}

export function createThread(
  store: AppStore,
  actor: SessionUser,
  input: {
    propertyId: string;
    subject: string;
    body: string;
    workOrderId?: string | null;
  },
) {
  if (actor.role === "contractor") {
    throw new Error("Contractors reply on existing job threads");
  }
  const property = assertPropertyAccess(store, actor, input.propertyId);
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 2 || body.length < 1) {
    throw new Error("Subject and body required");
  }
  if (input.workOrderId) {
    const wo = store.workOrders.find((w) => w.id === input.workOrderId);
    if (!wo || wo.propertyId !== property.id) {
      throw new Error("Work order not found on this property");
    }
  }
  const participants = new Set<string>([
    actor.id,
    property.managerId,
    property.ownerId,
    ...property.tenantIds,
  ]);
  if (input.workOrderId) {
    const wo = store.workOrders.find((w) => w.id === input.workOrderId);
    if (wo?.contractorUserId) participants.add(wo.contractorUserId);
  }
  const thread: MessageThread = {
    id: id("thread"),
    propertyId: property.id,
    workOrderId: input.workOrderId ?? null,
    subject,
    participantIds: [...participants],
    createdAt: now(),
    updatedAt: now(),
  };
  store.messageThreads.unshift(thread);
  const { message } = postMessage(store, actor, {
    threadId: thread.id,
    body,
  });
  return { thread, message };
}

export function ensureWorkOrderThread(
  store: AppStore,
  workOrderId: string,
): MessageThread {
  const existing = store.messageThreads.find(
    (t) => t.workOrderId === workOrderId,
  );
  if (existing) return existing;
  const wo = store.workOrders.find((w) => w.id === workOrderId);
  if (!wo) throw new Error("Work order not found");
  const property = store.properties.find((p) => p.id === wo.propertyId);
  if (!property) throw new Error("Property not found");
  const thread: MessageThread = {
    id: id("thread"),
    propertyId: property.id,
    workOrderId: wo.id,
    subject: wo.title,
    participantIds: [
      property.managerId,
      property.ownerId,
      wo.createdByUserId,
      ...(wo.contractorUserId ? [wo.contractorUserId] : []),
    ],
    createdAt: now(),
    updatedAt: now(),
  };
  store.messageThreads.unshift(thread);
  return thread;
}
