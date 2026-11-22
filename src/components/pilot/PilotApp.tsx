"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  drainPilotJobs,
  enqueuePilotJob,
  fetchIntakeAudit,
  fetchMe,
  fetchNotifications,
  fetchSystemStatus,
  fetchWorkOrders,
  login,
  logout,
  markNotificationsRead,
  moneyFromCents,
  patchWorkOrder,
  resetPilotData,
} from "@/lib/api-client";
import type {
  ActivityEvent,
  IntakeAudit,
  Notification,
  Property,
  SessionUser,
  Vendor,
  WorkOrder,
} from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";
import OwnerFinancials from "@/components/pilot/OwnerFinancials";
import PropertyRecords from "@/components/pilot/PropertyRecords";
import DocumentsActivity from "@/components/pilot/DocumentsActivity";
import MessagesPanel from "@/components/pilot/MessagesPanel";
import MaintenanceIntake from "@/components/pilot/MaintenanceIntake";
import PolicyVendors from "@/components/pilot/PolicyVendors";
import TenantPayments from "@/components/pilot/TenantPayments";
import OwnerReportsReno from "@/components/pilot/OwnerReportsReno";
import CommercialPlatform from "@/components/pilot/CommercialPlatform";

type Toast = string | null;
type PilotView =
  | "home"
  | "new"
  | "detail"
  | "financials"
  | "records"
  | "documents"
  | "messages"
  | "policies"
  | "payments"
  | "reports"
  | "commercial";

type ThemeState = {
  orgId: string;
  brandName: string;
  logoText: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  mark: string;
} | null;

export default function PilotApp() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<(SessionUser & { mfaEnabled?: boolean }) | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [theme, setTheme] = useState<ThemeState>(null);
  const [threshold, setThreshold] = useState(20000);
  const [persistence, setPersistence] = useState("local-json");
  const [authMode, setAuthMode] = useState("cookie-demo");
  const [pilotUsers, setPilotUsers] = useState<
    {
      email: string;
      name: string;
      role: string;
      passwordHint: string;
      orgIds?: string[];
    }[]
  >([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageWorkOrderId, setMessageWorkOrderId] = useState<string | null>(
    null,
  );
  const [view, setView] = useState<PilotView>("home");
  const [toast, setToast] = useState<Toast>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [me, sys] = await Promise.all([
      fetchMe(),
      fetchSystemStatus().catch(() => null),
    ]);
    setUser(me.user);
    setProperty(me.property);
    setProperties(me.properties || (me.property ? [me.property] : []));
    setTheme(me.theme || null);
    setThreshold(me.policy?.ownerApprovalThresholdCents ?? 20000);
    setPersistence(
      sys?.persistenceLabel || me.policy?.persistence || "local-json",
    );
    setAuthMode(sys?.auth || me.policy?.auth || "cookie-demo");
    setPilotUsers(me.pilotUsers ?? []);
    if (!me.user) {
      setWorkOrders([]);
      setNotifications([]);
      setActivity([]);
      setLoading(false);
      return;
    }
    const [wo, notif] = await Promise.all([
      fetchWorkOrders(),
      fetchNotifications(),
    ]);
    setWorkOrders(wo.workOrders);
    setVendors(wo.vendors);
    setActivity(wo.activity);
    setNotifications(notif.notifications);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const selected = useMemo(
    () => workOrders.find((w) => w.id === selectedId) || null,
    [workOrders, selectedId],
  );

  const unread = notifications.filter((n) => !n.read).length;

  async function handleLogin(email: string) {
    setError(null);
    try {
      await login(email, "pilot");
      setView("home");
      setSelectedId(null);
      await refresh();
      setToast(`Signed in as ${email}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setView("home");
    setSelectedId(null);
    await refresh();
  }

  async function handleReset() {
    try {
      await resetPilotData();
      setSelectedId(null);
      setView("home");
      await refresh();
      setToast("Pilot data reset to seed story");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading PropertMax pilot…
      </main>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        pilotUsers={pilotUsers}
        threshold={threshold}
        persistence={persistence}
        authMode={authMode}
        error={error}
        onLogin={handleLogin}
      />
    );
  }

  const brandStyle = theme
    ? ({
        ["--accent" as string]: theme.primaryColor,
        ["--accent-deep" as string]: theme.accentColor,
        ["--accent-soft" as string]: theme.surfaceColor,
        ["--demo-banner" as string]: theme.accentColor,
      } as CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen" style={brandStyle}>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--demo-banner)] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="min-w-0">
            <p className="display text-sm font-semibold tracking-tight">
              {theme?.logoText || "PropertMax"}
            </p>
            <p className="truncate text-xs text-white/55">
              Phase 3 · {theme?.brandName || "commercial"} · {persistence}
              {user.orgId ? ` · ${user.orgId}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NavChip onClick={() => setView("home")}>Home</NavChip>
            <NavChip onClick={() => setView("records")}>Records</NavChip>
            <NavChip onClick={() => setView("documents")}>Docs</NavChip>
            {user.role === "tenant" && (
              <NavChip onClick={() => setView("payments")}>Payments</NavChip>
            )}
            <NavChip
              onClick={() => {
                setMessageWorkOrderId(null);
                setView("messages");
              }}
            >
              Messages
            </NavChip>
            {(user.role === "manager" || user.role === "owner") && (
              <NavChip onClick={() => setView("policies")}>Policies</NavChip>
            )}
            {(user.role === "owner" || user.role === "manager") && (
              <NavChip onClick={() => setView("financials")}>
                Financials
              </NavChip>
            )}
            {(user.role === "owner" || user.role === "manager") && (
              <NavChip onClick={() => setView("reports")}>
                Reports / Reno
              </NavChip>
            )}
            {(user.role === "owner" || user.role === "manager") && (
              <NavChip onClick={() => setView("commercial")}>
                Commercial
              </NavChip>
            )}
            <StatusChip tone="accent">
              {user.role} · {user.name}
            </StatusChip>
            {unread > 0 && (
              <button
                type="button"
                className="rounded-full bg-[var(--warn)] px-2.5 py-1 text-xs font-semibold text-white"
                onClick={() => markNotificationsRead().then(refresh)}
              >
                {unread} new
              </button>
            )}
            <Button
              variant="secondary"
              className="!bg-white/10 !text-white !border-white/20"
              onClick={handleReset}
            >
              Reset data
            </Button>
            <button
              type="button"
              className="text-xs text-white/65 hover:text-white"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {error && (
          <p className="mb-4 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {view === "home" && (
          <RoleHome
            user={user}
            property={property}
            workOrders={workOrders}
            notifications={notifications}
            activity={activity}
            threshold={threshold}
            persistence={persistence}
            authMode={authMode}
            onOpen={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
            onNew={() => setView("new")}
            onFinancials={() => setView("financials")}
            onRecords={() => setView("records")}
            onDocuments={() => setView("documents")}
            onMessages={() => {
              setMessageWorkOrderId(null);
              setView("messages");
            }}
            onPolicies={() => setView("policies")}
            onPayments={() => setView("payments")}
            onReports={() => setView("reports")}
            onCommercial={() => setView("commercial")}
            onToast={setToast}
            onError={setError}
          />
        )}

        {view === "commercial" &&
          (user.role === "owner" || user.role === "manager") && (
            <CommercialPlatform
              user={user}
              orgId={user.orgId || "org-pilot"}
              onBack={() => setView("home")}
              onToast={setToast}
              onError={setError}
              onOrgChanged={() => {
                void refresh();
              }}
            />
          )}

        {view === "reports" &&
          property &&
          (user.role === "owner" || user.role === "manager") && (
            <OwnerReportsReno
              user={user}
              propertyId={property.id}
              onBack={() => setView("home")}
              onToast={setToast}
              onError={setError}
            />
          )}

        {view === "payments" && property && user.role === "tenant" && (
          <TenantPayments
            user={user}
            property={property}
            onBack={() => setView("home")}
            onToast={setToast}
            onError={setError}
          />
        )}

        {view === "policies" && property && (
          <PolicyVendors
            user={user}
            propertyId={property.id}
            onBack={() => setView("home")}
            onToast={setToast}
            onError={setError}
          />
        )}

        {view === "financials" && property && (
          <OwnerFinancials
            property={property}
            onBack={() => setView("home")}
            onOpenWorkOrder={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
            onToast={setToast}
            onError={setError}
          />
        )}

        {view === "records" && (
          <PropertyRecords
            user={user}
            onBack={() => setView("home")}
            onToast={setToast}
            onError={setError}
          />
        )}

        {view === "documents" && property && (
          <DocumentsActivity
            user={user}
            propertyId={property.id}
            onBack={() => setView("home")}
            onToast={setToast}
            onError={setError}
          />
        )}

        {view === "messages" && property && (
          <MessagesPanel
            user={user}
            propertyId={property.id}
            initialWorkOrderId={messageWorkOrderId}
            onBack={() => setView("home")}
            onToast={setToast}
            onError={setError}
          />
        )}

        {view === "new" && property && (
          <MaintenanceIntake
            property={property}
            onCancel={() => setView("home")}
            onCreated={async (id) => {
              await refresh();
              setSelectedId(id);
              setView("detail");
              setToast("Intake classified · work order created (no spend authorized)");
            }}
          />
        )}

        {view === "detail" && selected && property && (
          <WorkOrderDetail
            user={user}
            property={property}
            workOrder={selected}
            vendors={vendors}
            activity={activity.filter((a) => a.workOrderId === selected.id)}
            threshold={threshold}
            onBack={() => {
              setView("home");
              setSelectedId(null);
            }}
            onOpenMessages={() => {
              setMessageWorkOrderId(selected.id);
              setView("messages");
            }}
            onChanged={async (msg) => {
              await refresh();
              setToast(msg);
            }}
            onError={(msg) => setError(msg)}
          />
        )}
      </div>

      {toast && (
        <div className="toast fixed bottom-5 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-lift)]">
          {toast}
        </div>
      )}
    </div>
  );
}

function LoginScreen({
  pilotUsers,
  threshold,
  persistence,
  authMode,
  error,
  onLogin,
}: {
  pilotUsers: { email: string; name: string; role: string; passwordHint: string }[];
  threshold: number;
  persistence: string;
  authMode: string;
  error: string | null;
  onLogin: (email: string) => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-12">
      <p className="display text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
        PropertMax
      </p>
      <p className="mt-2 max-w-xl text-[var(--muted)]">
        Phase 3 commercial — multi-org, SaaS demo billing, portfolios, white-label.
        Local-json
        fallback. Password for all sample users: <strong>pilot</strong>. Owner
        approval required over {moneyFromCents(threshold)}.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Persistence: <strong>{persistence}</strong> · Auth: {authMode}. Without
        Supabase env vars the app stays on local JSON so builds work offline.
      </p>
      {error && (
        <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
      )}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {pilotUsers.map((u) => (
          <button
            key={u.email}
            type="button"
            onClick={() => onLogin(u.email)}
            className="panel px-4 py-4 text-left transition hover:border-[var(--accent)]/40"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {u.role}
            </p>
            <p className="display mt-1 text-lg font-semibold">{u.name}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{u.email}</p>
          </button>
        ))}
      </div>
      <p className="mt-8 text-sm text-[var(--muted)]">
        Prefer the clickable Sites prototype?{" "}
        <a className="font-semibold text-[var(--accent)]" href="/sites-demo">
          Open Sites demo →
        </a>
      </p>
    </main>
  );
}

function NavChip({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RoleHome({
  user,
  property,
  workOrders,
  notifications,
  activity,
  threshold,
  persistence,
  authMode,
  onOpen,
  onNew,
  onFinancials,
  onRecords,
  onDocuments,
  onMessages,
  onPolicies,
  onPayments,
  onReports,
  onCommercial,
  onToast,
  onError,
}: {
  user: SessionUser;
  property: Property | null;
  workOrders: WorkOrder[];
  notifications: Notification[];
  activity: ActivityEvent[];
  threshold: number;
  persistence: string;
  authMode: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onFinancials: () => void;
  onRecords: () => void;
  onDocuments: () => void;
  onMessages: () => void;
  onPolicies: () => void;
  onPayments: () => void;
  onReports: () => void;
  onCommercial: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const attention = workOrders.filter((w) => {
    if (user.role === "owner")
      return w.status === "awaiting_owner_approval";
    if (user.role === "manager")
      return [
        "reported",
        "under_review",
        "awaiting_estimate",
        "approved",
        "awaiting_owner_approval",
      ].includes(w.status);
    if (user.role === "contractor")
      return [
        "awaiting_estimate",
        "assigned",
        "scheduled",
        "in_progress",
      ].includes(w.status);
    return true;
  });

  return (
    <div className="space-y-5 fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>
            {user.name} · {user.role}
          </SectionLabel>
          <h1 className="display mt-1 text-3xl font-semibold">
            {user.role === "contractor"
              ? "Your jobs"
              : user.role === "manager"
                ? "Needs your attention"
                : user.role === "owner"
                  ? "Approvals & maintenance"
                  : "Your home"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {property?.address} · threshold {moneyFromCents(threshold)}{" "}
            <span className="text-[var(--warn)]">(illustrative policy)</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRecords}>
            Records
          </Button>
          <Button variant="secondary" onClick={onDocuments}>
            Docs & activity
          </Button>
          <Button variant="secondary" onClick={onMessages}>
            Messages
          </Button>
          {(user.role === "manager" || user.role === "owner") && (
            <Button variant="secondary" onClick={onPolicies}>
              Policies & vendors
            </Button>
          )}
          {(user.role === "owner" || user.role === "manager") && (
            <Button onClick={onFinancials}>Open financials</Button>
          )}
          {(user.role === "owner" || user.role === "manager") && (
            <Button variant="secondary" onClick={onReports}>
              Reports / reno
            </Button>
          )}
          {(user.role === "owner" || user.role === "manager") && (
            <Button variant="secondary" onClick={onCommercial}>
              Commercial platform
            </Button>
          )}
          {(user.role === "tenant" || user.role === "manager") && (
            <Button onClick={onNew}>Request repair</Button>
          )}
        </div>
      </header>

      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionLabel>Phase 2 foundation</SectionLabel>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Persistence <strong>{persistence}</strong> · Auth {authMode}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Supabase Postgres + RLS + Storage + job queue when env is set;
              otherwise local JSON demo mode (no secrets required).
            </p>
          </div>
          <StatusChip
            tone={persistence.includes("supabase") ? "positive" : "neutral"}
          >
            {persistence}
          </StatusChip>
        </div>
        {user.role === "manager" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await enqueuePilotJob("reminder.rent", {
                    propertyId: property?.id,
                  });
                  onToast("Queued rent reminder job");
                } catch (e) {
                  onError(e instanceof Error ? e.message : "Enqueue failed");
                }
              }}
            >
              Enqueue rent reminder
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await enqueuePilotJob("reminder.lease_expiry", {
                    propertyId: property?.id,
                  });
                  onToast("Queued lease renewal reminder");
                } catch (e) {
                  onError(e instanceof Error ? e.message : "Enqueue failed");
                }
              }}
            >
              Enqueue lease renewal
            </Button>
            <Button
              variant="soft"
              onClick={async () => {
                try {
                  const res = await drainPilotJobs();
                  onToast(`Processed ${res.processed} due job(s)`);
                } catch (e) {
                  onError(e instanceof Error ? e.message : "Drain failed");
                }
              }}
            >
              Drain job queue
            </Button>
          </div>
        )}
      </section>

      {user.role === "owner" && property && (
        <button
          type="button"
          onClick={onFinancials}
          className="panel flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:border-[var(--accent)]/30"
        >
          <div>
            <SectionLabel>Investment snapshot</SectionLabel>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Rent {moneyFromCents(property.monthlyRent * 100)} · estimated
              monthly cash flow after ops + mortgage · projections & renovation
              ROI
            </p>
          </div>
          <span className="text-sm font-semibold text-[var(--accent)]">
            Open →
          </span>
        </button>
      )}

      {user.role === "tenant" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={onPayments}
            className="panel px-4 py-4 text-left transition hover:border-[var(--accent)]/40"
          >
            <p className="display text-lg font-semibold">Pay Rent</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Hosted checkout ·{" "}
              {moneyFromCents((property?.monthlyRent || 0) * 100)} · cards never
              stored
            </p>
          </button>
          <button
            type="button"
            onClick={onNew}
            className="rounded-[var(--radius)] border border-transparent bg-[var(--accent)] px-4 py-4 text-left text-white shadow-[var(--shadow-soft)]"
          >
            <p className="display text-lg font-semibold">Request Repair</p>
            <p className="mt-1 text-sm text-white/85">
              Guided AI intake → structured work order
            </p>
          </button>
          <button
            type="button"
            onClick={onMessages}
            className="panel px-4 py-4 text-left transition hover:border-[var(--accent)]/40"
          >
            <p className="display text-lg font-semibold">Message</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Property & work-order threads
            </p>
          </button>
        </div>
      )}

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="display text-lg font-semibold">Work orders</h2>
          <p className="text-sm text-[var(--muted)]">
            {attention.length} relevant · server-enforced RBAC
          </p>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {attention.length === 0 && (
            <li className="px-5 py-6 text-sm text-[var(--muted)]">
              Nothing in your queue.
            </li>
          )}
          {attention.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--surface-2)]"
                onClick={() => onOpen(w.id)}
              >
                <span>
                  <span className="block text-sm font-semibold">{w.title}</span>
                  <span className="mt-0.5 block text-sm text-[var(--muted)]">
                    {w.category} · {w.urgency}
                    {w.estimateCents != null
                      ? ` · ${moneyFromCents(w.estimateCents)}`
                      : ""}
                  </span>
                </span>
                <StatusChip
                  tone={
                    w.status === "awaiting_owner_approval"
                      ? "warn"
                      : w.status === "completed" || w.status === "approved"
                        ? "positive"
                        : "accent"
                  }
                >
                  {STATUS_LABELS[w.status]}
                </StatusChip>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <SectionLabel>Notifications</SectionLabel>
          <ul className="mt-3 space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <li
                key={n.id}
                className={`rounded-xl px-3 py-2 text-sm ${n.read ? "bg-[var(--surface-2)]" : "bg-[var(--accent-soft)]"}`}
              >
                <p className="font-semibold">{n.title}</p>
                <p className="text-[var(--muted)]">{n.body}</p>
              </li>
            ))}
            {notifications.length === 0 && (
              <li className="text-sm text-[var(--muted)]">No notifications.</li>
            )}
          </ul>
        </section>
        <section className="panel p-5">
          <SectionLabel>Activity history</SectionLabel>
          <ul className="mt-3 space-y-2">
            {activity.slice(0, 6).map((a) => (
              <li key={a.id} className="text-sm">
                <p className="text-[var(--ink-soft)]">{a.message}</p>
                <p className="text-xs text-[var(--muted)]">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function WorkOrderDetail({
  user,
  property,
  workOrder,
  vendors,
  activity,
  threshold,
  onBack,
  onOpenMessages,
  onChanged,
  onError,
}: {
  user: SessionUser;
  property: Property;
  workOrder: WorkOrder;
  vendors: Vendor[];
  activity: ActivityEvent[];
  threshold: number;
  onBack: () => void;
  onOpenMessages: () => void;
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [estimateDollars, setEstimateDollars] = useState("425");
  const [estimateNotes, setEstimateNotes] = useState(
    "Parts + labor. Illustrative quote.",
  );
  const [vendorId, setVendorId] = useState(vendors[0]?.id || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [intakeAudit, setIntakeAudit] = useState<IntakeAudit | null>(null);

  useEffect(() => {
    if (!workOrder.intakeAuditId && !workOrder.id) return;
    fetchIntakeAudit({
      auditId: workOrder.intakeAuditId || undefined,
      workOrderId: workOrder.id,
    })
      .then((res) => setIntakeAudit(res.audit))
      .catch(() => setIntakeAudit(null));
  }, [workOrder.id, workOrder.intakeAuditId]);

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true);
    try {
      await action();
      onChanged(okMsg);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in space-y-5">
      <button
        type="button"
        className="text-sm font-medium text-[var(--accent)]"
        onClick={onBack}
      >
        ← Back to queue
      </button>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>{property.name}</SectionLabel>
          <h1 className="display mt-1 text-3xl font-semibold">
            {workOrder.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {workOrder.details}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onOpenMessages}>
            Open message thread
          </Button>
          {workOrder.emergencyFlag && (
            <StatusChip tone="warn">Emergency flag</StatusChip>
          )}
          <StatusChip
            tone={
              workOrder.status === "awaiting_owner_approval" ? "warn" : "accent"
            }
          >
            {STATUS_LABELS[workOrder.status]}
          </StatusChip>
        </div>
      </header>

      {intakeAudit && (
        <section className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Intake classification audit</SectionLabel>
            <StatusChip tone="warn">
              spendAuthorized = {String(intakeAudit.classification.spendAuthorized)}
            </StatusChip>
          </div>
          <p className="text-sm text-[var(--ink-soft)]">
            {intakeAudit.classification.category} ·{" "}
            {intakeAudit.classification.urgency} ·{" "}
            {intakeAudit.classification.engine} ·{" "}
            {Math.round(intakeAudit.classification.confidence * 100)}% confidence
          </p>
          <ol className="space-y-2 text-sm">
            {intakeAudit.trace.map((t, i) => (
              <li key={`${t.step}-${i}`}>
                <span className="font-semibold text-[var(--muted)]">
                  {t.step}:
                </span>{" "}
                {t.detail}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="panel space-y-4 p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Category</dt>
              <dd className="font-medium">{workOrder.category}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Urgency</dt>
              <dd className="font-medium capitalize">{workOrder.urgency}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Estimate</dt>
              <dd className="money text-lg font-semibold">
                {moneyFromCents(workOrder.estimateCents)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Owner approval?</dt>
              <dd className="font-medium">
                {workOrder.requiresOwnerApproval
                  ? `Yes (over ${moneyFromCents(threshold)})`
                  : workOrder.estimateCents == null
                    ? "Pending estimate"
                    : `No (under ${moneyFromCents(threshold)})`}
              </dd>
            </div>
          </dl>
          {workOrder.estimateNotes && (
            <p className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-soft)]">
              {workOrder.estimateNotes}
            </p>
          )}
          {workOrder.ownerNote && (
            <p className="rounded-xl bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--warn)]">
              Owner note: {workOrder.ownerNote}
            </p>
          )}
          {workOrder.policyDecisionReason && (
            <p className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-deep)]">
              Policy decision: {workOrder.policyDecisionReason.replaceAll("_", " ")}{" "}
              (AI cannot override)
            </p>
          )}

          {/* Manager: request vendor quote */}
          {user.role === "manager" &&
            ["under_review", "reported"].includes(workOrder.status) && (
              <div className="space-y-3 border-t border-[var(--line)] pt-4">
                <p className="text-sm font-semibold">Request vendor estimate</p>
                <p className="text-xs text-[var(--muted)]">
                  Preferred vendors are configured under Policies. Quote returns
                  through spending policy — never auto-approved because AI
                  recommended it.
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} · {v.trade}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={busy || !vendorId}
                    onClick={() =>
                      run(
                        () =>
                          patchWorkOrder(workOrder.id, {
                            action: "request_vendor_estimate",
                            vendorId,
                          }).then(() => undefined),
                        "Vendor estimate requested",
                      )
                    }
                  >
                    Request quote
                  </Button>
                </div>
              </div>
            )}

          {/* Manager: add estimate directly */}
          {user.role === "manager" &&
            ["under_review", "reported", "awaiting_estimate"].includes(
              workOrder.status,
            ) && (
              <div className="space-y-3 border-t border-[var(--line)] pt-4">
                <p className="text-sm font-semibold">Enter estimate (manager)</p>
                <p className="text-xs text-[var(--muted)]">
                  Policy threshold {moneyFromCents(threshold)}. Preapproved
                  categories under threshold auto-clear; others need owner.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="w-28 rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                    value={estimateDollars}
                    onChange={(e) => setEstimateDollars(e.target.value)}
                    inputMode="decimal"
                  />
                  <select
                    className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                  rows={2}
                  value={estimateNotes}
                  onChange={(e) => setEstimateNotes(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const cents = Math.round(
                          parseFloat(estimateDollars) * 100,
                        );
                        await patchWorkOrder(workOrder.id, {
                          action: "add_estimate",
                          estimateCents: cents,
                          estimateNotes,
                          vendorId,
                        });
                      }, "Estimate saved · policy applied")
                    }
                  >
                    Save estimate (${estimateDollars || "0"})
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEstimateDollars("150");
                      setEstimateNotes(
                        "Under-threshold illustrative quote for preapproved demo.",
                      );
                    }}
                  >
                    Try $150 (under threshold)
                  </Button>
                </div>
              </div>
            )}

          {/* Contractor: submit quote */}
          {user.role === "contractor" &&
            workOrder.status === "awaiting_estimate" && (
              <div className="space-y-3 border-t border-[var(--line)] pt-4">
                <p className="text-sm font-semibold">Submit your quote</p>
                <p className="text-xs text-[var(--muted)]">
                  Your quote is routed by the property spend policy. You cannot
                  authorize owner spend.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="w-28 rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                    value={estimateDollars}
                    onChange={(e) => setEstimateDollars(e.target.value)}
                    inputMode="decimal"
                    placeholder="$"
                  />
                </div>
                <textarea
                  className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                  rows={2}
                  value={estimateNotes}
                  onChange={(e) => setEstimateNotes(e.target.value)}
                  placeholder="Parts + labor notes"
                />
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const cents = Math.round(
                        parseFloat(estimateDollars) * 100,
                      );
                      await patchWorkOrder(workOrder.id, {
                        action: "submit_vendor_quote",
                        estimateCents: cents,
                        estimateNotes,
                      });
                    }, "Quote submitted · policy routing applied")
                  }
                >
                  Submit quote (${estimateDollars || "0"})
                </Button>
              </div>
            )}

          {/* Owner decide */}
          {user.role === "owner" &&
            workOrder.status === "awaiting_owner_approval" && (
              <div className="space-y-3 border-t border-[var(--line)] pt-4">
                <p className="text-sm font-semibold">Your decision</p>
                <textarea
                  className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional note / question"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          patchWorkOrder(workOrder.id, {
                            action: "owner_decide",
                            decision: "approved",
                            note,
                          }).then(() => undefined),
                        "Approved",
                      )
                    }
                  >
                    Approve {moneyFromCents(workOrder.estimateCents)}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          patchWorkOrder(workOrder.id, {
                            action: "owner_decide",
                            decision: "asked",
                            note: note || "Can we get a second quote?",
                          }).then(() => undefined),
                        "Question sent",
                      )
                    }
                  >
                    Ask
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          patchWorkOrder(workOrder.id, {
                            action: "owner_decide",
                            decision: "declined",
                            note: note || "Declined for now",
                          }).then(() => undefined),
                        "Declined",
                      )
                    }
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}

          {/* Manager assign */}
          {user.role === "manager" && workOrder.status === "approved" && (
            <div className="space-y-3 border-t border-[var(--line)] pt-4">
              <p className="text-sm font-semibold">Assign contractor</p>
              <select
                className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <Button
                disabled={busy || !vendorId}
                onClick={() =>
                  run(
                    () =>
                      patchWorkOrder(workOrder.id, {
                        action: "assign",
                        vendorId,
                      }).then(() => undefined),
                    "Contractor assigned",
                  )
                }
              >
                Assign
              </Button>
            </div>
          )}

          {/* Contractor status */}
          {(user.role === "contractor" || user.role === "manager") &&
            ["assigned", "scheduled", "in_progress"].includes(
              workOrder.status,
            ) && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                {workOrder.status === "assigned" && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          patchWorkOrder(workOrder.id, {
                            action: "status",
                            status: "scheduled",
                          }).then(() => undefined),
                        "Scheduled",
                      )
                    }
                  >
                    Mark scheduled
                  </Button>
                )}
                {["assigned", "scheduled"].includes(workOrder.status) && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          patchWorkOrder(workOrder.id, {
                            action: "status",
                            status: "in_progress",
                          }).then(() => undefined),
                        "In progress",
                      )
                    }
                  >
                    Start work
                  </Button>
                )}
                {["scheduled", "in_progress", "assigned"].includes(
                  workOrder.status,
                ) && (
                  <Button
                    variant="soft"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          patchWorkOrder(workOrder.id, {
                            action: "status",
                            status: "completed",
                          }).then(() => undefined),
                        "Completed",
                      )
                    }
                  >
                    Complete job
                  </Button>
                )}
              </div>
            )}
        </section>

        <aside className="panel p-5">
          <SectionLabel>Timeline / activity</SectionLabel>
          <ol className="timeline-rail relative mt-4 space-y-4 pl-8">
            {activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-8 top-1 h-5 w-5 rounded-full border-2 border-[var(--accent)] bg-[var(--accent)]" />
                <p className="text-sm font-medium text-[var(--ink-soft)]">
                  {a.message}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
