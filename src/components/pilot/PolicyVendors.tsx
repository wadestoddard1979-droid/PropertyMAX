"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPolicies,
  moneyFromCents,
  patchPolicy,
} from "@/lib/api-client";
import type { AutomationPolicy, SessionUser, Vendor } from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

const CATEGORY_OPTIONS = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Structural",
  "Pest",
  "General",
];

export default function PolicyVendors({
  user,
  propertyId,
  onBack,
  onToast,
  onError,
}: {
  user: SessionUser;
  propertyId: string;
  onBack: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [policy, setPolicy] = useState<AutomationPolicy | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [people, setPeople] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hardRule, setHardRule] = useState("");

  const load = useCallback(async () => {
    const data = await fetchPolicies(propertyId);
    setPolicy(data.policy);
    setVendors(data.vendors);
    setPeople(data.people);
    setCanEdit(data.canEdit);
    setHardRule(data.hardRule);
  }, [propertyId]);

  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, [load, onError]);

  async function save() {
    if (!policy || !canEdit) return;
    setBusy(true);
    try {
      const res = await patchPolicy(propertyId, {
        name: policy.name,
        spendThresholdCents: policy.spendThresholdCents,
        preapprovedCategories: policy.preapprovedCategories,
        emergencyProcess: policy.emergencyProcess,
        preferredVendorIds: policy.preferredVendorIds,
        escalationContactUserId: policy.escalationContactUserId,
        maxWaitHours: policy.maxWaitHours,
        enabled: policy.enabled,
      });
      setPolicy(res.policy);
      onToast("Policy saved — AI cannot override these rules");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleCategory(cat: string) {
    if (!policy || !canEdit) return;
    const set = new Set(policy.preapprovedCategories);
    if (set.has(cat)) set.delete(cat);
    else set.add(cat);
    setPolicy({ ...policy, preapprovedCategories: [...set] });
  }

  function toggleVendor(id: string) {
    if (!policy || !canEdit) return;
    const set = new Set(policy.preferredVendorIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setPolicy({ ...policy, preferredVendorIds: [...set] });
  }

  if (!policy) {
    return <p className="text-sm text-[var(--muted)]">Loading policy…</p>;
  }

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
          <SectionLabel>
            {user.role === "manager" ? "Manager configuration" : "Policy view"}
          </SectionLabel>
          <h1 className="display mt-1 text-3xl font-semibold">
            Spending policies & vendors
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            {hardRule}
          </p>
        </div>
        <StatusChip tone={policy.enabled ? "positive" : "warn"}>
          {policy.enabled ? "Enabled" : "Disabled"}
        </StatusChip>
      </header>

      <section className="panel space-y-4 p-5">
        <SectionLabel>Spend threshold</SectionLabel>
        <p className="text-sm text-[var(--muted)]">
          Quotes over this amount always require owner approval. Under-threshold
          quotes auto-clear only for preapproved categories.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Threshold (cents)
            </label>
            {canEdit ? (
              <input
                className="mt-1 w-40 rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                value={policy.spendThresholdCents}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    spendThresholdCents: Number(e.target.value) || 0,
                  })
                }
              />
            ) : (
              <p className="mt-1 money text-lg font-semibold">
                {moneyFromCents(policy.spendThresholdCents)}
              </p>
            )}
          </div>
          <p className="text-sm text-[var(--ink-soft)]">
            = {moneyFromCents(policy.spendThresholdCents)}
          </p>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Escalation wait (hours)
            </label>
            {canEdit ? (
              <input
                className="mt-1 w-28 rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                value={policy.maxWaitHours}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    maxWaitHours: Number(e.target.value) || 1,
                  })
                }
              />
            ) : (
              <p className="mt-1 text-sm font-medium">{policy.maxWaitHours}h</p>
            )}
          </div>
        </div>
        {canEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(e) =>
                setPolicy({ ...policy, enabled: e.target.checked })
              }
            />
            Policy enabled
          </label>
        )}
      </section>

      <section className="panel space-y-4 p-5">
        <SectionLabel>Preapproved categories</SectionLabel>
        <p className="text-sm text-[var(--muted)]">
          Under threshold + listed here → auto-cleared for assignment. Not listed
          → owner approval even if under threshold.
        </p>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((cat) => {
            const on = policy.preapprovedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                disabled={!canEdit}
                onClick={() => toggleCategory(cat)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                    : "border-[var(--line)] text-[var(--muted)]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel space-y-4 p-5">
        <SectionLabel>Preferred vendors</SectionLabel>
        <ul className="space-y-2">
          {vendors.map((v) => {
            const preferred = policy.preferredVendorIds.includes(v.id);
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{v.name}</p>
                  <p className="text-xs text-[var(--muted)]">{v.trade}</p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => toggleVendor(v.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      preferred
                        ? "bg-[var(--accent)] text-white"
                        : "bg-white text-[var(--muted)] border border-[var(--line)]"
                    }`}
                  >
                    {preferred ? "Preferred" : "Add preferred"}
                  </button>
                ) : (
                  preferred && <StatusChip tone="accent">Preferred</StatusChip>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel space-y-4 p-5">
        <SectionLabel>Escalation & emergency</SectionLabel>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Escalation contact
          </label>
          {canEdit ? (
            <select
              className="mt-1 w-full max-w-md rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
              value={policy.escalationContactUserId || ""}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  escalationContactUserId: e.target.value || null,
                })
              }
            >
              <option value="">—</option>
              {people
                .filter((p) => p.role === "manager" || p.role === "owner")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
            </select>
          ) : (
            <p className="mt-1 text-sm">
              {people.find((p) => p.id === policy.escalationContactUserId)
                ?.name || "—"}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Emergency process
          </label>
          {canEdit ? (
            <textarea
              className="mt-1 w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
              rows={3}
              value={policy.emergencyProcess}
              onChange={(e) =>
                setPolicy({ ...policy, emergencyProcess: e.target.value })
              }
            />
          ) : (
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {policy.emergencyProcess}
            </p>
          )}
        </div>
      </section>

      {canEdit && (
        <Button disabled={busy} onClick={save}>
          Save policy
        </Button>
      )}
    </div>
  );
}
