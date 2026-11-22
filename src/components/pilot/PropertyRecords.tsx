"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchRecords,
  moneyFromCents,
  patchRecord,
} from "@/lib/api-client";
import type { Lease, Property, SessionUser, Unit } from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

export default function PropertyRecords({
  user,
  onBack,
  onToast,
  onError,
}: {
  user: SessionUser;
  onBack: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [property, setProperty] = useState<Property | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [people, setPeople] = useState<
    { id: string; name: string; role: string }[]
  >([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchRecords();
    setProperty(data.properties[0] || null);
    setUnit(data.units[0] || null);
    setLease(data.leases[0] || null);
    setCanEdit(data.canEdit);
    setPeople(data.people);
  }, []);

  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, [load, onError]);

  async function saveProperty() {
    if (!property || !canEdit) return;
    setBusy(true);
    try {
      await patchRecord("property", property.id, {
        name: property.name,
        address: property.address,
        type: property.type,
        beds: property.beds,
        baths: property.baths,
        sqft: property.sqft,
        occupancy: property.occupancy,
        monthlyRent: property.monthlyRent,
        leaseEnd: property.leaseEnd,
        ownerApprovalThresholdCents: property.ownerApprovalThresholdCents,
        notes: property.notes || "",
      });
      await load();
      onToast("Property record saved");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveUnit() {
    if (!unit || !canEdit) return;
    setBusy(true);
    try {
      await patchRecord("unit", unit.id, {
        label: unit.label,
        beds: unit.beds,
        baths: unit.baths,
        sqft: unit.sqft,
        occupancy: unit.occupancy,
        monthlyRentCents: unit.monthlyRentCents,
      });
      await load();
      onToast("Unit record saved");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveLease() {
    if (!lease || !canEdit) return;
    setBusy(true);
    try {
      await patchRecord("lease", lease.id, {
        startDate: lease.startDate,
        endDate: lease.endDate,
        monthlyRentCents: lease.monthlyRentCents,
        depositCents: lease.depositCents,
        status: lease.status,
        notes: lease.notes,
      });
      await load();
      onToast("Lease record saved");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!property) {
    return <p className="text-sm text-[var(--muted)]">Loading records…</p>;
  }

  const tenantNames = (lease?.tenantIds || property.tenantIds)
    .map((id) => people.find((p) => p.id === id)?.name || id)
    .join(", ");

  const readOnly = !canEdit;

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
            {user.role === "manager"
              ? "Manager · editable records"
              : user.role === "tenant"
                ? "Your lease & home"
                : user.role === "owner"
                  ? "Your property"
                  : "Authorized property view"}
          </SectionLabel>
          <h1 className="display mt-1 text-3xl font-semibold">
            Property · unit · lease
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Server-checked RBAC.{" "}
            {readOnly
              ? "View-only for your role."
              : "Managers can edit; changes write to the local JSON store."}
          </p>
        </div>
        <StatusChip tone={readOnly ? "neutral" : "accent"}>
          {readOnly ? "View only" : "Editable"}
        </StatusChip>
      </header>

      <section className="panel space-y-4 p-5">
        <SectionLabel>Property</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Name"
            value={property.name}
            readOnly={readOnly}
            onChange={(v) => setProperty({ ...property, name: v })}
          />
          <Field
            label="Type"
            value={property.type}
            readOnly={readOnly}
            onChange={(v) => setProperty({ ...property, type: v })}
          />
          <Field
            label="Address"
            value={property.address}
            readOnly={readOnly}
            className="sm:col-span-2"
            onChange={(v) => setProperty({ ...property, address: v })}
          />
          <Field
            label="Beds"
            value={String(property.beds)}
            readOnly={readOnly}
            onChange={(v) =>
              setProperty({ ...property, beds: Number(v) || 0 })
            }
          />
          <Field
            label="Baths"
            value={String(property.baths)}
            readOnly={readOnly}
            onChange={(v) =>
              setProperty({ ...property, baths: Number(v) || 0 })
            }
          />
          <Field
            label="Sq ft"
            value={String(property.sqft)}
            readOnly={readOnly}
            onChange={(v) =>
              setProperty({ ...property, sqft: Number(v) || 0 })
            }
          />
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Occupancy
            </label>
            {readOnly ? (
              <p className="mt-1 text-sm font-medium">{property.occupancy}</p>
            ) : (
              <select
                className="mt-1 w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                value={property.occupancy}
                onChange={(e) =>
                  setProperty({
                    ...property,
                    occupancy: e.target.value as Property["occupancy"],
                  })
                }
              >
                <option value="Occupied">Occupied</option>
                <option value="Vacant">Vacant</option>
              </select>
            )}
          </div>
          <Field
            label="Monthly rent ($)"
            value={String(property.monthlyRent)}
            readOnly={readOnly}
            onChange={(v) =>
              setProperty({ ...property, monthlyRent: Number(v) || 0 })
            }
          />
          <Field
            label="Approval threshold (cents)"
            value={String(property.ownerApprovalThresholdCents)}
            readOnly={readOnly}
            onChange={(v) =>
              setProperty({
                ...property,
                ownerApprovalThresholdCents: Number(v) || 0,
              })
            }
          />
          <Field
            label="Notes"
            value={property.notes || ""}
            readOnly={readOnly}
            className="sm:col-span-2"
            onChange={(v) => setProperty({ ...property, notes: v })}
          />
        </div>
        {!readOnly && (
          <Button disabled={busy} onClick={saveProperty}>
            Save property
          </Button>
        )}
      </section>

      {unit && (
        <section className="panel space-y-4 p-5">
          <SectionLabel>Unit</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Label"
              value={unit.label}
              readOnly={readOnly}
              onChange={(v) => setUnit({ ...unit, label: v })}
            />
            <Field
              label="Rent (cents)"
              value={String(unit.monthlyRentCents)}
              readOnly={readOnly}
              onChange={(v) =>
                setUnit({ ...unit, monthlyRentCents: Number(v) || 0 })
              }
            />
            <p className="sm:col-span-2 text-sm text-[var(--muted)]">
              Display rent: {moneyFromCents(unit.monthlyRentCents)} ·{" "}
              {unit.beds} bd / {unit.baths} ba · {unit.sqft.toLocaleString()}{" "}
              sq ft · {unit.occupancy}
            </p>
          </div>
          {!readOnly && (
            <Button disabled={busy} onClick={saveUnit}>
              Save unit
            </Button>
          )}
        </section>
      )}

      {lease ? (
        <section className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Lease</SectionLabel>
            <StatusChip
              tone={lease.status === "active" ? "positive" : "neutral"}
            >
              {lease.status}
            </StatusChip>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Residents: {tenantNames || "—"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Start"
              value={lease.startDate}
              readOnly={readOnly}
              onChange={(v) => setLease({ ...lease, startDate: v })}
            />
            <Field
              label="End"
              value={lease.endDate}
              readOnly={readOnly}
              onChange={(v) => setLease({ ...lease, endDate: v })}
            />
            <Field
              label="Rent (cents)"
              value={String(lease.monthlyRentCents)}
              readOnly={readOnly}
              onChange={(v) =>
                setLease({ ...lease, monthlyRentCents: Number(v) || 0 })
              }
            />
            <Field
              label="Deposit (cents)"
              value={String(lease.depositCents)}
              readOnly={readOnly}
              onChange={(v) =>
                setLease({ ...lease, depositCents: Number(v) || 0 })
              }
            />
            {!readOnly && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Status
                </label>
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm"
                  value={lease.status}
                  onChange={(e) =>
                    setLease({
                      ...lease,
                      status: e.target.value as Lease["status"],
                    })
                  }
                >
                  <option value="active">active</option>
                  <option value="upcoming">upcoming</option>
                  <option value="ended">ended</option>
                </select>
              </div>
            )}
            <Field
              label="Notes"
              value={lease.notes}
              readOnly={readOnly}
              className="sm:col-span-2"
              onChange={(v) => setLease({ ...lease, notes: v })}
            />
          </div>
          {!readOnly && (
            <Button disabled={busy} onClick={saveLease}>
              Save lease
            </Button>
          )}
        </section>
      ) : user.role === "contractor" ? (
        <p className="text-sm text-[var(--muted)]">
          Lease details are not shared with contractors.
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  readOnly,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </label>
      {readOnly ? (
        <p className="mt-1 text-sm font-medium text-[var(--ink)]">{value || "—"}</p>
      ) : (
        <input
          className="mt-1 w-full rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
