import { randomUUID } from "crypto";
import type {
  AppStore,
  IntakeAnswers,
  IntakeAudit,
  SessionUser,
  WorkOrder,
} from "../../types";
import { classifyIntake } from "./classifier";
import { createWorkOrder } from "../workflow";

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function ensureIntakeAudits(store: AppStore) {
  if (!store.intakeAudits) store.intakeAudits = [];
}

/**
 * Conversational intake → classify → structured work order.
 * HARD RULE: never sets estimateCents / never marks spend authorized.
 */
export async function submitMaintenanceIntake(
  store: AppStore,
  actor: SessionUser,
  input: { propertyId: string; answers: IntakeAnswers },
): Promise<{ workOrder: WorkOrder; audit: IntakeAudit }> {
  if (actor.role !== "tenant" && actor.role !== "manager") {
    throw new Error("Only tenants or managers can submit intake");
  }
  ensureIntakeAudits(store);

  const answers: IntakeAnswers = {
    summary: input.answers.summary?.trim() || "",
    location: input.answers.location?.trim() || "",
    flooding: input.answers.flooding || "no",
    waterShutoffKnown: input.answers.waterShutoffKnown || "na",
    electricityHazard: input.answers.electricityHazard || "no",
    smellGas: input.answers.smellGas || "no",
    canUseHome: input.answers.canUseHome || "yes",
    photoNotes: input.answers.photoNotes?.trim() || "",
    freeText: input.answers.freeText?.trim() || "",
  };
  if (answers.summary.length < 3) {
    throw new Error("Please describe the issue (summary required)");
  }

  const { classification, trace } = await classifyIntake(answers);

  // Defense in depth — never allow classification to authorize money
  if (classification.spendAuthorized !== false) {
    throw new Error("Invariant violated: classification attempted spend authorization");
  }

  const detailsParts = [
    answers.summary,
    answers.location ? `Location: ${answers.location}` : null,
    `Flooding: ${answers.flooding}`,
    `Water shutoff known: ${answers.waterShutoffKnown}`,
    `Electrical hazard: ${answers.electricityHazard}`,
    `Gas smell: ${answers.smellGas}`,
    `Home usable: ${answers.canUseHome}`,
    answers.photoNotes ? `Photos/notes: ${answers.photoNotes}` : null,
    answers.freeText ? `More: ${answers.freeText}` : null,
    "",
    `AI/rules classification: ${classification.category} · ${classification.urgency}` +
      (classification.emergency ? " · EMERGENCY FLAG" : ""),
    `Confidence: ${Math.round(classification.confidence * 100)}% (${classification.engine})`,
    `Recommended next step: ${classification.recommendedNextStep}`,
    "HARD RULE: No spend authorized by intake — estimate & approval remain human/policy gated.",
  ]
    .filter(Boolean)
    .join("\n");

  const title =
    answers.summary.length > 72
      ? `${answers.summary.slice(0, 69)}…`
      : answers.summary;

  const workOrder = createWorkOrder(store, actor, {
    propertyId: input.propertyId,
    title,
    details: detailsParts,
    urgency: classification.urgency,
    category: classification.category,
  });

  // Intake must not invent estimates or flip approval flags for money
  workOrder.estimateCents = null;
  workOrder.estimateNotes = null;
  workOrder.requiresOwnerApproval = false;
  workOrder.emergencyFlag = classification.emergency;
  workOrder.updatedAt = now();

  const audit: IntakeAudit = {
    id: id("intake"),
    propertyId: input.propertyId,
    workOrderId: workOrder.id,
    actorUserId: actor.id,
    answers,
    classification,
    trace: [
      ...trace,
      {
        step: "work_order_created",
        detail: `Created ${workOrder.id} in status ${workOrder.status} with estimateCents=null (AI cannot authorize spend).`,
      },
    ],
    createdAt: now(),
  };
  workOrder.intakeAuditId = audit.id;
  store.intakeAudits.unshift(audit);

  store.activity.unshift({
    id: id("act"),
    workOrderId: workOrder.id,
    propertyId: input.propertyId,
    actorUserId: actor.id,
    kind: "intake.classified",
    message: `Intake classified as ${classification.category}/${classification.urgency}` +
      (classification.emergency ? " (emergency flag)" : "") +
      ` via ${classification.engine}. Spend not authorized.`,
    createdAt: now(),
  });

  if (classification.emergency) {
    const property = store.properties.find((p) => p.id === input.propertyId);
    if (property) {
      store.notifications.unshift({
        id: id("notif"),
        userId: property.managerId,
        workOrderId: workOrder.id,
        title: "Emergency maintenance flag",
        body: `${title} — intake flagged emergency. Review immediately. Spend still requires policy/human approval.`,
        read: false,
        createdAt: now(),
      });
      store.notifications.unshift({
        id: id("notif"),
        userId: property.ownerId,
        workOrderId: workOrder.id,
        title: "Emergency flag on request",
        body: `${title} — advisory only; no spend auto-approved.`,
        read: false,
        createdAt: now(),
      });
    }
  }

  return { workOrder, audit };
}

export function getIntakeAudit(store: AppStore, auditId: string) {
  ensureIntakeAudits(store);
  return store.intakeAudits.find((a) => a.id === auditId) || null;
}
