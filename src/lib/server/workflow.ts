import { randomUUID } from "crypto";
import type {
  ActivityEvent,
  AppStore,
  Notification,
  SessionUser,
  Urgency,
  WorkOrder,
} from "../types";
import { formatMoneyFromCents } from "./db";

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

function propertyOrThrow(store: AppStore, propertyId: string) {
  const property = store.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error("Property not found");
  return property;
}

function workOrderOrThrow(store: AppStore, workOrderId: string) {
  const wo = store.workOrders.find((w) => w.id === workOrderId);
  if (!wo) throw new Error("Work order not found");
  return wo;
}

export function assertPropertyAccess(
  store: AppStore,
  user: SessionUser,
  propertyId: string,
) {
  const property = propertyOrThrow(store, propertyId);
  if (user.role === "owner" && property.ownerId === user.id) return property;
  if (user.role === "manager" && property.managerId === user.id) return property;
  if (user.role === "tenant" && property.tenantIds.includes(user.id))
    return property;
  if (user.role === "contractor") {
    const assigned = store.workOrders.some(
      (w) => w.propertyId === propertyId && w.contractorUserId === user.id,
    );
    if (assigned) return property;
  }
  throw new Error("No access to this property");
}

export function createWorkOrder(
  store: AppStore,
  actor: SessionUser,
  input: {
    propertyId: string;
    title: string;
    details: string;
    urgency: Urgency;
    category?: string;
  },
): WorkOrder {
  if (actor.role !== "tenant" && actor.role !== "manager") {
    throw new Error("Only tenants or managers can create work orders");
  }
  const property = assertPropertyAccess(store, actor, input.propertyId);
  const wo: WorkOrder = {
    id: id("wo"),
    propertyId: property.id,
    createdByUserId: actor.id,
    title: input.title.trim(),
    details: input.details.trim(),
    category: input.category?.trim() || "General",
    urgency: input.urgency,
    status: "reported",
    estimateCents: null,
    estimateNotes: null,
    contractorUserId: null,
    vendorId: null,
    ownerDecision: null,
    ownerNote: null,
    requiresOwnerApproval: false,
    createdAt: now(),
    updatedAt: now(),
  };
  store.workOrders.unshift(wo);
  pushActivity(store, {
    workOrderId: wo.id,
    propertyId: property.id,
    actorUserId: actor.id,
    kind: "work_order.created",
    message: `${actor.name} submitted “${wo.title}”.`,
  });
  notify(store, {
    userId: property.managerId,
    workOrderId: wo.id,
    title: "New maintenance request",
    body: `${wo.title} · ${property.name}`,
  });
  // Auto-ack move to under_review for manager visibility
  wo.status = "under_review";
  wo.updatedAt = now();
  pushActivity(store, {
    workOrderId: wo.id,
    propertyId: property.id,
    actorUserId: property.managerId,
    kind: "work_order.auto_triage",
    message: "System placed request under review for manager triage.",
  });
  return wo;
}

export function addEstimate(
  store: AppStore,
  actor: SessionUser,
  workOrderId: string,
  estimateCents: number,
  estimateNotes: string,
  vendorId?: string,
) {
  if (actor.role !== "manager") throw new Error("Only managers add estimates");
  const wo = workOrderOrThrow(store, workOrderId);
  const property = assertPropertyAccess(store, actor, wo.propertyId);
  if (estimateCents < 0) throw new Error("Estimate must be >= 0");

  wo.estimateCents = estimateCents;
  wo.estimateNotes = estimateNotes.trim() || null;
  if (vendorId) {
    const vendor = store.vendors.find((v) => v.id === vendorId);
    if (!vendor) throw new Error("Vendor not found");
    wo.vendorId = vendor.id;
  }
  wo.updatedAt = now();

  const over =
    estimateCents > property.ownerApprovalThresholdCents;
  wo.requiresOwnerApproval = over;

  if (over) {
    wo.status = "awaiting_owner_approval";
    wo.ownerDecision = "pending";
    pushActivity(store, {
      workOrderId: wo.id,
      propertyId: property.id,
      actorUserId: actor.id,
      kind: "work_order.estimate_added",
      message: `Estimate ${formatMoneyFromCents(estimateCents)} exceeds ${formatMoneyFromCents(property.ownerApprovalThresholdCents)} threshold — owner approval required.`,
    });
    notify(store, {
      userId: property.ownerId,
      workOrderId: wo.id,
      title: "Approval needed",
      body: `${wo.title} · ${formatMoneyFromCents(estimateCents)} quote awaiting your decision.`,
    });
    notify(store, {
      userId: wo.createdByUserId,
      workOrderId: wo.id,
      title: "Estimate ready",
      body: "Your request is awaiting owner approval.",
    });
  } else {
    wo.status = "approved";
    wo.ownerDecision = null;
    wo.requiresOwnerApproval = false;
    pushActivity(store, {
      workOrderId: wo.id,
      propertyId: property.id,
      actorUserId: actor.id,
      kind: "work_order.auto_approved",
      message: `Estimate ${formatMoneyFromCents(estimateCents)} is under threshold — auto-approved for scheduling.`,
    });
    notify(store, {
      userId: wo.createdByUserId,
      workOrderId: wo.id,
      title: "Approved for scheduling",
      body: `${wo.title} cleared under the $${property.ownerApprovalThresholdCents / 100} policy.`,
    });
  }
  return wo;
}

export function ownerDecide(
  store: AppStore,
  actor: SessionUser,
  workOrderId: string,
  decision: "approved" | "declined" | "asked",
  note?: string,
) {
  if (actor.role !== "owner") throw new Error("Only owners decide");
  const wo = workOrderOrThrow(store, workOrderId);
  const property = assertPropertyAccess(store, actor, wo.propertyId);
  if (wo.status !== "awaiting_owner_approval") {
    throw new Error("Work order is not awaiting owner approval");
  }

  wo.ownerDecision = decision;
  wo.ownerNote = note?.trim() || null;
  wo.updatedAt = now();

  if (decision === "approved") {
    wo.status = "approved";
    pushActivity(store, {
      workOrderId: wo.id,
      propertyId: property.id,
      actorUserId: actor.id,
      kind: "work_order.owner_approved",
      message: `Owner approved ${formatMoneyFromCents(wo.estimateCents || 0)}.`,
    });
    notify(store, {
      userId: property.managerId,
      workOrderId: wo.id,
      title: "Owner approved",
      body: `${wo.title} — assign contractor when ready.`,
    });
    notify(store, {
      userId: wo.createdByUserId,
      workOrderId: wo.id,
      title: "Repair approved",
      body: "Owner approved the estimate. Scheduling comes next.",
    });
  } else if (decision === "declined") {
    wo.status = "declined";
    pushActivity(store, {
      workOrderId: wo.id,
      propertyId: property.id,
      actorUserId: actor.id,
      kind: "work_order.owner_declined",
      message: `Owner declined${wo.ownerNote ? `: ${wo.ownerNote}` : "."}`,
    });
    notify(store, {
      userId: property.managerId,
      workOrderId: wo.id,
      title: "Owner declined",
      body: wo.ownerNote || `${wo.title} was declined.`,
    });
  } else {
    pushActivity(store, {
      workOrderId: wo.id,
      propertyId: property.id,
      actorUserId: actor.id,
      kind: "work_order.owner_asked",
      message: `Owner asked a question${wo.ownerNote ? `: ${wo.ownerNote}` : "."}`,
    });
    notify(store, {
      userId: property.managerId,
      workOrderId: wo.id,
      title: "Owner question",
      body: wo.ownerNote || "Owner asked about the estimate.",
    });
  }
  return wo;
}

export function assignContractor(
  store: AppStore,
  actor: SessionUser,
  workOrderId: string,
  vendorId: string,
) {
  if (actor.role !== "manager") throw new Error("Only managers assign");
  const wo = workOrderOrThrow(store, workOrderId);
  const property = assertPropertyAccess(store, actor, wo.propertyId);
  if (wo.status !== "approved" && wo.status !== "assigned") {
    throw new Error("Work order must be approved before assignment");
  }
  const vendor = store.vendors.find((v) => v.id === vendorId);
  if (!vendor) throw new Error("Vendor not found");

  wo.vendorId = vendor.id;
  wo.contractorUserId = vendor.contractorUserId;
  wo.status = "assigned";
  wo.updatedAt = now();

  pushActivity(store, {
    workOrderId: wo.id,
    propertyId: property.id,
    actorUserId: actor.id,
    kind: "work_order.assigned",
    message: `Assigned to ${vendor.name}.`,
  });
  notify(store, {
    userId: vendor.contractorUserId,
    workOrderId: wo.id,
    title: "New job assigned",
    body: `${wo.title} · ${property.name}`,
  });
  notify(store, {
    userId: wo.createdByUserId,
    workOrderId: wo.id,
    title: "Contractor assigned",
    body: `${vendor.name} will handle your request.`,
  });
  return wo;
}

export function contractorUpdateStatus(
  store: AppStore,
  actor: SessionUser,
  workOrderId: string,
  status: "scheduled" | "in_progress" | "completed",
) {
  if (actor.role !== "contractor" && actor.role !== "manager") {
    throw new Error("Only contractor or manager can update job status");
  }
  const wo = workOrderOrThrow(store, workOrderId);
  const property = propertyOrThrow(store, wo.propertyId);
  if (actor.role === "contractor" && wo.contractorUserId !== actor.id) {
    throw new Error("Not your assigned job");
  }
  if (actor.role === "manager") {
    assertPropertyAccess(store, actor, wo.propertyId);
  }

  const allowedFrom: Record<string, string[]> = {
    scheduled: ["assigned", "scheduled"],
    in_progress: ["assigned", "scheduled", "in_progress"],
    completed: ["scheduled", "in_progress", "assigned"],
  };
  if (!allowedFrom[status].includes(wo.status)) {
    throw new Error(`Cannot move from ${wo.status} to ${status}`);
  }

  wo.status = status;
  wo.updatedAt = now();
  pushActivity(store, {
    workOrderId: wo.id,
    propertyId: property.id,
    actorUserId: actor.id,
    kind: `work_order.${status}`,
    message: `Status → ${status.replaceAll("_", " ")}.`,
  });
  for (const uid of [
    property.ownerId,
    property.managerId,
    wo.createdByUserId,
  ]) {
    if (uid === actor.id) continue;
    notify(store, {
      userId: uid,
      workOrderId: wo.id,
      title: `Job ${status.replaceAll("_", " ")}`,
      body: `${wo.title} · ${property.name}`,
    });
  }
  return wo;
}

export function workOrdersVisibleTo(store: AppStore, user: SessionUser) {
  return store.workOrders.filter((wo) => {
    const property = store.properties.find((p) => p.id === wo.propertyId);
    if (!property) return false;
    if (user.role === "owner") return property.ownerId === user.id;
    if (user.role === "manager") return property.managerId === user.id;
    if (user.role === "tenant")
      return (
        property.tenantIds.includes(user.id) &&
        (wo.createdByUserId === user.id || true)
      );
    if (user.role === "contractor") return wo.contractorUserId === user.id;
    return false;
  });
}
