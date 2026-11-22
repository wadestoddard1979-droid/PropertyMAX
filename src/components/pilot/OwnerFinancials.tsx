"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchFinancials,
  ledgerSourceLabel,
  moneyFromCents,
  patchAssumptions,
  postLedgerEntry,
} from "@/lib/api-client";
import type {
  ProjectionAssumptions,
  Property,
  WorkOrder,
} from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

type Horizon = "12m" | "36m" | "60m";

type FinancialPayload = Awaited<ReturnType<typeof fetchFinancials>>;

export default function OwnerFinancials({
  property,
  onBack,
  onOpenWorkOrder,
  onToast,
  onError,
}: {
  property: Property;
  onBack: () => void;
  onOpenWorkOrder: (id: string) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [horizon, setHorizon] = useState<Horizon>("12m");
  const [data, setData] = useState<FinancialPayload | null>(null);
  const [assumptions, setAssumptions] = useState<ProjectionAssumptions | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [entryLabel, setEntryLabel] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryCategory, setEntryCategory] =
    useState<"rent" | "maintenance" | "other">("maintenance");

  const load = useCallback(async () => {
    const payload = await fetchFinancials({
      propertyId: property.id,
      month: "2026-11",
      horizon,
    });
    setData(payload);
    setAssumptions(payload.assumptions);
  }, [property.id, horizon]);

  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, [load, onError]);

  const chartMonths = useMemo(() => {
    if (!data) return [];
    const step = horizon === "12m" ? 1 : horizon === "36m" ? 3 : 5;
    return data.projection.months.filter((_, i) => i % step === 0);
  }, [data, horizon]);

  const maxBar = useMemo(() => {
    const vals = chartMonths.map((m) =>
      Math.abs(m.cashFlow + m.renovationSpend),
    );
    return Math.max(...vals, 1);
  }, [chartMonths]);

  async function saveAssumptions() {
    if (!assumptions) return;
    setBusy(true);
    try {
      await patchAssumptions(property.id, assumptions);
      await load();
      onToast("Assumptions updated — projections refreshed");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addManualEntry() {
    const dollars = parseFloat(entryAmount);
    if (!entryLabel.trim() || Number.isNaN(dollars)) {
      onError("Enter a label and amount");
      return;
    }
    setBusy(true);
    try {
      const amountCents =
        entryCategory === "rent"
          ? Math.round(Math.abs(dollars) * 100)
          : -Math.round(Math.abs(dollars) * 100);
      await postLedgerEntry({
        propertyId: property.id,
        month: "2026-11",
        category: entryCategory,
        label: entryLabel,
        amountCents,
      });
      setEntryLabel("");
      setEntryAmount("");
      await load();
      onToast("Manual entry saved (labeled manual — not bank-verified)");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Entry failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data || !assumptions) {
    return (
      <p className="text-sm text-[var(--muted)]">Loading financials…</p>
    );
  }

  const { snapshot, projection, pendingApprovals, disclaimer } = data;
  const pending = pendingApprovals as WorkOrder[];

  return (
    <div className="fade-in space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-sm font-medium text-[var(--accent)]"
            onClick={onBack}
          >
            ← Back
          </button>
          <SectionLabel>Owner investment command center</SectionLabel>
          <h1 className="display mt-1 text-3xl font-semibold">
            How is {property.name} doing?
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Plain-language cash flow for November 2026. {disclaimer}
          </p>
        </div>
        <StatusChip tone="warn">Illustrative · not bank-verified</StatusChip>
      </header>

      {pending.length > 0 && (
        <section className="panel border-[var(--warn)]/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <SectionLabel>Pending maintenance approval</SectionLabel>
              <h2 className="display mt-1 text-xl font-semibold">
                {pending[0].title}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {moneyFromCents(pending[0].estimateCents)} quote · over your $
                {property.ownerApprovalThresholdCents / 100} threshold
              </p>
            </div>
            <Button onClick={() => onOpenWorkOrder(pending[0].id)}>
              Review decision
            </Button>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Monthly rent (actual)"
          value={moneyFromCents(snapshot.actual.rent)}
          hint="Collected this month"
        />
        <Metric
          label="NOI"
          value={moneyFromCents(snapshot.actual.noi)}
          hint="Rent − operating expenses"
          positive={snapshot.actual.noi >= 0}
        />
        <Metric
          label="Est. cash flow"
          value={formatSigned(snapshot.actual.cashFlow)}
          hint="After mortgage (debt service)"
          positive={snapshot.actual.cashFlow >= 0}
          emphasize
        />
        <Metric
          label="Forecast cash flow"
          value={formatSigned(snapshot.forecast.cashFlow)}
          hint="Assumptions · vacancy adjusted"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-5">
          <SectionLabel>This month — actual vs forecast</SectionLabel>
          <ul className="mt-4 divide-y divide-[var(--line)] text-sm">
            <Row
              label="Rent"
              actual={snapshot.actual.rent}
              forecast={snapshot.forecast.rent}
            />
            <Row
              label="Operating expenses"
              actual={-snapshot.actual.operatingExpenses}
              forecast={-snapshot.forecast.operatingExpenses}
            />
            <Row
              label="NOI (before mortgage)"
              actual={snapshot.actual.noi}
              forecast={snapshot.forecast.noi}
              bold
            />
            <Row
              label="Mortgage"
              actual={-snapshot.actual.mortgage}
              forecast={-snapshot.forecast.mortgage}
            />
            <Row
              label="Cash flow after debt service"
              actual={snapshot.actual.cashFlow}
              forecast={snapshot.forecast.cashFlow}
              bold
              emphasize
            />
          </ul>
          <p className="mt-3 text-xs text-[var(--muted)]">
            {snapshot.labels.noi}. {snapshot.labels.cashFlow}.
          </p>
        </section>

        <section className="panel p-5">
          <SectionLabel>Ledger · November</SectionLabel>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
            {snapshot.entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{e.label}</span>
                  <span className="mt-0.5 block text-xs capitalize text-[var(--muted)]">
                    {e.category}
                  </span>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                      e.source === "verified"
                        ? "bg-[var(--positive-soft)] text-[var(--positive)]"
                        : e.source === "manual"
                          ? "bg-[var(--warn-soft)] text-[var(--warn)]"
                          : "bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                    }`}
                  >
                    {ledgerSourceLabel(e.source)}
                  </span>
                </span>
                <span
                  className={`money font-semibold ${e.amountCents >= 0 ? "text-[var(--positive)]" : "text-[var(--ink)]"}`}
                >
                  {formatSigned(e.amountCents)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
            <p className="text-sm font-semibold">
              Add manual rent / expense entry
            </p>
            <p className="rounded-xl bg-[var(--warn-soft)] px-3 py-2 text-xs text-[var(--warn)]">
              Saved as <strong>manual · not bank-verified</strong>. Seed rows are
              tagged <strong>illustrative</strong>. Phase 1 has no{" "}
              <strong>verified</strong> bank sync yet.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                value={entryCategory}
                onChange={(e) =>
                  setEntryCategory(e.target.value as typeof entryCategory)
                }
              >
                <option value="rent">Rent (inflow)</option>
                <option value="maintenance">Maintenance (outflow)</option>
                <option value="other">Other expense</option>
              </select>
              <input
                className="min-w-[8rem] flex-1 rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                placeholder="Label"
                value={entryLabel}
                onChange={(e) => setEntryLabel(e.target.value)}
              />
              <input
                className="w-28 rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                placeholder="$ amount"
                value={entryAmount}
                onChange={(e) => setEntryAmount(e.target.value)}
              />
              <Button disabled={busy} onClick={addManualEntry}>
                Add manual
              </Button>
            </div>
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionLabel>Projections</SectionLabel>
            <h2 className="display mt-1 text-xl font-semibold">
              Cash flow outlook
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Adjust assumptions below. Appreciation is intentionally excluded.
            </p>
          </div>
          <div className="flex rounded-xl bg-[var(--surface-2)] p-1">
            {(
              [
                ["12m", "12 mo"],
                ["36m", "3 yr"],
                ["60m", "5 yr"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setHorizon(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold sm:text-sm ${
                  horizon === id
                    ? "bg-white text-[var(--ink)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Stat
            label="Projected cash flow total"
            value={formatSigned(projection.totals.cashFlow)}
          />
          <Stat
            label="Projected NOI total"
            value={moneyFromCents(projection.totals.noi)}
          />
          <Stat
            label="Renovation modeled"
            value={moneyFromCents(projection.totals.renovationSpend)}
          />
        </div>

        <div className="mt-6 flex h-44 items-end gap-1 sm:gap-1.5">
          {chartMonths.map((m) => {
            const operating = m.cashFlow + m.renovationSpend;
            return (
              <div
                key={m.month}
                className="group flex flex-1 flex-col items-center gap-1"
                title={`${m.month}: operating ${formatSigned(operating)}${m.renovationSpend ? ` · reno ${formatSigned(-m.renovationSpend)}` : ""}`}
              >
                <div
                  className={`w-full rounded-t-md ${operating >= 0 ? "bg-[var(--accent)]/80" : "bg-[var(--danger)]/70"} ${m.renovationSpend ? "ring-2 ring-[var(--warn)]/50" : ""}`}
                  style={{
                    height: `${Math.max(8, (Math.abs(operating) / maxBar) * 100)}%`,
                  }}
                />
                <span className="text-[0.6rem] text-[var(--muted)]">
                  {m.month.slice(2)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Bars show monthly operating cash flow (before one-time renovation).
          Months with renovation spend are ring-highlighted. Totals above still
          include renovation.
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {projection.insights.disclaimer}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel space-y-3 p-5">
          <SectionLabel>Adjustable assumptions</SectionLabel>
          <AssumptionField
            label="Monthly rent ($)"
            value={assumptions.monthlyRentCents / 100}
            onChange={(v) =>
              setAssumptions({
                ...assumptions,
                monthlyRentCents: Math.round(v * 100),
              })
            }
          />
          <AssumptionField
            label="Vacancy rate (%)"
            value={assumptions.vacancyRatePct}
            onChange={(v) =>
              setAssumptions({ ...assumptions, vacancyRatePct: v })
            }
          />
          <AssumptionField
            label="Monthly repairs ($)"
            value={assumptions.monthlyRepairsCents / 100}
            onChange={(v) =>
              setAssumptions({
                ...assumptions,
                monthlyRepairsCents: Math.round(v * 100),
              })
            }
          />
          <AssumptionField
            label="Mortgage ($)"
            value={assumptions.monthlyMortgageCents / 100}
            onChange={(v) =>
              setAssumptions({
                ...assumptions,
                monthlyMortgageCents: Math.round(v * 100),
              })
            }
          />
          <AssumptionField
            label="Taxes ($ / mo)"
            value={assumptions.monthlyTaxesCents / 100}
            onChange={(v) =>
              setAssumptions({
                ...assumptions,
                monthlyTaxesCents: Math.round(v * 100),
              })
            }
          />
          <AssumptionField
            label="Insurance ($ / mo)"
            value={assumptions.monthlyInsuranceCents / 100}
            onChange={(v) =>
              setAssumptions({
                ...assumptions,
                monthlyInsuranceCents: Math.round(v * 100),
              })
            }
          />
          <AssumptionField
            label="Annual rent growth (%)"
            value={assumptions.annualRentGrowthPct}
            onChange={(v) =>
              setAssumptions({ ...assumptions, annualRentGrowthPct: v })
            }
          />
          <AssumptionField
            label="Renovation spend ($)"
            value={assumptions.renovationSpendCents / 100}
            onChange={(v) =>
              setAssumptions({
                ...assumptions,
                renovationSpendCents: Math.round(v * 100),
              })
            }
          />
          <AssumptionField
            label="Rent uplift after reno ($ / mo)"
            value={assumptions.renovationRentUpliftCents / 100}
            onChange={(v) =>
              setAssumptions({
                ...assumptions,
                renovationRentUpliftCents: Math.round(v * 100),
              })
            }
          />
          <AssumptionField
            label="Vacancy months on turnover"
            value={assumptions.vacancyMonthsOnTurnover}
            onChange={(v) =>
              setAssumptions({ ...assumptions, vacancyMonthsOnTurnover: v })
            }
          />
          <Button disabled={busy} onClick={saveAssumptions}>
            Save assumptions
          </Button>
        </section>

        <section className="panel space-y-4 p-5">
          <SectionLabel>Renovation & vacancy insight</SectionLabel>
          <div className="rounded-2xl bg-[var(--accent-soft)]/70 px-4 py-3">
            <p className="text-sm font-semibold text-[var(--accent-deep)]">
              Renovation ROI (illustrative)
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {projection.insights.renovationRoiLabel}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--warn-soft)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--warn)]">
              Vacancy cost
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {projection.insights.vacancyCostLabel}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Beachy Renovations pilot context: pre-lease refresh is modeled as a
            one-time spend with optional rent uplift. This is a planning aid —
            not an appraisal, and not a promise of appreciation or resale gain.
          </p>
        </section>
      </div>
    </div>
  );
}

function formatSigned(cents: number) {
  const abs = moneyFromCents(Math.abs(cents));
  if (cents > 0) return `+${abs}`;
  if (cents < 0) return `−${abs}`;
  return abs;
}

function Metric({
  label,
  value,
  hint,
  positive,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  positive?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="panel px-4 py-4">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p
        className={`money mt-1 text-2xl font-semibold ${
          emphasize || positive
            ? "text-[var(--positive)]"
            : "text-[var(--ink)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function Row({
  label,
  actual,
  forecast,
  bold,
  emphasize,
}: {
  label: string;
  actual: number;
  forecast: number;
  bold?: boolean;
  emphasize?: boolean;
}) {
  return (
    <li
      className={`grid grid-cols-[1.2fr_0.9fr_0.9fr] gap-2 py-2.5 ${bold ? "font-semibold" : ""}`}
    >
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span
        className={`money text-right ${emphasize ? "text-[var(--positive)]" : ""}`}
      >
        {formatSigned(actual)}
      </span>
      <span className="money text-right text-[var(--muted)]">
        {formatSigned(forecast)}
      </span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="money text-lg font-semibold">{value}</p>
    </div>
  );
}

function AssumptionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <input
        type="number"
        step="any"
        className="w-28 rounded-xl border border-[var(--line-strong)] px-3 py-1.5 text-right"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}
