import type {
  AppStore,
  AutomationPolicy,
  SessionUser,
  SpendDecisionReason,
} from "../types";

export function defaultPolicyForProperty(
  propertyId: string,
  opts?: {
    spendThresholdCents?: number;
    preferredVendorIds?: string[];
    escalationContactUserId?: string | null;
  },
): AutomationPolicy {
  return {
    id: `policy-${propertyId}`,
    propertyId,
    name: "Default spend & vendor policy",
    spendThresholdCents: opts?.spendThresholdCents ?? 20000,
    preapprovedCategories: ["Plumbing", "Electrical"],
    emergencyProcess:
      "If emergency flag: notify manager immediately, then owner. AI recommendations never authorize spend.",
    preferredVendorIds: opts?.preferredVendorIds ?? [],
    escalationContactUserId: opts?.escalationContactUserId ?? null,
    maxWaitHours: 48,
    enabled: true,
  };
}

export function ensurePolicies(store: AppStore) {
  if (!store.automationPolicies) store.automationPolicies = [];
  for (const p of store.properties) {
    if (!store.automationPolicies.some((x) => x.propertyId === p.id)) {
      store.automationPolicies.push(
        defaultPolicyForProperty(p.id, {
          spendThresholdCents: p.ownerApprovalThresholdCents,
          preferredVendorIds: store.vendors.map((v) => v.id),
          escalationContactUserId: p.managerId,
        }),
      );
    }
  }
}

export function getPolicyForProperty(
  store: AppStore,
  propertyId: string,
): AutomationPolicy {
  ensurePolicies(store);
  return (
    store.automationPolicies.find((p) => p.propertyId === propertyId) ||
    defaultPolicyForProperty(propertyId)
  );
}

/**
 * Deterministic spend routing. AI recommendations must never appear as a reason.
 */
export function evaluateSpendDecision(
  policy: AutomationPolicy,
  category: string,
  estimateCents: number,
  propertyFallbackThresholdCents: number,
): {
  requiresOwnerApproval: boolean;
  reason: SpendDecisionReason;
  thresholdCents: number;
} {
  const threshold = policy.enabled
    ? policy.spendThresholdCents
    : propertyFallbackThresholdCents;
  const reasonBase: SpendDecisionReason = policy.enabled
    ? estimateCents > threshold
      ? "over_threshold"
      : policy.preapprovedCategories
            .map((c) => c.toLowerCase())
            .includes(category.toLowerCase())
        ? "preapproved_under_threshold"
        : "category_not_preapproved"
    : estimateCents > threshold
      ? "over_threshold"
      : "policy_disabled_fallback_threshold";

  if (!policy.enabled) {
    return {
      requiresOwnerApproval: estimateCents > threshold,
      reason:
        estimateCents > threshold
          ? "over_threshold"
          : "policy_disabled_fallback_threshold",
      thresholdCents: threshold,
    };
  }

  if (estimateCents > threshold) {
    return {
      requiresOwnerApproval: true,
      reason: "over_threshold",
      thresholdCents: threshold,
    };
  }

  if (
    policy.preapprovedCategories
      .map((c) => c.toLowerCase())
      .includes(category.toLowerCase())
  ) {
    return {
      requiresOwnerApproval: false,
      reason: "preapproved_under_threshold",
      thresholdCents: threshold,
    };
  }

  // Under threshold but category not preapproved → still require owner
  return {
    requiresOwnerApproval: true,
    reason: "category_not_preapproved",
    thresholdCents: threshold,
  };
}

export function updatePolicy(
  store: AppStore,
  actor: SessionUser,
  propertyId: string,
  patch: Partial<
    Pick<
      AutomationPolicy,
      | "name"
      | "spendThresholdCents"
      | "preapprovedCategories"
      | "emergencyProcess"
      | "preferredVendorIds"
      | "escalationContactUserId"
      | "maxWaitHours"
      | "enabled"
    >
  >,
): AutomationPolicy {
  if (actor.role !== "manager") {
    throw new Error("Only managers can edit automation policies");
  }
  const property = store.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error("Property not found");
  if (property.managerId !== actor.id) {
    throw new Error("No access to this property");
  }
  ensurePolicies(store);
  const idx = store.automationPolicies.findIndex(
    (p) => p.propertyId === propertyId,
  );
  const current =
    idx >= 0
      ? store.automationPolicies[idx]
      : defaultPolicyForProperty(propertyId, {
          spendThresholdCents: property.ownerApprovalThresholdCents,
          escalationContactUserId: property.managerId,
        });

  if (patch.spendThresholdCents != null && patch.spendThresholdCents < 0) {
    throw new Error("spendThresholdCents must be >= 0");
  }
  if (patch.maxWaitHours != null && patch.maxWaitHours < 1) {
    throw new Error("maxWaitHours must be >= 1");
  }

  const next: AutomationPolicy = {
    ...current,
    ...patch,
    id: current.id,
    propertyId,
    preapprovedCategories: (
      patch.preapprovedCategories ?? current.preapprovedCategories
    ).map((c) => c.trim()).filter(Boolean),
    preferredVendorIds: patch.preferredVendorIds ?? current.preferredVendorIds,
  };

  // Keep legacy property field in sync for existing UI
  if (patch.spendThresholdCents != null) {
    property.ownerApprovalThresholdCents = patch.spendThresholdCents;
  }

  if (idx >= 0) store.automationPolicies[idx] = next;
  else store.automationPolicies.push(next);

  store.activity.unshift({
    id: `act-policy-${Date.now()}`,
    workOrderId: null,
    propertyId,
    actorUserId: actor.id,
    kind: "policy.updated",
    message: `${actor.name} updated spend policy (threshold $${(next.spendThresholdCents / 100).toFixed(0)}, preapproved: ${next.preapprovedCategories.join(", ") || "none"}). AI cannot override.`,
    createdAt: new Date().toISOString(),
  });

  return next;
}

export function reasonLabel(reason: SpendDecisionReason) {
  switch (reason) {
    case "over_threshold":
      return "Over spend threshold — owner approval required";
    case "preapproved_under_threshold":
      return "Preapproved category under threshold — auto-cleared for assignment";
    case "category_not_preapproved":
      return "Category not preapproved — owner approval required";
    case "policy_disabled_fallback_threshold":
      return "Policy disabled — used property fallback threshold";
  }
}
