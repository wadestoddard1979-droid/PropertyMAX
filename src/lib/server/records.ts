import { randomUUID } from "crypto";
import type {
  ActivityEvent,
  AppStore,
  DocumentRecord,
  Lease,
  Property,
  Role,
  SessionUser,
  Unit,
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

export function propertiesVisibleTo(store: AppStore, user: SessionUser) {
  return store.properties.filter((p) => {
    try {
      assertPropertyAccess(store, user, p.id);
      return true;
    } catch {
      return false;
    }
  });
}

export function unitsForProperties(store: AppStore, propertyIds: string[]) {
  const set = new Set(propertyIds);
  return store.units.filter((u) => set.has(u.propertyId));
}

export function leasesVisibleTo(
  store: AppStore,
  user: SessionUser,
  propertyIds: string[],
) {
  const set = new Set(propertyIds);
  return store.leases.filter((l) => {
    if (!set.has(l.propertyId)) return false;
    if (user.role === "tenant") return l.tenantIds.includes(user.id);
    if (user.role === "contractor") return false;
    return true;
  });
}

export function documentsVisibleTo(store: AppStore, user: SessionUser) {
  const props = propertiesVisibleTo(store, user);
  const propIds = new Set(props.map((p) => p.id));
  return store.documents.filter((d) => {
    if (!propIds.has(d.propertyId)) return false;
    if (user.role === "manager") return true;
    return d.visibility.includes(user.role);
  });
}

export function activityVisibleTo(store: AppStore, user: SessionUser) {
  const props = propertiesVisibleTo(store, user);
  const propIds = new Set(props.map((p) => p.id));
  const woIds = new Set(
    store.workOrders
      .filter((w) => {
        if (!propIds.has(w.propertyId)) return false;
        if (user.role === "contractor") return w.contractorUserId === user.id;
        if (user.role === "tenant")
          return (
            w.createdByUserId === user.id ||
            props.some(
              (p) =>
                p.id === w.propertyId && p.tenantIds.includes(user.id),
            )
          );
        return true;
      })
      .map((w) => w.id),
  );

  return store.activity.filter((a) => {
    if (!propIds.has(a.propertyId)) return false;
    if (a.workOrderId == null) {
      // Property-level events: owner/manager always; tenant if on property; contractor skip
      if (user.role === "contractor") return false;
      return true;
    }
    return woIds.has(a.workOrderId);
  });
}

export function updateProperty(
  store: AppStore,
  actor: SessionUser,
  propertyId: string,
  patch: Partial<
    Pick<
      Property,
      | "name"
      | "address"
      | "type"
      | "beds"
      | "baths"
      | "sqft"
      | "occupancy"
      | "monthlyRent"
      | "leaseEnd"
      | "ownerApprovalThresholdCents"
      | "notes"
    >
  >,
) {
  if (actor.role !== "manager") {
    throw new Error("Only managers can edit property records");
  }
  const property = assertPropertyAccess(store, actor, propertyId);
  Object.assign(property, patch);
  // Keep primary unit in sync for single-unit pilot
  const unit = store.units.find((u) => u.propertyId === propertyId);
  if (unit) {
    if (patch.beds != null) unit.beds = patch.beds;
    if (patch.baths != null) unit.baths = patch.baths;
    if (patch.sqft != null) unit.sqft = patch.sqft;
    if (patch.occupancy != null) unit.occupancy = patch.occupancy;
    if (patch.monthlyRent != null)
      unit.monthlyRentCents = Math.round(patch.monthlyRent * 100);
  }
  pushActivity(store, {
    workOrderId: null,
    propertyId,
    actorUserId: actor.id,
    kind: "property.updated",
    message: `${actor.name} updated property record for ${property.name}.`,
  });
  return property;
}

export function updateUnit(
  store: AppStore,
  actor: SessionUser,
  unitId: string,
  patch: Partial<
    Pick<
      Unit,
      "label" | "beds" | "baths" | "sqft" | "occupancy" | "monthlyRentCents"
    >
  >,
) {
  if (actor.role !== "manager") {
    throw new Error("Only managers can edit unit records");
  }
  const unit = store.units.find((u) => u.id === unitId);
  if (!unit) throw new Error("Unit not found");
  assertPropertyAccess(store, actor, unit.propertyId);
  Object.assign(unit, patch);
  const property = store.properties.find((p) => p.id === unit.propertyId);
  if (property) {
    if (patch.beds != null) property.beds = patch.beds;
    if (patch.baths != null) property.baths = patch.baths;
    if (patch.sqft != null) property.sqft = patch.sqft;
    if (patch.occupancy != null) property.occupancy = patch.occupancy;
    if (patch.monthlyRentCents != null)
      property.monthlyRent = Math.round(patch.monthlyRentCents / 100);
  }
  pushActivity(store, {
    workOrderId: null,
    propertyId: unit.propertyId,
    actorUserId: actor.id,
    kind: "unit.updated",
    message: `${actor.name} updated unit “${unit.label}”.`,
  });
  return unit;
}

export function updateLease(
  store: AppStore,
  actor: SessionUser,
  leaseId: string,
  patch: Partial<
    Pick<
      Lease,
      | "startDate"
      | "endDate"
      | "monthlyRentCents"
      | "depositCents"
      | "status"
      | "notes"
    >
  >,
) {
  if (actor.role !== "manager") {
    throw new Error("Only managers can edit lease records");
  }
  const lease = store.leases.find((l) => l.id === leaseId);
  if (!lease) throw new Error("Lease not found");
  const property = assertPropertyAccess(store, actor, lease.propertyId);
  Object.assign(lease, patch);
  if (patch.endDate) {
    const d = new Date(patch.endDate);
    property.leaseEnd = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (patch.monthlyRentCents != null) {
    property.monthlyRent = Math.round(patch.monthlyRentCents / 100);
    const unit = store.units.find((u) => u.id === lease.unitId);
    if (unit) unit.monthlyRentCents = patch.monthlyRentCents;
  }
  pushActivity(store, {
    workOrderId: null,
    propertyId: lease.propertyId,
    actorUserId: actor.id,
    kind: "lease.updated",
    message: `${actor.name} updated lease record (${lease.status}).`,
  });
  return lease;
}

export function addDocument(
  store: AppStore,
  actor: SessionUser,
  input: {
    propertyId: string;
    title: string;
    category: DocumentRecord["category"];
    fileName: string;
    note?: string;
    workOrderId?: string | null;
    leaseId?: string | null;
    visibility?: Role[];
  },
) {
  if (actor.role !== "manager" && actor.role !== "tenant" && actor.role !== "owner") {
    throw new Error("Role cannot upload documents");
  }
  assertPropertyAccess(store, actor, input.propertyId);
  const defaultVis: Role[] =
    actor.role === "tenant"
      ? ["owner", "manager", "tenant"]
      : ["owner", "manager", "tenant"];
  const doc: DocumentRecord = {
    id: id("doc"),
    propertyId: input.propertyId,
    workOrderId: input.workOrderId ?? null,
    leaseId: input.leaseId ?? null,
    title: input.title.trim(),
    category: input.category,
    fileName: input.fileName.trim() || "document.pdf",
    uploadedByUserId: actor.id,
    visibility: input.visibility?.length ? input.visibility : defaultVis,
    note: input.note?.trim() || "Pilot metadata only — no file blob stored.",
    createdAt: now(),
  };
  store.documents.unshift(doc);
  pushActivity(store, {
    workOrderId: doc.workOrderId,
    propertyId: doc.propertyId,
    actorUserId: actor.id,
    kind: "document.added",
    message: `${actor.name} added document “${doc.title}”.`,
  });
  return doc;
}
