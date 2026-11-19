"use client";

import {
  AUTOMATION_FEED,
  FAUCET_DECISION,
  PROPERTY,
  formatMoney,
} from "@/lib/demo-data";
import { useDemo } from "@/lib/demo-store";
import { Button, IllustPhoto, SectionLabel, StatusChip } from "./ui";

export function ManagerHome() {
  const {
    attentionItems,
    decisionStatus,
    setManagerView,
    setRole,
    setOwnerView,
    repairDraft,
  } = useDemo();

  return (
    <div className="space-y-5">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel>Manager control center</SectionLabel>
          <h1 className="display mt-1 text-3xl font-semibold sm:text-4xl">
            Needs your attention
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {PROPERTY.managerCompany} · portfolio exceptions only
          </p>
        </div>
        <StatusChip tone="accent">1 townhouse pilot</StatusChip>
      </header>

      <div className="fade-in-delay-1 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2 className="display text-lg font-semibold">Action queue</h2>
            <p className="text-sm text-[var(--muted)]">
              Prioritized — not every admin task
            </p>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {attentionItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    if (item.linked === "faucet") {
                      setManagerView("thread");
                    } else if (item.linked === "new-repair") {
                      setManagerView("thread");
                    }
                  }}
                >
                  <span
                    className={`mt-1 rounded-md px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${
                      item.priority === "high"
                        ? "bg-[var(--warn-soft)] text-[var(--warn)]"
                        : "bg-black/5 text-[var(--muted)]"
                    }`}
                  >
                    {item.priority}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-[var(--muted)]">
                      {item.subtitle}
                    </span>
                  </span>
                  {item.linked && (
                    <span className="text-sm font-semibold text-[var(--accent)]">
                      Open
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <SectionLabel>Automated operations</SectionLabel>
          <h2 className="display mt-1 text-lg font-semibold">
            Running without review
          </h2>
          <ul className="mt-4 space-y-3">
            {AUTOMATION_FEED.map((item) => (
              <li
                key={item.id}
                className="rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
              >
                <p className="text-sm text-[var(--ink-soft)]">{item.text}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{item.time}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="fade-in-delay-2 panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionLabel>Property pulse</SectionLabel>
            <h2 className="display mt-1 text-xl font-semibold">
              {PROPERTY.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Occupied · rent {formatMoney(PROPERTY.monthlyRent)} · cash flow ~
              {formatMoney(PROPERTY.estimatedCashFlow)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip tone="positive">{PROPERTY.occupancy}</StatusChip>
            <StatusChip
              tone={
                decisionStatus === "pending"
                  ? "warn"
                  : decisionStatus === "approved"
                    ? "positive"
                    : "accent"
              }
            >
              Faucet: {decisionStatus}
            </StatusChip>
            {repairDraft.submitted && (
              <StatusChip tone="warn">New repair in</StatusChip>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setManagerView("thread")}>
            Open maintenance thread
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setRole("owner");
              setOwnerView("decision");
            }}
          >
            Jump to owner decision card
          </Button>
        </div>
      </section>
    </div>
  );
}

export function ManagerThread() {
  const {
    setManagerView,
    decisionStatus,
    decisionNote,
    timeline,
    repairDraft,
    setRole,
    setOwnerView,
    setTenantView,
  } = useDemo();

  return (
    <div className="space-y-5">
      <header className="fade-in">
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)]"
          onClick={() => setManagerView("home")}
        >
          ← Back to queue
        </button>
        <h1 className="display mt-2 text-3xl font-semibold">
          Maintenance thread
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Same faucet story the owner and tenant see — one shared backend in the
          real product.
        </p>
      </header>

      <div className="fade-in-delay-1 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="accent">Plumbing</StatusChip>
            <StatusChip tone="warn">
              {formatMoney(FAUCET_DECISION.amount)}
            </StatusChip>
            <StatusChip
              tone={
                decisionStatus === "approved"
                  ? "positive"
                  : decisionStatus === "pending"
                    ? "warn"
                    : "accent"
              }
            >
              Owner: {decisionStatus}
            </StatusChip>
          </div>
          <h2 className="display mt-3 text-xl font-semibold">
            {FAUCET_DECISION.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {FAUCET_DECISION.summary}
          </p>
          {decisionNote && (
            <p className="mt-3 rounded-xl bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--warn)]">
              Owner note: {decisionNote}
            </p>
          )}

          <ol className="timeline-rail relative mt-5 space-y-4 pl-8">
            {timeline.map((step) => (
              <li key={step.label} className="relative">
                <span
                  className={`absolute -left-8 top-1 h-5 w-5 rounded-full border-2 ${
                    step.done
                      ? "border-[var(--accent)] bg-[var(--accent)]"
                      : "border-[var(--line-strong)] bg-white"
                  }`}
                />
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="text-sm text-[var(--muted)]">{step.detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRole("owner");
                setOwnerView("decision");
              }}
            >
              View as owner
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRole("tenant");
                setTenantView("timeline");
              }}
            >
              View as tenant
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <IllustPhoto caption="Tenant photo · drip" variant="drip" />
            <IllustPhoto caption="Tenant photo · base wear" variant="base" />
          </div>

          {repairDraft.submitted ? (
            <section className="panel p-5">
              <SectionLabel>Linked new request</SectionLabel>
              <h3 className="display mt-1 text-lg font-semibold">
                {repairDraft.issue || "Bathroom exhaust fan"}
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {repairDraft.details}
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--warn)]">
                Urgency · {repairDraft.urgency}
              </p>
              <StatusChip tone="accent">Awaiting triage</StatusChip>
            </section>
          ) : (
            <section className="panel p-5">
              <SectionLabel>Tip for the pitch</SectionLabel>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Switch to Tenant → Request Repair, submit the exhaust fan issue,
                then return here. The queue updates live in this demo.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
