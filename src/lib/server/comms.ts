import { randomUUID } from "crypto";
import type { AppStore, SessionUser, VerifiedFaq } from "../types";
import { registerJobHandler, type JobRecord } from "./jobs/queue";
import { updateStore } from "./db";
import { DEFAULT_VERIFIED_FAQS } from "./seed";

export { DEFAULT_VERIFIED_FAQS };

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

const ESCALATE_PATTERNS = [
  /\blegal\b/i,
  /\blawyer\b/i,
  /\battorney\b/i,
  /\bevict/i,
  /\bdispute\b/i,
  /\bdiscrimination\b/i,
  /\bfair housing\b/i,
  /\bsafety\b/i,
  /\bthreat/i,
  /\bassault\b/i,
  /\bharass/i,
  /\bpolice\b/i,
  /\bcourt\b/i,
  /\bsecurity deposit dispute/i,
];

export function ensureCommsDefaults(store: AppStore) {
  if (!store.verifiedFaqs) store.verifiedFaqs = [...DEFAULT_VERIFIED_FAQS];
  if (store.verifiedFaqs.length === 0) {
    store.verifiedFaqs = [...DEFAULT_VERIFIED_FAQS];
  }
}

export function shouldEscalateToHuman(text: string): {
  escalate: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const re of ESCALATE_PATTERNS) {
    const m = text.match(re);
    if (m) reasons.push(`Matched “${m[0]}”`);
  }
  return { escalate: reasons.length > 0, reasons };
}

export function matchFaq(
  store: AppStore,
  text: string,
): VerifiedFaq | null {
  ensureCommsDefaults(store);
  const t = text.toLowerCase();
  let best: VerifiedFaq | null = null;
  let score = 0;
  for (const faq of store.verifiedFaqs) {
    let s = 0;
    for (const tag of faq.tags) {
      if (t.includes(tag.toLowerCase())) s += 2;
    }
    const qWords = faq.question.toLowerCase().split(/\W+/).filter(Boolean);
    for (const w of qWords) {
      if (w.length > 3 && t.includes(w)) s += 1;
    }
    if (s > score) {
      score = s;
      best = faq;
    }
  }
  return score >= 2 ? best : null;
}

async function notifyUser(
  store: AppStore,
  userId: string,
  title: string,
  body: string,
  workOrderId: string | null = null,
) {
  store.notifications.unshift({
    id: id("notif"),
    userId,
    workOrderId,
    title,
    body,
    read: false,
    createdAt: now(),
  });
}

async function withStore(mutator: (store: AppStore) => void) {
  await updateStore(mutator);
}

/** Register job handlers that send in-app notifications (pilot “comms”). */
export function registerCommsHandlers() {
  registerJobHandler("reminder.rent", async (job) => {
    await withStore((store) => {
      const propertyId = String(job.payload.propertyId || "prop-maple");
      const property = store.properties.find((p) => p.id === propertyId);
      if (!property) return;
      for (const tid of property.tenantIds) {
        void notifyUser(
          store,
          tid,
          "Rent reminder",
          `Rent of $${property.monthlyRent} for ${property.name} is coming due. Pay from Payments (hosted checkout — cards never stored here).`,
        );
      }
      store.activity.unshift({
        id: id("act"),
        workOrderId: null,
        propertyId,
        actorUserId: property.managerId,
        kind: "comms.rent_reminder",
        message: `Rent reminder queued/sent to ${property.tenantIds.length} tenant(s).`,
        createdAt: now(),
      });
    });
  });

  registerJobHandler("reminder.lease_expiry", async (job) => {
    await withStore((store) => {
      const propertyId = String(job.payload.propertyId || "prop-maple");
      const property = store.properties.find((p) => p.id === propertyId);
      if (!property) return;
      const lease = store.leases.find(
        (l) => l.propertyId === propertyId && l.status === "active",
      );
      const body = `Lease at ${property.name} ends ${lease?.endDate || property.leaseEnd}. Contact management about renewal.`;
      for (const tid of property.tenantIds) {
        void notifyUser(store, tid, "Lease renewal reminder", body);
      }
      void notifyUser(
        store,
        property.managerId,
        "Lease renewal reminder",
        body,
      );
      store.activity.unshift({
        id: id("act"),
        workOrderId: null,
        propertyId,
        actorUserId: property.managerId,
        kind: "comms.lease_renewal",
        message: "Lease renewal reminder sent to tenant(s) and manager.",
        createdAt: now(),
      });
    });
  });

  registerJobHandler("comms.request_ack", async (job) => {
    await withStore((store) => {
      const workOrderId = String(job.payload.workOrderId || "");
      const wo = store.workOrders.find((w) => w.id === workOrderId);
      if (!wo) return;
      void notifyUser(
        store,
        wo.createdByUserId,
        "Request received",
        `We received “${wo.title}”. Status: ${wo.status.replaceAll("_", " ")}.`,
        wo.id,
      );
      store.activity.unshift({
        id: id("act"),
        workOrderId: wo.id,
        propertyId: wo.propertyId,
        actorUserId: wo.createdByUserId,
        kind: "comms.request_ack",
        message: `Auto-ack sent for work order ${wo.id}.`,
        createdAt: now(),
      });
    });
  });

  registerJobHandler("comms.status_update", async (job) => {
    await withStore((store) => {
      const workOrderId = String(job.payload.workOrderId || "");
      const wo = store.workOrders.find((w) => w.id === workOrderId);
      if (!wo) return;
      const property = store.properties.find((p) => p.id === wo.propertyId);
      const body = `“${wo.title}” is now ${wo.status.replaceAll("_", " ")}.`;
      void notifyUser(store, wo.createdByUserId, "Maintenance status update", body, wo.id);
      if (property) {
        void notifyUser(store, property.ownerId, "Maintenance status update", body, wo.id);
      }
      store.activity.unshift({
        id: id("act"),
        workOrderId: wo.id,
        propertyId: wo.propertyId,
        actorUserId: String(job.payload.actorUserId || wo.createdByUserId),
        kind: "comms.status_update",
        message: `Status update notification sent (${wo.status}).`,
        createdAt: now(),
      });
    });
  });

  registerJobHandler("approval.escalation", async (job: JobRecord) => {
    await withStore((store) => {
      const workOrderId = String(job.payload.workOrderId || "");
      const contact = String(job.payload.escalationContactUserId || "");
      const wo = store.workOrders.find((w) => w.id === workOrderId);
      if (!wo || wo.status !== "awaiting_owner_approval") return;
      if (contact) {
        void notifyUser(
          store,
          contact,
          "Approval escalation",
          `Owner approval still pending for “${wo.title}”. Escalation timer fired.`,
          wo.id,
        );
      }
      store.activity.unshift({
        id: id("act"),
        workOrderId: wo.id,
        propertyId: wo.propertyId,
        actorUserId: contact || wo.createdByUserId,
        kind: "comms.approval_escalation",
        message: "Escalation reminder sent for pending owner approval.",
        createdAt: now(),
      });
    });
  });
}

export function answerFaqOrEscalate(
  store: AppStore,
  actor: SessionUser,
  text: string,
): {
  kind: "faq" | "escalated" | "unmatched";
  faq: VerifiedFaq | null;
  reply: string;
  reasons: string[];
} {
  ensureCommsDefaults(store);
  const { escalate, reasons } = shouldEscalateToHuman(text);
  if (escalate) {
    const managers = store.users.filter((u) => u.role === "manager");
    for (const m of managers) {
      store.notifications.unshift({
        id: id("notif"),
        userId: m.id,
        workOrderId: null,
        title: "Human escalation needed",
        body: `${actor.name}: ${text.slice(0, 160)}`,
        read: false,
        createdAt: now(),
      });
    }
    store.activity.unshift({
      id: id("act"),
      workOrderId: null,
      propertyId: store.properties[0]?.id || "prop-maple",
      actorUserId: actor.id,
      kind: "comms.escalated",
      message: `FAQ/message escalated to human (${reasons.join("; ")}).`,
      createdAt: now(),
    });
    return {
      kind: "escalated",
      faq: null,
      reply:
        "This looks like a legal, dispute, or safety matter. A human on the management team will follow up — we won’t auto-reply with policy text.",
      reasons,
    };
  }

  const faq = matchFaq(store, text);
  if (faq) {
    store.activity.unshift({
      id: id("act"),
      workOrderId: null,
      propertyId: store.properties[0]?.id || "prop-maple",
      actorUserId: actor.id,
      kind: "comms.faq_reply",
      message: `Auto-replied from verified FAQ “${faq.id}”.`,
      createdAt: now(),
    });
    return {
      kind: "faq",
      faq,
      reply: faq.answer,
      reasons: [],
    };
  }

  return {
    kind: "unmatched",
    faq: null,
    reply:
      "I don’t have a verified answer for that yet. Try Payments, Request Repair, or Messages — or rephrase and ask again.",
    reasons: [],
  };
}
