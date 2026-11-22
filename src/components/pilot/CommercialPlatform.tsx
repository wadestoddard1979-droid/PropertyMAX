"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCommercial,
  importAccountingCsv,
  moneyFromCents,
  saveWhiteLabel,
  switchActiveOrg,
  toggleMfa,
  updateSaasPlan,
  verifyMfa,
} from "@/lib/api-client";
import type { SessionUser } from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

type Props = {
  user: SessionUser & { mfaEnabled?: boolean };
  orgId: string;
  onBack: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
  onOrgChanged: () => void;
};

export default function CommercialPlatform({
  user,
  orgId: initialOrgId,
  onBack,
  onToast,
  onError,
  onOrgChanged,
}: Props) {
  const [orgId, setOrgId] = useState(initialOrgId);
  const [tab, setTab] = useState<
    "overview" | "billing" | "portfolio" | "vendors" | "accounting" | "security"
  >("overview");
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchCommercial>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [mfaCode, setMfaCode] = useState("123456");
  const [csv, setCsv] = useState(
    "external_ref,label,amount,posted_on,property_id\nQBO-1001,November rent collected,1850,2026-11-02,prop-maple\nQBO-1002,Unknown fee,42.50,2026-11-03,prop-maple",
  );

  const load = useCallback(async () => {
    const payload = await fetchCommercial(orgId);
    setData(payload);
  }, [orgId]);

  useEffect(() => {
    load().catch((e) =>
      onError(e instanceof Error ? e.message : "Failed to load commercial"),
    );
  }, [load, onError]);

  if (!data) {
    return <p className="text-sm text-[var(--muted)]">Loading commercial…</p>;
  }

  const theme = data.theme;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>Phase 3 · commercial platform</SectionLabel>
          <h1 className="display mt-1 text-2xl font-semibold">
            {data.org?.name || "Organization"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Multi-org tenancy · SaaS billing · portfolio · vendor network ·
            white-label · hardening
          </p>
        </div>
        <Button variant="soft" onClick={onBack}>
          Back
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--muted)]">Active org</span>
        {data.orgs.map((o) => (
          <Button
            key={o.id}
            variant={o.id === orgId ? "primary" : "soft"}
            onClick={async () => {
              setBusy(true);
              try {
                await switchActiveOrg(o.id);
                setOrgId(o.id);
                onToast(`Switched to ${o.name}`);
                onOrgChanged();
              } catch (e) {
                onError(e instanceof Error ? e.message : "Switch failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {o.name}
          </Button>
        ))}
        <StatusChip tone={data.billingMode === "demo" ? "warn" : "positive"}>
          Billing {data.billingMode}
        </StatusChip>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["billing", "SaaS billing"],
            ["portfolio", "Portfolio"],
            ["vendors", "Vendor network"],
            ["accounting", "Accounting"],
            ["security", "Security"],
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

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel space-y-3 px-5 py-5">
            <h2 className="display text-lg font-semibold">Memberships</h2>
            <ul className="space-y-2 text-sm">
              {data.memberships.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span>
                    {m.userName} · {m.userEmail}
                  </span>
                  <StatusChip tone="accent">{m.role}</StatusChip>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel space-y-3 px-5 py-5">
            <h2 className="display text-lg font-semibold">White-label</h2>
            {theme && (
              <div
                className="rounded-[var(--radius)] px-4 py-4"
                style={{
                  background: theme.surfaceColor,
                  border: `1px solid ${theme.primaryColor}33`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: theme.primaryColor }}
                  >
                    {theme.mark}
                  </span>
                  <div>
                    <p
                      className="display text-xl font-semibold"
                      style={{ color: theme.accentColor }}
                    >
                      {theme.logoText}
                    </p>
                    <p className="text-sm" style={{ color: theme.accentColor }}>
                      {theme.tagline}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {orgId === "org-beachy" && (
              <p className="text-sm text-[var(--muted)]">
                Beachy Renovations theme is active for this org.
              </p>
            )}
            {user.role === "owner" && theme && (
              <Button
                variant="soft"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveWhiteLabel(orgId, {
                      ...theme,
                      tagline: `${theme.tagline} · updated`,
                    });
                    onToast("Theme saved");
                    await load();
                    onOrgChanged();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : "Theme failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Touch tagline
              </Button>
            )}
          </section>
          <section className="panel space-y-3 px-5 py-5 lg:col-span-2">
            <h2 className="display text-lg font-semibold">
              Portfolio benchmarking
            </h2>
            <p className="text-sm text-[var(--muted)]">{data.benchmark.notes}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Metric
                label="Avg rent (yours)"
                value={moneyFromCents(data.benchmark.metrics.avgRentCents)}
              />
              <Metric
                label="Peer avg rent"
                value={moneyFromCents(data.benchmark.metrics.peerAvgRentCents)}
              />
              <Metric
                label="Occupancy"
                value={`${data.benchmark.metrics.occupancyPct}% vs peer ${data.benchmark.metrics.peerOccupancyPct}%`}
              />
              <Metric
                label="Maint / door"
                value={moneyFromCents(
                  data.benchmark.metrics.maintenancePerDoorCents,
                )}
              />
              <Metric
                label="Peer maint / door"
                value={moneyFromCents(
                  data.benchmark.metrics.peerMaintenancePerDoorCents,
                )}
              />
              <Metric
                label="Avg cash flow"
                value={moneyFromCents(data.benchmark.metrics.avgCashFlowCents)}
              />
            </div>
          </section>
        </div>
      )}

      {tab === "billing" && (
        <section className="panel space-y-4 px-5 py-5">
          {data.billingMode === "demo" && (
            <div className="rounded-[var(--radius)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <strong>DEMO SaaS billing</strong> — Stripe Billing keys not set.
              Plan changes create clearly labeled fake invoices (not real
              charges).
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--muted)]">Current plan</p>
              <p className="display text-2xl font-semibold">
                {data.subscription?.plan || "none"} ·{" "}
                {data.subscription?.status}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {moneyFromCents(data.subscription?.unitAmountCents || 0)} / mo ·
                provider {data.subscription?.provider}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["pilot", "growth", "portfolio"] as const).map((plan) => (
                <Button
                  key={plan}
                  variant="soft"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await updateSaasPlan(orgId, plan);
                      onToast(res.invoice.label);
                      await load();
                    } catch (e) {
                      onError(e instanceof Error ? e.message : "Billing failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Set {plan}
                </Button>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {data.invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span>
                  {inv.label} · {moneyFromCents(inv.amountCents)}
                </span>
                <StatusChip tone={inv.demo ? "warn" : "positive"}>
                  {inv.status}
                </StatusChip>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "portfolio" && (
        <section className="panel space-y-4 px-5 py-5">
          <h2 className="display text-lg font-semibold">
            Multi-property portfolio
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {data.portfolio.propertyCount} doors · {data.portfolio.occupiedCount}{" "}
            occupied · 12m projection totals
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Metric
              label="Rent (12m)"
              value={moneyFromCents(data.portfolio.totals.rent)}
            />
            <Metric
              label="NOI (12m)"
              value={moneyFromCents(data.portfolio.totals.noi)}
            />
            <Metric
              label="Cash flow"
              value={moneyFromCents(data.portfolio.totals.cashFlow)}
            />
            <Metric
              label="Reno spend"
              value={moneyFromCents(data.portfolio.totals.renovationSpend)}
            />
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {data.portfolio.perProperty.map((p) => (
              <li
                key={p.propertyId}
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-[var(--muted)]">
                  {p.occupancy} · {moneyFromCents(p.monthlyRentCents)}/mo
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "vendors" && (
        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2 className="display text-lg font-semibold">
              Preferred vendor network
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Org directory — not a public marketplace
            </p>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {data.vendors.map((v) => (
              <li key={v.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{v.name}</p>
                  <StatusChip tone="positive">
                    {v.trade}
                    {v.rating ? ` · ${v.rating}` : ""}
                  </StatusChip>
                </div>
                <p className="mt-1 text-[var(--muted)]">
                  {v.serviceArea || "Service area TBD"}
                  {v.preferred ? " · preferred" : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "accounting" && (
        <section className="panel space-y-4 px-5 py-5">
          <h2 className="display text-lg font-semibold">
            Accounting reconciliation (stub)
          </h2>
          <p className="text-sm text-[var(--muted)]">
            CSV import/export with simple amount+label matching — not trust
            accounting.
          </p>
          <textarea
            className="w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs"
            rows={5}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await importAccountingCsv(orgId, csv);
                  onToast(`Imported ${res.lines.length} line(s)`);
                  await load();
                } catch (e) {
                  onError(e instanceof Error ? e.message : "Import failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Import CSV
            </Button>
            <a
              className="inline-flex items-center rounded-[var(--radius)] border border-[var(--line)] px-3 py-2 text-sm font-semibold"
              href={`/api/commercial?orgId=${orgId}&view=accounting_export`}
            >
              Export CSV
            </a>
          </div>
          <ul className="divide-y divide-[var(--line)] text-sm">
            {data.accounting.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap justify-between gap-2 py-3"
              >
                <span>
                  {row.externalRef} · {row.label} ·{" "}
                  {moneyFromCents(row.amountCents)}
                </span>
                <StatusChip
                  tone={row.status === "matched" ? "positive" : "warn"}
                >
                  {row.status}
                </StatusChip>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "security" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel space-y-3 px-5 py-5">
            <h2 className="display text-lg font-semibold">MFA</h2>
            <p className="text-sm text-[var(--muted)]">
              Toggle for owner/manager. Sensitive SaaS plan changes enforce MFA
              when enabled. Demo code: <code>123456</code>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="soft"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await toggleMfa(!(user.mfaEnabled || false));
                    onToast(
                      user.mfaEnabled ? "MFA disabled" : "MFA enabled",
                    );
                    onOrgChanged();
                    await load();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : "MFA failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {user.mfaEnabled ? "Disable MFA" : "Enable MFA"}
              </Button>
              <input
                className="w-28 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await verifyMfa(mfaCode);
                    onToast("MFA verified for this session");
                    onOrgChanged();
                    await load();
                  } catch (e) {
                    onError(e instanceof Error ? e.message : "Verify failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Verify
              </Button>
              <StatusChip
                tone={data.session.mfaVerified ? "positive" : "warn"}
              >
                {data.session.mfaVerified ? "verified" : "not verified"}
              </StatusChip>
            </div>
          </section>
          <section className="panel space-y-3 px-5 py-5">
            <h2 className="display text-lg font-semibold">
              Audit & monitoring
            </h2>
            <a
              className="inline-flex items-center rounded-[var(--radius)] border border-[var(--line)] px-3 py-2 text-sm font-semibold"
              href={`/api/commercial?orgId=${orgId}&view=audit&format=download`}
            >
              Export audit JSON
            </a>
            <ul className="max-h-56 space-y-2 overflow-auto text-xs text-[var(--muted)]">
              {data.monitoring.map((m) => (
                <li key={m.id}>
                  [{m.level}] {m.source}: {m.message}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] bg-[var(--surface-2)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
