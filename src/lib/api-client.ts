import type {
  ActivityEvent,
  AssetRecord,
  AutopayEnrollment,
  AutomationPolicy,
  DocumentRecord,
  IntakeAnswers,
  IntakeAudit,
  IntakeClassification,
  LedgerEntry,
  Lease,
  Message,
  MessageThread,
  Notification,
  OwnerStatement,
  PaymentRef,
  ProjectionAssumptions,
  Property,
  RenovationChangeOrder,
  RenovationProject,
  Role,
  SessionUser,
  TurnoverChecklist,
  TurnoverChecklistItem,
  Unit,
  Urgency,
  Vendor,
  VerifiedFaq,
  WorkOrder,
} from "./types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function fetchMe() {
  return api<{
    user: (SessionUser & { mfaEnabled?: boolean }) | null;
    property: Property | null;
    properties?: Property[];
    orgs?: { id: string; name: string; slug: string }[];
    theme?: {
      orgId: string;
      brandName: string;
      logoText: string;
      tagline: string;
      primaryColor: string;
      accentColor: string;
      surfaceColor: string;
      mark: string;
    } | null;
    policy: {
      ownerApprovalThresholdCents: number;
      persistence: string;
      auth?: string;
      jobQueue?: string;
      documentStorage?: string;
    };
    pilotUsers: {
      email: string;
      name: string;
      role: string;
      passwordHint: string;
      orgIds?: string[];
    }[];
  }>("/api/auth/me");
}

export function fetchSystemStatus() {
  return api<{
    persistence: string;
    persistenceLabel: string;
    supabaseConfigured: boolean;
    allowDemoLogin: boolean;
    auth: string;
    jobQueue: string;
    documentStorage: string;
    productionQueueNote: string;
    recentJobs: { id: string; kind: string; status: string }[];
  }>("/api/system/status");
}

export function enqueuePilotJob(kind: string, payload?: Record<string, unknown>) {
  return api<{ job: { id: string; kind: string; status: string } }>("/api/jobs", {
    method: "POST",
    body: JSON.stringify({ action: "enqueue", kind, payload }),
  });
}

export function drainPilotJobs() {
  return api<{ processed: number }>("/api/jobs", {
    method: "POST",
    body: JSON.stringify({ action: "drain" }),
  });
}

export function login(email: string, password: string) {
  return api<{ user: SessionUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export function fetchWorkOrders() {
  return api<{
    workOrders: WorkOrder[];
    vendors: Vendor[];
    activity: ActivityEvent[];
  }>("/api/work-orders");
}

export function createWorkOrder(input: {
  propertyId: string;
  title: string;
  details: string;
  urgency: Urgency;
  category?: string;
}) {
  return api<{ workOrder: WorkOrder }>("/api/work-orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchWorkOrder(
  id: string,
  body: Record<string, unknown>,
) {
  return api<{ workOrder: WorkOrder }>(`/api/work-orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function fetchNotifications() {
  return api<{ notifications: Notification[] }>("/api/notifications");
}

export function markNotificationsRead() {
  return api<{ ok: boolean }>("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ markAllRead: true }),
  });
}

export function resetPilotData() {
  return api<{ ok: boolean }>("/api/admin/reset", { method: "POST" });
}

export function fetchFinancials(params: {
  propertyId: string;
  month?: string;
  horizon?: "12m" | "36m" | "60m";
}) {
  const q = new URLSearchParams({
    propertyId: params.propertyId,
    month: params.month || "2026-11",
    horizon: params.horizon || "12m",
  });
  return api<{
    property: Property;
    month: string;
    horizon: string;
    snapshot: {
      month: string;
      entries: LedgerEntry[];
      actual: {
        rent: number;
        operatingExpenses: number;
        noi: number;
        mortgage: number;
        cashFlow: number;
        renovation: number;
      };
      forecast: {
        rent: number;
        operatingExpenses: number;
        noi: number;
        mortgage: number;
        cashFlow: number;
      };
      labels: { dataQuality: string; noi: string; cashFlow: string };
    };
    assumptions: ProjectionAssumptions;
    projection: {
      months: {
        month: string;
        rent: number;
        operatingExpenses: number;
        noi: number;
        mortgage: number;
        cashFlow: number;
        renovationSpend: number;
      }[];
      totals: {
        rent: number;
        operatingExpenses: number;
        noi: number;
        mortgage: number;
        cashFlow: number;
        renovationSpend: number;
      };
      insights: {
        renovationRoiLabel: string;
        renovationPaybackMonths: number | null;
        vacancyCostCents: number;
        vacancyCostLabel: string;
        disclaimer: string;
      };
    };
    pendingApprovals: WorkOrder[];
    disclaimer: string;
  }>(`/api/financials?${q.toString()}`);
}

export function patchAssumptions(
  propertyId: string,
  assumptions: Partial<ProjectionAssumptions>,
) {
  return api<{ assumptions: ProjectionAssumptions }>("/api/financials", {
    method: "PATCH",
    body: JSON.stringify({ propertyId, assumptions }),
  });
}

export function postLedgerEntry(input: {
  propertyId: string;
  month: string;
  category: LedgerEntry["category"];
  label: string;
  amountCents: number;
}) {
  return api<{ entry: LedgerEntry }>("/api/financials", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function moneyFromCents(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function fetchRecords() {
  return api<{
    properties: Property[];
    units: Unit[];
    leases: Lease[];
    documents: DocumentRecord[];
    activity: ActivityEvent[];
    people: { id: string; name: string; role: Role; email: string }[];
    canEdit: boolean;
  }>("/api/records");
}

export function patchRecord(
  entity: "property" | "unit" | "lease",
  id: string,
  patch: Record<string, unknown>,
) {
  return api<{ entity: string; record: Property | Unit | Lease }>(
    "/api/records",
    {
      method: "PATCH",
      body: JSON.stringify({ entity, id, patch }),
    },
  );
}

export function fetchDocuments() {
  return api<{ documents: DocumentRecord[] }>("/api/documents");
}

export function postDocument(input: {
  propertyId: string;
  title: string;
  category: DocumentRecord["category"];
  fileName?: string;
  note?: string;
  workOrderId?: string | null;
  leaseId?: string | null;
  visibility?: Role[];
}) {
  return api<{ document: DocumentRecord }>("/api/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchMessages(params?: {
  threadId?: string;
  workOrderId?: string;
}) {
  const q = new URLSearchParams();
  if (params?.threadId) q.set("threadId", params.threadId);
  if (params?.workOrderId) q.set("workOrderId", params.workOrderId);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return api<{
    threads: MessageThread[];
    thread?: MessageThread | null;
    messages?: Message[];
    people?: { id: string; name: string; role: Role }[];
  }>(`/api/messages${suffix}`);
}

export function postMessageReply(threadId: string, body: string) {
  return api<{ thread: MessageThread; message: Message }>("/api/messages", {
    method: "POST",
    body: JSON.stringify({ action: "reply", threadId, body }),
  });
}

export function createMessageThread(input: {
  propertyId: string;
  subject: string;
  body: string;
  workOrderId?: string | null;
}) {
  return api<{ thread: MessageThread; message: Message }>("/api/messages", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...input }),
  });
}

export function ledgerSourceLabel(source: LedgerEntry["source"]) {
  if (source === "verified") return "Bank-verified";
  if (source === "manual") return "Manual entry · not bank-verified";
  return "Illustrative · not bank-verified";
}

export function previewIntake(answers: IntakeAnswers) {
  return api<{
    classification: IntakeClassification;
    trace: { step: string; detail: string }[];
    hardRule: string;
  }>("/api/intake", {
    method: "PUT",
    body: JSON.stringify({ answers }),
  });
}

export function submitIntake(input: {
  propertyId: string;
  answers: IntakeAnswers;
}) {
  return api<{
    workOrder: WorkOrder;
    audit: IntakeAudit;
    classification?: IntakeClassification;
  }>("/api/intake", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchIntakeAudit(params: {
  auditId?: string;
  workOrderId?: string;
}) {
  const q = new URLSearchParams();
  if (params.auditId) q.set("auditId", params.auditId);
  if (params.workOrderId) q.set("workOrderId", params.workOrderId);
  return api<{ audit: IntakeAudit | null; audits?: IntakeAudit[] }>(
    `/api/intake?${q.toString()}`,
  );
}

export function fetchPolicies(propertyId: string) {
  return api<{
    policy: AutomationPolicy;
    vendors: Vendor[];
    preferredVendors: Vendor[];
    people: { id: string; name: string; role: Role }[];
    canEdit: boolean;
    hardRule: string;
  }>(`/api/policies?propertyId=${encodeURIComponent(propertyId)}`);
}

export function patchPolicy(
  propertyId: string,
  patch: Partial<AutomationPolicy>,
) {
  return api<{ policy: AutomationPolicy; hardRule: string }>("/api/policies", {
    method: "PATCH",
    body: JSON.stringify({ propertyId, patch }),
  });
}

export function fetchPayments() {
  return api<{
    payments: PaymentRef[];
    autopay: AutopayEnrollment[];
    mode: "demo" | "stripe";
    stripeConfigured: boolean;
  }>("/api/payments");
}

export function startRentCheckout(input: {
  propertyId: string;
  month: string;
  amountCents: number;
  origin?: string;
}) {
  return api<{
    mode: "demo" | "stripe";
    paymentId: string;
    url: string | null;
    sessionId?: string;
    label?: string;
  }>("/api/payments", {
    method: "POST",
    body: JSON.stringify({ action: "checkout", ...input }),
  });
}

export function completeDemoCheckout(paymentId: string) {
  return api<{
    payment: PaymentRef;
    mode: string;
    label: string;
  }>("/api/payments", {
    method: "POST",
    body: JSON.stringify({ action: "demo_complete", paymentId }),
  });
}

export function setAutopayEnrollment(input: {
  propertyId: string;
  enabled: boolean;
  dayOfMonth?: number;
}) {
  return api<{ enrollment: AutopayEnrollment; note: string }>("/api/payments", {
    method: "POST",
    body: JSON.stringify({ action: "autopay", ...input }),
  });
}

export function askFaq(text: string) {
  return api<{
    kind: "faq" | "escalated" | "unmatched";
    faq: VerifiedFaq | null;
    reply: string;
    reasons: string[];
  }>("/api/comms/faq", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function fetchVerifiedFaqs() {
  return api<{ faqs: VerifiedFaq[] }>("/api/comms/faq");
}

export function fetchReports(propertyId: string) {
  return api<{
    property: Property;
    statements: OwnerStatement[];
    summary: {
      byMonth: Record<
        string,
        { expensesCents: number; maintenanceCents: number; rentCents: number }
      >;
      workOrders: WorkOrder[];
      entryCount: number;
    };
    months: string[];
  }>(`/api/reports?propertyId=${encodeURIComponent(propertyId)}`);
}

export function generateOwnerStatement(input: {
  propertyId: string;
  month: string;
  viaJob?: boolean;
}) {
  return api<{ statement: OwnerStatement; job?: { id: string } }>(
    "/api/reports",
    {
      method: "POST",
      body: JSON.stringify({
        action: input.viaJob ? "enqueue_monthly" : "generate",
        propertyId: input.propertyId,
        month: input.month,
      }),
    },
  );
}

export function fetchRenovation(propertyId: string) {
  return api<{
    property: Property;
    projects: RenovationProject[];
    turnovers: TurnoverChecklist[];
    assets: AssetRecord[];
    vacancyInsight: {
      vacancyMonths: number;
      lostRentCents: number;
      carryingCostCents: number;
      totalVacancyCostCents: number;
      label: string;
    };
    canDrive: boolean;
    role: Role;
  }>(`/api/renovation?propertyId=${encodeURIComponent(propertyId)}`);
}

export function decideRenoProject(
  projectId: string,
  decision: "approved" | "declined",
  note?: string,
) {
  return api<{ project: RenovationProject }>("/api/renovation", {
    method: "POST",
    body: JSON.stringify({
      action: "decide_project",
      projectId,
      decision,
      note,
    }),
  });
}

export function postRenoProgress(
  projectId: string,
  patch: {
    status?: RenovationProject["status"];
    spentCents?: number;
    progressPct?: number;
  },
) {
  return api<{ project: RenovationProject }>("/api/renovation", {
    method: "POST",
    body: JSON.stringify({ action: "progress", projectId, ...patch }),
  });
}

export function proposeChangeOrder(
  projectId: string,
  input: { title: string; amountCents: number; note?: string },
) {
  return api<{ changeOrder: RenovationChangeOrder }>("/api/renovation", {
    method: "POST",
    body: JSON.stringify({ action: "change_order", projectId, ...input }),
  });
}

export function decideChangeOrder(
  projectId: string,
  changeOrderId: string,
  decision: "approved" | "declined",
) {
  return api<{
    project: RenovationProject;
    changeOrder: RenovationChangeOrder;
  }>("/api/renovation", {
    method: "POST",
    body: JSON.stringify({
      action: "decide_change_order",
      projectId,
      changeOrderId,
      decision,
    }),
  });
}

export function patchTurnoverItem(
  checklistId: string,
  items: TurnoverChecklistItem[],
) {
  return api<{ checklist: TurnoverChecklist }>("/api/renovation", {
    method: "POST",
    body: JSON.stringify({
      action: "patch_turnover",
      checklistId,
      items,
    }),
  });
}

export function fetchCommercial(orgId: string) {
  return api<{
    org: { id: string; name: string; slug: string } | null;
    orgs: { id: string; name: string; slug: string }[];
    memberships: {
      id: string;
      userId: string;
      role: string;
      userName: string;
      userEmail: string;
    }[];
    properties: Property[];
    subscription: {
      id: string;
      plan: string;
      status: string;
      provider: string;
      unitAmountCents: number;
      currentPeriodEnd: string;
    } | null;
    invoices: {
      id: string;
      amountCents: number;
      status: string;
      label: string;
      demo: boolean;
      issuedAt: string;
    }[];
    theme: {
      orgId: string;
      brandName: string;
      logoText: string;
      tagline: string;
      primaryColor: string;
      accentColor: string;
      surfaceColor: string;
      mark: string;
    } | null;
    vendors: Vendor[];
    portfolio: {
      propertyCount: number;
      occupiedCount: number;
      totals: {
        rent: number;
        noi: number;
        cashFlow: number;
        renovationSpend: number;
      };
      perProperty: {
        propertyId: string;
        name: string;
        occupancy: string;
        monthlyRentCents: number;
      }[];
    };
    benchmark: {
      metrics: {
        avgRentCents: number;
        avgCashFlowCents: number;
        occupancyPct: number;
        maintenancePerDoorCents: number;
        peerAvgRentCents: number;
        peerOccupancyPct: number;
        peerMaintenancePerDoorCents: number;
      };
      notes: string;
    };
    accounting: {
      id: string;
      externalRef: string;
      label: string;
      amountCents: number;
      status: string;
      matchedLedgerId: string | null;
    }[];
    monitoring: {
      id: string;
      level: string;
      source: string;
      message: string;
      createdAt: string;
    }[];
    billingMode: string;
    session: { orgId?: string | null; mfaVerified: boolean };
  }>(`/api/commercial?orgId=${encodeURIComponent(orgId)}`);
}

export function switchActiveOrg(orgId: string) {
  return api<{ user: SessionUser }>("/api/auth/org", {
    method: "POST",
    body: JSON.stringify({ orgId }),
  });
}

export function verifyMfa(code: string) {
  return api<{ user: SessionUser; ok: boolean }>("/api/auth/mfa", {
    method: "POST",
    body: JSON.stringify({ action: "verify", code }),
  });
}

export function toggleMfa(enabled: boolean) {
  return api<{ mfaEnabled: boolean }>("/api/auth/mfa", {
    method: "POST",
    body: JSON.stringify({ action: "toggle", enabled }),
  });
}

export function updateSaasPlan(orgId: string, plan: string) {
  return api<{
    subscription: { plan: string; provider: string };
    invoice: { label: string; demo: boolean; amountCents: number };
  }>("/api/commercial", {
    method: "POST",
    body: JSON.stringify({ action: "subscribe", orgId, plan }),
  });
}

export function saveWhiteLabel(
  orgId: string,
  theme: Record<string, string>,
) {
  return api<{ theme: Record<string, string> }>("/api/commercial", {
    method: "POST",
    body: JSON.stringify({ action: "theme", orgId, theme }),
  });
}

export function importAccountingCsv(orgId: string, csv: string) {
  return api<{ lines: { id: string; status: string }[] }>("/api/commercial", {
    method: "POST",
    body: JSON.stringify({ action: "accounting_import", orgId, csv }),
  });
}
