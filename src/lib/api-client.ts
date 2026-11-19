import type {
  ActivityEvent,
  LedgerEntry,
  Notification,
  ProjectionAssumptions,
  Property,
  SessionUser,
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
    policy: { ownerApprovalThresholdCents: number; persistence: string };
    pilotUsers: {
      email: string;
      name: string;
      role: string;
      passwordHint: string;
    }[];
  }>("/api/auth/me");
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
