import type {
  AppStore,
  DocumentRecord,
  Lease,
  Message,
  MessageThread,
  Property,
  Role,
  Unit,
  User,
  WorkOrder,
} from "../../types";
import { createSeedStore } from "../seed";
import { getServiceClient } from "./client";

const ORG_ID = "org-pilot";

type DbProfile = {
  id: string;
  email: string;
  full_name: string;
  demo_password: string | null;
};

/**
 * Hydrate the in-memory AppStore shape from Supabase (service role).
 * Server routes still apply permission checks; RLS is defense-in-depth
 * for future user-scoped clients.
 */
export async function loadStoreFromSupabase(): Promise<AppStore> {
  const sb = getServiceClient();

  const [
    profiles,
    properties,
    propertyTenants,
    units,
    leases,
    leaseTenants,
    vendors,
    workOrders,
    ledger,
    assumptions,
    documents,
    threads,
    participants,
    messages,
    notifications,
    activity,
    intakeAudits,
    automationPoliciesRes,
    paymentRefsRes,
    autopayRes,
  ] = await Promise.all([
    sb.from("profiles").select("*"),
    sb.from("properties").select("*"),
    sb.from("property_tenants").select("*"),
    sb.from("units").select("*"),
    sb.from("leases").select("*"),
    sb.from("lease_tenants").select("*"),
    sb.from("vendors").select("*"),
    sb.from("work_orders").select("*"),
    sb.from("ledger_entries").select("*"),
    sb.from("projection_assumptions").select("*"),
    sb.from("documents").select("*"),
    sb.from("message_threads").select("*"),
    sb.from("message_participants").select("*"),
    sb.from("messages").select("*"),
    sb.from("notifications").select("*"),
    sb.from("activity_events").select("*"),
    sb.from("intake_audits").select("*"),
    sb.from("automation_policies").select("*"),
    sb.from("payment_refs").select("*"),
    sb.from("autopay_enrollments").select("*"),
  ]);

  const errors = [
    profiles.error,
    properties.error,
    propertyTenants.error,
    units.error,
    leases.error,
    leaseTenants.error,
    vendors.error,
    workOrders.error,
    ledger.error,
    assumptions.error,
    documents.error,
    threads.error,
    participants.error,
    messages.error,
    notifications.error,
    activity.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(
      `Supabase hydrate failed: ${errors.map((e) => e!.message).join("; ")}`,
    );
  }
  // intake_audits may be missing until migration applied
  const intakeRows = intakeAudits.error ? [] : intakeAudits.data || [];

  if (!profiles.data?.length || !properties.data?.length) {
    // Empty project — seed once
    const seeded = createSeedStore();
    await persistStoreToSupabase(seeded);
    return seeded;
  }

  const tenantsByProperty = new Map<string, string[]>();
  for (const row of propertyTenants.data || []) {
    const list = tenantsByProperty.get(row.property_id) || [];
    list.push(row.tenant_id);
    tenantsByProperty.set(row.property_id, list);
  }

  const tenantsByLease = new Map<string, string[]>();
  for (const row of leaseTenants.data || []) {
    const list = tenantsByLease.get(row.lease_id) || [];
    list.push(row.tenant_id);
    tenantsByLease.set(row.lease_id, list);
  }

  const participantsByThread = new Map<string, string[]>();
  for (const row of participants.data || []) {
    const list = participantsByThread.get(row.thread_id) || [];
    list.push(row.user_id);
    participantsByThread.set(row.thread_id, list);
  }

  const memberships = await sb.from("memberships").select("*");
  const roleByUser = new Map<string, Role>();
  for (const m of memberships.data || []) {
    roleByUser.set(m.user_id, m.role as Role);
  }

  const users: User[] = (profiles.data as DbProfile[]).map((p) => ({
    id: p.id,
    email: p.email,
    name: p.full_name,
    role: roleByUser.get(p.id) || "tenant",
    password: p.demo_password || "pilot",
  }));

  const props: Property[] = (properties.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    type: p.type,
    beds: Number(p.beds),
    baths: Number(p.baths),
    sqft: p.sqft,
    occupancy: p.occupancy,
    ownerId: p.owner_id,
    managerId: p.manager_id,
    tenantIds: tenantsByProperty.get(p.id) || [],
    ownerApprovalThresholdCents: p.owner_approval_threshold_cents,
    monthlyRent: Number(p.monthly_rent),
    leaseEnd: p.lease_end || "",
    notes: p.notes || undefined,
  }));

  const unitRows: Unit[] = (units.data || []).map((u) => ({
    id: u.id,
    propertyId: u.property_id,
    label: u.label,
    beds: Number(u.beds),
    baths: Number(u.baths),
    sqft: u.sqft,
    occupancy: u.occupancy,
    monthlyRentCents: u.monthly_rent_cents,
  }));

  const leaseRows: Lease[] = (leases.data || []).map((l) => ({
    id: l.id,
    propertyId: l.property_id,
    unitId: l.unit_id,
    tenantIds: tenantsByLease.get(l.id) || [],
    startDate: l.start_date,
    endDate: l.end_date,
    monthlyRentCents: l.monthly_rent_cents,
    depositCents: l.deposit_cents,
    status: l.status,
    notes: l.notes || "",
  }));

  const docs: DocumentRecord[] = (documents.data || []).map((d) => ({
    id: d.id,
    propertyId: d.property_id,
    workOrderId: d.work_order_id,
    leaseId: d.lease_id,
    title: d.title,
    category: d.category,
    fileName: d.file_name,
    uploadedByUserId: d.uploaded_by_user_id,
    visibility: d.visibility as Role[],
    note: d.note || "",
    createdAt: d.created_at,
  }));

  const threadRows: MessageThread[] = (threads.data || []).map((t) => ({
    id: t.id,
    propertyId: t.property_id,
    workOrderId: t.work_order_id,
    subject: t.subject,
    participantIds: participantsByThread.get(t.id) || [],
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));

  const messageRows: Message[] = (messages.data || []).map((m) => ({
    id: m.id,
    threadId: m.thread_id,
    authorUserId: m.author_user_id,
    body: m.body,
    createdAt: m.created_at,
  }));

  const woRows: WorkOrder[] = (workOrders.data || []).map((w) => ({
    id: w.id,
    propertyId: w.property_id,
    createdByUserId: w.created_by_user_id,
    title: w.title,
    details: w.details,
    category: w.category,
    urgency: w.urgency,
    status: w.status,
    estimateCents: w.estimate_cents,
    estimateNotes: w.estimate_notes,
    contractorUserId: w.contractor_user_id,
    vendorId: w.vendor_id,
    ownerDecision: w.owner_decision,
    ownerNote: w.owner_note,
    requiresOwnerApproval: w.requires_owner_approval,
    intakeAuditId: w.intake_audit_id ?? null,
    emergencyFlag: Boolean(w.emergency_flag),
    policyDecisionReason: w.policy_decision_reason ?? null,
    quoteRequestedAt: w.quote_requested_at ?? null,
    escalationDueAt: w.escalation_due_at ?? null,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  }));

  const policyRows = automationPoliciesRes.error
    ? []
    : automationPoliciesRes.data || [];

  const payRows = paymentRefsRes.error ? [] : paymentRefsRes.data || [];
  const autopayRows = autopayRes.error ? [] : autopayRes.data || [];

  return {
    version: 8,
    seededAt: new Date().toISOString(),
    users,
    properties: props,
    units: unitRows,
    leases: leaseRows,
    documents: docs,
    messageThreads: threadRows,
    messages: messageRows,
    vendors: (vendors.data || []).map((v) => ({
      id: v.id,
      name: v.name,
      trade: v.trade,
      contractorUserId: v.contractor_user_id,
    })),
    workOrders: woRows,
    activity: (activity.data || []).map((a) => ({
      id: a.id,
      workOrderId: a.work_order_id,
      propertyId: a.property_id,
      actorUserId: a.actor_user_id,
      kind: a.kind,
      message: a.message,
      createdAt: a.created_at,
    })),
    notifications: (notifications.data || []).map((n) => ({
      id: n.id,
      userId: n.user_id,
      workOrderId: n.work_order_id,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.created_at,
    })),
    ledger: (ledger.data || []).map((e) => ({
      id: e.id,
      propertyId: e.property_id,
      month: e.month,
      category: e.category,
      label: e.label,
      amountCents: e.amount_cents,
      source: e.source,
      createdAt: e.created_at,
    })),
    projectionAssumptions: (assumptions.data || []).map((a) => ({
      propertyId: a.property_id,
      monthlyRentCents: a.monthly_rent_cents,
      vacancyRatePct: Number(a.vacancy_rate_pct),
      monthlyRepairsCents: a.monthly_repairs_cents,
      monthlyMortgageCents: a.monthly_mortgage_cents,
      monthlyTaxesCents: a.monthly_taxes_cents,
      monthlyInsuranceCents: a.monthly_insurance_cents,
      monthlyPmFeeCents: a.monthly_pm_fee_cents,
      monthlyHoaCents: a.monthly_hoa_cents,
      monthlyUtilitiesOwnerCents: a.monthly_utilities_owner_cents,
      annualRentGrowthPct: Number(a.annual_rent_growth_pct),
      renovationSpendCents: a.renovation_spend_cents,
      renovationMonthOffset: a.renovation_month_offset,
      renovationRentUpliftCents: a.renovation_rent_uplift_cents,
      vacancyMonthsOnTurnover: Number(a.vacancy_months_on_turnover),
    })),
    intakeAudits: intakeRows.map((a) => ({
      id: a.id,
      propertyId: a.property_id,
      workOrderId: a.work_order_id,
      actorUserId: a.actor_user_id,
      answers: a.answers,
      classification: a.classification,
      trace: a.trace || [],
      createdAt: a.created_at,
    })),
    automationPolicies: policyRows.map((p) => ({
      id: p.id,
      propertyId: p.property_id,
      name: p.name,
      spendThresholdCents: p.spend_threshold_cents,
      preapprovedCategories: p.preapproved_categories || [],
      emergencyProcess: p.emergency_process || "",
      preferredVendorIds: p.preferred_vendor_ids || [],
      escalationContactUserId: p.escalation_contact_user_id,
      maxWaitHours: p.max_wait_hours ?? 48,
      enabled: p.enabled !== false,
    })),
    paymentRefs: payRows.map((p) => {
      const meta = (p.metadata || {}) as Record<string, unknown>;
      return {
        id: p.id,
        propertyId: p.property_id,
        leaseId: p.lease_id,
        tenantUserId:
          p.tenant_user_id ||
          (typeof meta.tenantUserId === "string" ? meta.tenantUserId : ""),
        provider: (p.provider === "stripe" ? "stripe" : "demo") as
          | "stripe"
          | "demo",
        externalId: p.external_id,
        amountCents: p.amount_cents,
        status: p.status,
        month:
          p.month ||
          (typeof meta.month === "string" ? meta.month : "") ||
          "",
        label:
          p.label ||
          (typeof meta.label === "string" ? meta.label : "Rent") ||
          "Rent",
        metadata: meta,
        createdAt: p.created_at,
        updatedAt: p.updated_at || p.created_at,
      };
    }),
    autopayEnrollments: autopayRows.map((a) => ({
      id: a.id,
      propertyId: a.property_id,
      tenantUserId: a.tenant_user_id,
      enabled: Boolean(a.enabled),
      provider: (a.provider === "stripe" ? "stripe" : "demo") as
        | "stripe"
        | "demo",
      dayOfMonth: a.day_of_month ?? 1,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    })),
    verifiedFaqs: [],
    ownerStatements: [],
    renovationProjects: [],
    turnoverChecklists: [],
    assets: [],
    organizations: [],
    memberships: [],
    saasSubscriptions: [],
    saasInvoices: [],
    whiteLabelThemes: [],
    accountingImports: [],
    auditLogs: [],
    monitoringEvents: [],
  };
}

async function clearPilotTables() {
  const sb = getServiceClient();
  // Order matters for FKs — delete children first.
  const steps: Array<() => PromiseLike<{ error: { message: string } | null }>> = [
    () => sb.from("messages").delete().neq("id", ""),
    () => sb.from("message_participants").delete().neq("thread_id", ""),
    () => sb.from("message_threads").delete().neq("id", ""),
    () => sb.from("notifications").delete().neq("id", ""),
    () => sb.from("activity_events").delete().neq("id", ""),
    () => sb.from("intake_audits").delete().neq("id", ""),
    () => sb.from("documents").delete().neq("id", ""),
    () => sb.from("ledger_entries").delete().neq("id", ""),
    () => sb.from("payment_refs").delete().neq("id", ""),
    () => sb.from("autopay_enrollments").delete().neq("id", ""),
    () => sb.from("projection_assumptions").delete().neq("property_id", ""),
    () => sb.from("automation_policies").delete().neq("id", ""),
    () => sb.from("work_orders").delete().neq("id", ""),
    () => sb.from("lease_tenants").delete().neq("lease_id", ""),
    () => sb.from("leases").delete().neq("id", ""),
    () => sb.from("units").delete().neq("id", ""),
    () => sb.from("property_tenants").delete().neq("property_id", ""),
    () => sb.from("vendors").delete().neq("id", ""),
    () => sb.from("properties").delete().neq("id", ""),
    () => sb.from("memberships").delete().neq("id", ""),
    () => sb.from("audit_logs").delete().neq("id", ""),
    () => sb.from("job_queue").delete().neq("id", ""),
    () => sb.from("profiles").delete().neq("id", ""),
    () => sb.from("organizations").delete().neq("id", ""),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) {
      console.warn("clearPilotTables:", error.message);
    }
  }
}

export async function persistStoreToSupabase(store: AppStore): Promise<void> {
  const sb = getServiceClient();
  await clearPilotTables();

  const { error: orgErr } = await sb.from("organizations").upsert({
    id: ORG_ID,
    name: "PropertMax Pilot Org",
  });
  if (orgErr) throw orgErr;

  const { error: profileErr } = await sb.from("profiles").upsert(
    store.users.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.name,
      demo_password: u.password,
    })),
  );
  if (profileErr) throw profileErr;

  const { error: memErr } = await sb.from("memberships").upsert(
    store.users.map((u) => ({
      id: `mem-${u.id}`,
      org_id: ORG_ID,
      user_id: u.id,
      role: u.role,
    })),
  );
  if (memErr) throw memErr;

  const { error: propErr } = await sb.from("properties").upsert(
    store.properties.map((p) => ({
      id: p.id,
      org_id: ORG_ID,
      name: p.name,
      address: p.address,
      type: p.type,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      occupancy: p.occupancy,
      owner_id: p.ownerId,
      manager_id: p.managerId,
      owner_approval_threshold_cents: p.ownerApprovalThresholdCents,
      monthly_rent: p.monthlyRent,
      lease_end: p.leaseEnd,
      notes: p.notes || null,
    })),
  );
  if (propErr) throw propErr;

  const tenantRows = store.properties.flatMap((p) =>
    p.tenantIds.map((tenantId) => ({
      property_id: p.id,
      tenant_id: tenantId,
    })),
  );
  if (tenantRows.length) {
    const { error } = await sb.from("property_tenants").upsert(tenantRows);
    if (error) throw error;
  }

  if (store.units.length) {
    const { error } = await sb.from("units").upsert(
      store.units.map((u) => ({
        id: u.id,
        property_id: u.propertyId,
        label: u.label,
        beds: u.beds,
        baths: u.baths,
        sqft: u.sqft,
        occupancy: u.occupancy,
        monthly_rent_cents: u.monthlyRentCents,
      })),
    );
    if (error) throw error;
  }

  if (store.leases.length) {
    const { error } = await sb.from("leases").upsert(
      store.leases.map((l) => ({
        id: l.id,
        property_id: l.propertyId,
        unit_id: l.unitId,
        start_date: l.startDate,
        end_date: l.endDate,
        monthly_rent_cents: l.monthlyRentCents,
        deposit_cents: l.depositCents,
        status: l.status,
        notes: l.notes,
      })),
    );
    if (error) throw error;
    const lt = store.leases.flatMap((l) =>
      l.tenantIds.map((tenantId) => ({
        lease_id: l.id,
        tenant_id: tenantId,
      })),
    );
    if (lt.length) {
      const { error: ltErr } = await sb.from("lease_tenants").upsert(lt);
      if (ltErr) throw ltErr;
    }
  }

  if (store.vendors.length) {
    const { error } = await sb.from("vendors").upsert(
      store.vendors.map((v) => ({
        id: v.id,
        org_id: ORG_ID,
        name: v.name,
        trade: v.trade,
        contractor_user_id: v.contractorUserId,
      })),
    );
    if (error) throw error;
  }

  if (store.workOrders.length) {
    const { error } = await sb.from("work_orders").upsert(
      store.workOrders.map((w) => ({
        id: w.id,
        property_id: w.propertyId,
        created_by_user_id: w.createdByUserId,
        title: w.title,
        details: w.details,
        category: w.category,
        urgency: w.urgency,
        status: w.status,
        estimate_cents: w.estimateCents,
        estimate_notes: w.estimateNotes,
        contractor_user_id: w.contractorUserId,
        vendor_id: w.vendorId,
        owner_decision: w.ownerDecision,
        owner_note: w.ownerNote,
        requires_owner_approval: w.requiresOwnerApproval,
        intake_audit_id: w.intakeAuditId ?? null,
        emergency_flag: Boolean(w.emergencyFlag),
        policy_decision_reason: w.policyDecisionReason ?? null,
        quote_requested_at: w.quoteRequestedAt ?? null,
        escalation_due_at: w.escalationDueAt ?? null,
        created_at: w.createdAt,
        updated_at: w.updatedAt,
      })),
    );
    if (error) throw error;
  }

  if (store.intakeAudits?.length) {
    const { error } = await sb.from("intake_audits").upsert(
      store.intakeAudits.map((a) => ({
        id: a.id,
        property_id: a.propertyId,
        work_order_id: a.workOrderId,
        actor_user_id: a.actorUserId,
        answers: a.answers,
        classification: a.classification,
        trace: a.trace,
        created_at: a.createdAt,
      })),
    );
    if (error) throw error;
  }

  if (store.ledger.length) {
    const { error } = await sb.from("ledger_entries").upsert(
      store.ledger.map((e) => ({
        id: e.id,
        property_id: e.propertyId,
        month: e.month,
        category: e.category,
        label: e.label,
        amount_cents: e.amountCents,
        source: e.source,
        created_at: e.createdAt,
      })),
    );
    if (error) throw error;
  }

  if (store.projectionAssumptions.length) {
    const { error } = await sb.from("projection_assumptions").upsert(
      store.projectionAssumptions.map((a) => ({
        property_id: a.propertyId,
        monthly_rent_cents: a.monthlyRentCents,
        vacancy_rate_pct: a.vacancyRatePct,
        monthly_repairs_cents: a.monthlyRepairsCents,
        monthly_mortgage_cents: a.monthlyMortgageCents,
        monthly_taxes_cents: a.monthlyTaxesCents,
        monthly_insurance_cents: a.monthlyInsuranceCents,
        monthly_pm_fee_cents: a.monthlyPmFeeCents,
        monthly_hoa_cents: a.monthlyHoaCents,
        monthly_utilities_owner_cents: a.monthlyUtilitiesOwnerCents,
        annual_rent_growth_pct: a.annualRentGrowthPct,
        renovation_spend_cents: a.renovationSpendCents,
        renovation_month_offset: a.renovationMonthOffset,
        renovation_rent_uplift_cents: a.renovationRentUpliftCents,
        vacancy_months_on_turnover: a.vacancyMonthsOnTurnover,
      })),
    );
    if (error) throw error;
  }

  const policies =
    store.automationPolicies?.length
      ? store.automationPolicies
      : store.properties.map((p) => ({
          id: `policy-${p.id}`,
          propertyId: p.id,
          name: "Default spend & vendor policy",
          spendThresholdCents: p.ownerApprovalThresholdCents,
          preapprovedCategories: ["Plumbing", "Electrical"],
          emergencyProcess:
            "If emergency flag: notify manager immediately, then owner. AI recommendations never authorize spend.",
          preferredVendorIds: store.vendors.map((v) => v.id),
          escalationContactUserId: p.managerId,
          maxWaitHours: 48,
          enabled: true,
        }));
  if (policies.length) {
    const { error } = await sb.from("automation_policies").upsert(
      policies.map((p) => ({
        id: p.id,
        property_id: p.propertyId,
        name: p.name,
        spend_threshold_cents: p.spendThresholdCents,
        preapproved_categories: p.preapprovedCategories,
        emergency_process: p.emergencyProcess,
        preferred_vendor_ids: p.preferredVendorIds,
        escalation_contact_user_id: p.escalationContactUserId,
        max_wait_hours: p.maxWaitHours,
        enabled: p.enabled,
      })),
    );
    if (error) throw error;
  }

  if (store.documents.length) {
    const { error } = await sb.from("documents").upsert(
      store.documents.map((d) => ({
        id: d.id,
        property_id: d.propertyId,
        work_order_id: d.workOrderId,
        lease_id: d.leaseId,
        title: d.title,
        category: d.category,
        file_name: d.fileName,
        storage_path: null,
        uploaded_by_user_id: d.uploadedByUserId,
        visibility: d.visibility,
        note: d.note,
        created_at: d.createdAt,
      })),
    );
    if (error) throw error;
  }

  if (store.messageThreads.length) {
    const { error } = await sb.from("message_threads").upsert(
      store.messageThreads.map((t) => ({
        id: t.id,
        property_id: t.propertyId,
        work_order_id: t.workOrderId,
        subject: t.subject,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      })),
    );
    if (error) throw error;
    const parts = store.messageThreads.flatMap((t) =>
      t.participantIds.map((userId) => ({
        thread_id: t.id,
        user_id: userId,
      })),
    );
    if (parts.length) {
      const { error: pErr } = await sb.from("message_participants").upsert(parts);
      if (pErr) throw pErr;
    }
  }

  if (store.messages.length) {
    const { error } = await sb.from("messages").upsert(
      store.messages.map((m) => ({
        id: m.id,
        thread_id: m.threadId,
        author_user_id: m.authorUserId,
        body: m.body,
        created_at: m.createdAt,
      })),
    );
    if (error) throw error;
  }

  if (store.notifications.length) {
    const { error } = await sb.from("notifications").upsert(
      store.notifications.map((n) => ({
        id: n.id,
        user_id: n.userId,
        work_order_id: n.workOrderId,
        title: n.title,
        body: n.body,
        read: n.read,
        created_at: n.createdAt,
      })),
    );
    if (error) throw error;
  }

  if (store.activity.length) {
    const { error } = await sb.from("activity_events").upsert(
      store.activity.map((a) => ({
        id: a.id,
        work_order_id: a.workOrderId,
        property_id: a.propertyId,
        actor_user_id: a.actorUserId,
        kind: a.kind,
        message: a.message,
        created_at: a.createdAt,
      })),
    );
    if (error) throw error;
  }

  if (store.paymentRefs?.length) {
    const { error } = await sb.from("payment_refs").upsert(
      store.paymentRefs.map((p) => ({
        id: p.id,
        property_id: p.propertyId,
        lease_id: p.leaseId,
        tenant_user_id: p.tenantUserId || null,
        provider: p.provider,
        external_id: p.externalId,
        amount_cents: p.amountCents,
        status: p.status,
        month: p.month,
        label: p.label,
        metadata: {
          ...p.metadata,
          tenantUserId: p.tenantUserId,
          month: p.month,
          label: p.label,
        },
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      })),
    );
    if (error) console.warn("payment_refs upsert:", error.message);
  }

  if (store.autopayEnrollments?.length) {
    const { error } = await sb.from("autopay_enrollments").upsert(
      store.autopayEnrollments.map((a) => ({
        id: a.id,
        property_id: a.propertyId,
        tenant_user_id: a.tenantUserId,
        enabled: a.enabled,
        provider: a.provider,
        day_of_month: a.dayOfMonth,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      })),
    );
    if (error) console.warn("autopay_enrollments upsert:", error.message);
  }

  await sb.from("audit_logs").insert({
    org_id: ORG_ID,
    actor_user_id: null,
    action: "store.persisted",
    entity_type: "app_store",
    entity_id: ORG_ID,
    payload: { version: store.version, users: store.users.length },
  });
}
