import type {
  ActivityEvent,
  DocumentRecord,
  IntakeAnswers,
  IntakeAudit,
  IntakeClassification,
  LedgerEntry,
  Lease,
  Message,
  MessageThread,
  Notification,
  ProjectionAssumptions,
  Property,
  Role,
  SessionUser,
  Unit,
  Urgency,
  Vendor,
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
    user: SessionUser | null;
    property: Property | null;
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
