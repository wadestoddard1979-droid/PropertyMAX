"use client";

import { useCallback, useEffect, useState } from "react";
import {
  decideChangeOrder,
  decideRenoProject,
  fetchReports,
  fetchRenovation,
  generateOwnerStatement,
  moneyFromCents,
  patchTurnoverItem,
  postRenoProgress,
  proposeChangeOrder,
} from "@/lib/api-client";
import type {
  AssetRecord,
  OwnerStatement,
  RenovationProject,
  SessionUser,
  TurnoverChecklist,
} from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

type Props = {
  user: SessionUser;
  propertyId: string;
  onBack: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
};

export default function OwnerReportsReno({
  user,
  propertyId,
  onBack,
  onToast,
  onError,
}: Props) {
  const [tab, setTab] = useState<"reports" | "reno" | "turnover" | "assets">(
    "reports",
  );
  const [statements, setStatements] = useState<OwnerStatement[]>([]);
  const [summary, setSummary] = useState<{
    byMonth: Record<
      string,
      { expensesCents: number; maintenanceCents: number; rentCents: number }
    >;
    workOrders: { id: string; title: string; status: string }[];
  } | null>(null);
  const [projects, setProjects] = useState<RenovationProject[]>([]);
  const [turnovers, setTurnovers] = useState<TurnoverChecklist[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [vacancyLabel, setVacancyLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [coTitle, setCoTitle] = useState("");
  const [coAmount, setCoAmount] = useState("850");

  const load = useCallback(async () => {
    const [reports, reno] = await Promise.all([
      fetchReports(propertyId),
      fetchRenovation(propertyId),
    ]);
    setStatements(reports.statements);
    setSummary({
      byMonth: reports.summary.byMonth,
      workOrders: reports.summary.workOrders.map((w) => ({
        id: w.id,
        title: w.title,
        status: w.status,
      })),
    });
    setProjects(reno.projects);
    setTurnovers(reno.turnovers);
    setAssets(reno.assets);
    setVacancyLabel(reno.vacancyInsight.label);
  }, [propertyId]);

  useEffect(() => {
    load().catch((e) =>
      onError(e instanceof Error ? e.message : "Failed to load"),
    );
  }, [load, onError]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>Owner reporting & renovations</SectionLabel>
          <h1 className="display mt-1 text-2xl font-semibold">
            Statements · reno · turnover
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Monthly owner packs from ledger + maintenance. Managers drive reno
            projects; owners approve budgets and change orders.
          </p>
        </div>
        <Button variant="soft" onClick={onBack}>
          Back
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["reports", "Reports"],
            ["reno", "Renovation"],
            ["turnover", "Turnover"],
            ["assets", "Assets"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? "primary" : "soft"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "reports" && (
        <div className="space-y-4">
          <section className="panel space-y-3 px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="display text-lg font-semibold">
                  Monthly owner statement
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Auto-generate from ledger + maintenance for 2026-11
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await generateOwnerStatement({
                        propertyId,
                        month: "2026-11",
                        viaJob: true,
                      });
                      onToast("Owner statement generated (job queue)");
                      await load();
                    } catch (e) {
                      onError(e instanceof Error ? e.message : "Failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Generate Nov statement
                </Button>
                <a
                  className="inline-flex items-center rounded-[var(--radius)] border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                  href={`/api/reports?propertyId=${propertyId}&export=tax&format=json&year=2026`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tax JSON
                </a>
                <a
                  className="inline-flex items-center rounded-[var(--radius)] border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-2)]"
                  href={`/api/reports?propertyId=${propertyId}&export=tax&format=csv&year=2026`}
                >
                  Tax CSV
                </a>
              </div>
            </div>

            {statements.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                No statements yet — generate one to populate this pack.
              </p>
            )}
            {statements.map((s) => (
              <div
                key={s.id}
                className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">Statement · {s.month}</p>
                  <StatusChip tone="positive">
                    {new Date(s.generatedAt).toLocaleString()}
                  </StatusChip>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <Stat label="Rent" value={moneyFromCents(s.rentCollectedCents)} />
                  <Stat
                    label="OpEx"
                    value={moneyFromCents(s.operatingExpensesCents)}
                  />
                  <Stat label="NOI" value={moneyFromCents(s.noiCents)} />
                  <Stat
                    label="Cash flow"
                    value={moneyFromCents(s.cashFlowCents)}
                  />
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Maintenance {moneyFromCents(s.maintenanceCents)} ·{" "}
                  {s.workOrderCount} work order(s) · {s.notes}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  {Object.entries(s.expenseByCategory).map(([k, v]) => (
                    <span key={k}>
                      {k}: {moneyFromCents(v)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h2 className="display text-lg font-semibold">
                Expense / maintenance summary
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Sep–Dec 2026 rollup
              </p>
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {summary &&
                Object.entries(summary.byMonth).map(([month, row]) => (
                  <li
                    key={month}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span className="font-semibold">{month}</span>
                    <span className="text-[var(--muted)]">
                      Rent {moneyFromCents(row.rentCents)} · Expenses{" "}
                      {moneyFromCents(row.expensesCents)} · Maintenance{" "}
                      {moneyFromCents(row.maintenanceCents)}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}

      {tab === "reno" && (
        <div className="space-y-4">
          {projects.map((p) => (
            <section key={p.id} className="panel space-y-4 px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="display text-lg font-semibold">{p.title}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{p.scope}</p>
                </div>
                <StatusChip
                  tone={
                    p.status === "in_progress" || p.status === "approved"
                      ? "positive"
                      : p.status === "awaiting_owner_approval"
                        ? "warn"
                        : "accent"
                  }
                >
                  {p.status.replaceAll("_", " ")}
                </StatusChip>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Stat label="Budget" value={moneyFromCents(p.budgetCents)} />
                <Stat label="Spent" value={moneyFromCents(p.spentCents)} />
                <Stat label="Progress" value={`${p.progressPct}%`} />
                <Stat
                  label="Owner"
                  value={p.ownerDecision || "—"}
                />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full bg-[var(--accent)]"
                  style={{ width: `${p.progressPct}%` }}
                />
              </div>
              <ul className="space-y-2">
                {p.milestones.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{m.title}</span>
                    <StatusChip
                      tone={
                        m.status === "done"
                          ? "positive"
                          : m.status === "in_progress"
                            ? "accent"
                            : "neutral"
                      }
                    >
                      {m.status.replaceAll("_", " ")}
                    </StatusChip>
                  </li>
                ))}
              </ul>

              {user.role === "owner" &&
                p.status === "awaiting_owner_approval" && (
                  <div className="flex gap-2">
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await decideRenoProject(p.id, "approved");
                          onToast("Renovation approved");
                          await load();
                        } catch (e) {
                          onError(e instanceof Error ? e.message : "Failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Approve budget
                    </Button>
                    <Button
                      variant="soft"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await decideRenoProject(p.id, "declined");
                          onToast("Renovation declined");
                          await load();
                        } catch (e) {
                          onError(e instanceof Error ? e.message : "Failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                )}

              {user.role === "manager" && (
                <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                  <Button
                    variant="soft"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await postRenoProgress(p.id, {
                          status: "in_progress",
                          progressPct: Math.min(100, p.progressPct + 10),
                          spentCents: p.spentCents + 50000,
                        });
                        onToast("Progress updated");
                        await load();
                      } catch (e) {
                        onError(e instanceof Error ? e.message : "Failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    +10% progress
                  </Button>
                  <input
                    className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                    placeholder="Change order title"
                    value={coTitle}
                    onChange={(e) => setCoTitle(e.target.value)}
                  />
                  <input
                    className="w-24 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                    value={coAmount}
                    onChange={(e) => setCoAmount(e.target.value)}
                  />
                  <Button
                    disabled={busy || !coTitle.trim()}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await proposeChangeOrder(p.id, {
                          title: coTitle.trim(),
                          amountCents: Math.round(
                            Math.abs(parseFloat(coAmount) || 0) * 100,
                          ),
                        });
                        setCoTitle("");
                        onToast("Change order proposed");
                        await load();
                      } catch (e) {
                        onError(e instanceof Error ? e.message : "Failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Propose CO
                  </Button>
                </div>
              )}

              {p.changeOrders.length > 0 && (
                <div className="space-y-2 border-t border-[var(--line)] pt-3">
                  <p className="text-sm font-semibold">Change orders</p>
                  {p.changeOrders.map((co) => (
                    <div
                      key={co.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {co.title} · {moneyFromCents(co.amountCents)}
                      </span>
                      <div className="flex items-center gap-2">
                        <StatusChip
                          tone={
                            co.status === "approved"
                              ? "positive"
                              : co.status === "proposed"
                                ? "warn"
                                : "neutral"
                          }
                        >
                          {co.status}
                        </StatusChip>
                        {user.role === "owner" && co.status === "proposed" && (
                          <>
                            <Button
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await decideChangeOrder(
                                    p.id,
                                    co.id,
                                    "approved",
                                  );
                                  onToast("Change order approved");
                                  await load();
                                } catch (e) {
                                  onError(
                                    e instanceof Error ? e.message : "Failed",
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="soft"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await decideChangeOrder(
                                    p.id,
                                    co.id,
                                    "declined",
                                  );
                                  onToast("Change order declined");
                                  await load();
                                } catch (e) {
                                  onError(
                                    e instanceof Error ? e.message : "Failed",
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Decline
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No renovation projects.</p>
          )}
        </div>
      )}

      {tab === "turnover" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">{vacancyLabel}</p>
          {turnovers.map((t) => (
            <section key={t.id} className="panel space-y-3 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="display text-lg font-semibold">{t.title}</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Move-out {t.moveOutDate} · vacancy cost{" "}
                    {moneyFromCents(t.vacancyCostCents)}
                  </p>
                </div>
                <StatusChip tone="accent">
                  {t.status.replaceAll("_", " ")}
                </StatusChip>
              </div>
              <ul className="space-y-2">
                {t.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={item.done}
                      disabled={busy || (user.role !== "manager" && user.role !== "owner")}
                      onChange={async (e) => {
                        setBusy(true);
                        try {
                          const items = t.items.map((i) =>
                            i.id === item.id
                              ? { ...i, done: e.target.checked }
                              : i,
                          );
                          await patchTurnoverItem(t.id, items);
                          await load();
                        } catch (err) {
                          onError(
                            err instanceof Error ? err.message : "Failed",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                    <span className={item.done ? "line-through opacity-60" : ""}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {tab === "assets" && (
        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2 className="display text-lg font-semibold">Asset register</h2>
            <p className="text-sm text-[var(--muted)]">
              Starters: HVAC, water heater, appliances
            </p>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {assets.map((a) => (
              <li key={a.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{a.name}</p>
                  <StatusChip tone="neutral">
                    {a.category.replaceAll("_", " ")}
                  </StatusChip>
                </div>
                <p className="mt-1 text-[var(--muted)]">
                  {a.makeModel || "—"}
                  {a.installedAt ? ` · installed ${a.installedAt}` : ""}
                  {a.warrantyEndsAt ? ` · warranty → ${a.warrantyEndsAt}` : ""}
                  {a.expectedLifeYears
                    ? ` · ~${a.expectedLifeYears}y life`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] bg-[var(--surface-2)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
