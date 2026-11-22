import { randomUUID } from "crypto";
import type {
  AppStore,
  AutopayEnrollment,
  PaymentRef,
  SessionUser,
} from "../types";
import { isStripeConfigured } from "./config";

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

export function ensurePaymentDefaults(store: AppStore) {
  if (!store.paymentRefs) store.paymentRefs = [];
  if (!store.autopayEnrollments) store.autopayEnrollments = [];
}

export function paymentsVisibleTo(store: AppStore, user: SessionUser) {
  ensurePaymentDefaults(store);
  if (user.role === "tenant") {
    return store.paymentRefs.filter((p) => p.tenantUserId === user.id);
  }
  if (user.role === "owner") {
    const props = store.properties.filter((p) => p.ownerId === user.id);
    const ids = new Set(props.map((p) => p.id));
    return store.paymentRefs.filter((p) => ids.has(p.propertyId));
  }
  if (user.role === "manager") {
    const props = store.properties.filter((p) => p.managerId === user.id);
    const ids = new Set(props.map((p) => p.id));
    return store.paymentRefs.filter((p) => ids.has(p.propertyId));
  }
  return [];
}

export function createCheckoutPaymentRef(
  store: AppStore,
  actor: SessionUser,
  input: {
    propertyId: string;
    month: string;
    amountCents: number;
    label?: string;
  },
): PaymentRef {
  ensurePaymentDefaults(store);
  if (actor.role !== "tenant") {
    throw new Error("Only tenants can start rent checkout");
  }
  const property = store.properties.find((p) => p.id === input.propertyId);
  if (!property || !property.tenantIds.includes(actor.id)) {
    throw new Error("No access to this property");
  }
  const lease =
    store.leases.find(
      (l) =>
        l.propertyId === property.id &&
        l.tenantIds.includes(actor.id) &&
        l.status === "active",
    ) || null;

  const ref: PaymentRef = {
    id: id("pay"),
    propertyId: property.id,
    leaseId: lease?.id ?? null,
    tenantUserId: actor.id,
    provider: isStripeConfigured() ? "stripe" : "demo",
    externalId: null,
    amountCents: input.amountCents,
    status: "checkout_open",
    month: input.month,
    label: input.label || `Rent ${input.month}`,
    metadata: { demo: !isStripeConfigured() },
    createdAt: now(),
    updatedAt: now(),
  };
  store.paymentRefs.unshift(ref);
  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: property.id,
    actorUserId: actor.id,
    kind: "payment.checkout_started",
    message: `${actor.name} started rent checkout for ${ref.label} (${ref.provider}${ref.provider === "demo" ? " · simulated" : ""}). No cards stored.`,
    createdAt: now(),
  });
  return ref;
}

export function markPaymentPaid(
  store: AppStore,
  paymentId: string,
  externalId: string | null,
  meta: Record<string, unknown> = {},
) {
  ensurePaymentDefaults(store);
  const ref = store.paymentRefs.find((p) => p.id === paymentId);
  if (!ref) throw new Error("Payment ref not found");
  ref.status = "paid";
  ref.externalId = externalId || ref.externalId;
  ref.metadata = { ...ref.metadata, ...meta, paidAt: now() };
  ref.updatedAt = now();

  // Mirror into ledger as verified only for real Stripe; demo stays manual-labeled via metadata
  store.ledger.unshift({
    id: id("led"),
    propertyId: ref.propertyId,
    month: ref.month,
    category: "rent",
    label: `${ref.label} (${ref.provider === "demo" ? "demo checkout" : "Stripe"})`,
    amountCents: ref.amountCents,
    source: ref.provider === "stripe" ? "verified" : "manual",
    createdAt: now(),
  });

  store.notifications.unshift({
    id: id("notif"),
    userId: ref.tenantUserId,
    workOrderId: null,
    title: "Rent payment recorded",
    body: `${ref.label} · $${(ref.amountCents / 100).toFixed(2)} · ${ref.provider === "demo" ? "DEMO (not a real charge)" : "Stripe Checkout"}`,
    read: false,
    createdAt: now(),
  });

  const property = store.properties.find((p) => p.id === ref.propertyId);
  if (property) {
    store.notifications.unshift({
      id: id("notif"),
      userId: property.managerId,
      workOrderId: null,
      title: "Tenant rent paid",
      body: `${ref.label} · $${(ref.amountCents / 100).toFixed(2)}`,
      read: false,
      createdAt: now(),
    });
  }

  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: ref.propertyId,
    actorUserId: ref.tenantUserId,
    kind: "payment.paid",
    message: `Payment ref ${ref.id} marked paid via ${ref.provider}. Cards are never vaulted in PropertMax.`,
    createdAt: now(),
  });
  return ref;
}

export function setAutopay(
  store: AppStore,
  actor: SessionUser,
  input: { propertyId: string; enabled: boolean; dayOfMonth?: number },
): AutopayEnrollment {
  ensurePaymentDefaults(store);
  if (actor.role !== "tenant") throw new Error("Only tenants enroll in autopay");
  const property = store.properties.find((p) => p.id === input.propertyId);
  if (!property || !property.tenantIds.includes(actor.id)) {
    throw new Error("No access to this property");
  }
  let enrollment = store.autopayEnrollments.find(
    (a) => a.propertyId === property.id && a.tenantUserId === actor.id,
  );
  const ts = now();
  if (!enrollment) {
    enrollment = {
      id: id("autopay"),
      propertyId: property.id,
      tenantUserId: actor.id,
      enabled: input.enabled,
      provider: isStripeConfigured() ? "stripe" : "demo",
      dayOfMonth: input.dayOfMonth ?? 1,
      createdAt: ts,
      updatedAt: ts,
    };
    store.autopayEnrollments.unshift(enrollment);
  } else {
    enrollment.enabled = input.enabled;
    if (input.dayOfMonth) enrollment.dayOfMonth = input.dayOfMonth;
    enrollment.updatedAt = ts;
  }
  store.activity.unshift({
    id: id("act"),
    workOrderId: null,
    propertyId: property.id,
    actorUserId: actor.id,
    kind: "payment.autopay_stub",
    message: `Autopay ${input.enabled ? "enabled" : "disabled"} (stub — no card vault; provider=${enrollment.provider}).`,
    createdAt: ts,
  });
  return enrollment;
}
