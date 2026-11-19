"use client";

import { PROPERTY, formatMoney } from "@/lib/demo-data";
import { useDemo } from "@/lib/demo-store";
import { Button, IllustPhoto, SectionLabel, StatusChip } from "./ui";

export function TenantHome() {
  const { setTenantView, decisionStatus, repairDraft } = useDemo();

  return (
    <div className="space-y-5">
      <header className="fade-in">
        <SectionLabel>Tenant home</SectionLabel>
        <h1 className="display mt-1 text-3xl font-semibold sm:text-4xl">
          Hi, Jordan
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {PROPERTY.address}
        </p>
      </header>

      <div className="fade-in-delay-1 grid gap-3 sm:grid-cols-3">
        <ActionCard
          title="Pay Rent"
          detail={`Next due Dec 1 · ${formatMoney(PROPERTY.monthlyRent)}`}
          onClick={() => setTenantView("pay")}
        />
        <ActionCard
          title="Request Repair"
          detail="Tell us what’s wrong — under a minute"
          onClick={() => setTenantView("repair")}
          accent
        />
        <ActionCard
          title="Message"
          detail="Reach Beachy Property Partners"
          onClick={() => setTenantView("message")}
        />
      </div>

      <section className="fade-in-delay-2 panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <SectionLabel>Open maintenance</SectionLabel>
            <h2 className="display mt-1 text-xl font-semibold">
              Kitchen faucet drip
            </h2>
          </div>
          <StatusChip
            tone={
              decisionStatus === "approved"
                ? "positive"
                : decisionStatus === "pending"
                  ? "warn"
                  : "accent"
            }
          >
            {decisionStatus === "approved"
              ? "Scheduling"
              : decisionStatus === "pending"
                ? "Awaiting owner approval"
                : decisionStatus === "asked"
                  ? "Manager following up"
                  : "Re-scoping"}
          </StatusChip>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          We received your photos and quote. You’ll get updates as this moves —
          no need to chase status.
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => setTenantView("timeline")}
        >
          View status timeline
        </Button>
      </section>

      {repairDraft.submitted && (
        <section className="fade-in panel border-[var(--accent)]/25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <SectionLabel>Just submitted</SectionLabel>
              <h2 className="display mt-1 text-lg font-semibold">
                {repairDraft.issue || "Bathroom exhaust fan"}
              </h2>
            </div>
            <StatusChip tone="accent">Under review</StatusChip>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {repairDraft.details ||
              "Your request is in the manager queue and linked to this property."}
          </p>
        </section>
      )}
    </div>
  );
}

function ActionCard({
  title,
  detail,
  onClick,
  accent,
}: {
  title: string;
  detail: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius)] border px-4 py-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 ${
        accent
          ? "border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]"
          : "border-[var(--line)] bg-white hover:border-[var(--accent)]/35"
      }`}
    >
      <p className="display text-xl font-semibold">{title}</p>
      <p
        className={`mt-2 text-sm ${accent ? "text-white/85" : "text-[var(--muted)]"}`}
      >
        {detail}
      </p>
    </button>
  );
}

export function TenantRepair() {
  const { repairDraft, updateRepairDraft, submitRepair, setTenantView } =
    useDemo();

  const prompts = [
    "Kitchen sink is dripping again",
    "Bathroom exhaust fan is rattling",
    "Thermostat won’t hold temperature",
  ];

  const canSubmit =
    repairDraft.issue.trim().length > 2 &&
    repairDraft.details.trim().length > 4 &&
    !repairDraft.submitted;

  return (
    <div className="space-y-5">
      <header className="fade-in">
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)]"
          onClick={() => setTenantView("home")}
        >
          ← Back to home
        </button>
        <h1 className="display mt-2 text-3xl font-semibold">
          Request a repair
        </h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
          Conversational intake — we turn what you say into a structured work
          order for your manager.
        </p>
      </header>

      <div className="fade-in-delay-1 panel space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold">What’s going on?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                className="rounded-full border border-[var(--line-strong)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent-deep)]"
                onClick={() =>
                  updateRepairDraft({
                    issue: p,
                    details:
                      p.includes("fan")
                        ? "The bathroom fan makes a loud rattle when turned on. Started this week. Not an emergency."
                        : repairDraft.details,
                    urgency: p.includes("Thermostat") ? "soon" : "routine",
                  })
                }
              >
                {p}
              </button>
            ))}
          </div>
          <input
            className="mt-3 w-full rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            placeholder="Short title for the issue"
            value={repairDraft.issue}
            onChange={(e) => updateRepairDraft({ issue: e.target.value })}
            disabled={repairDraft.submitted}
          />
        </div>

        <div>
          <p className="text-sm font-semibold">Tell us a bit more</p>
          <textarea
            className="mt-2 w-full rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            rows={4}
            placeholder="When did it start? Which room? Any leaking, noise, or safety concern?"
            value={repairDraft.details}
            onChange={(e) => updateRepairDraft({ details: e.target.value })}
            disabled={repairDraft.submitted}
          />
        </div>

        <div>
          <p className="text-sm font-semibold">How urgent feels this?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ["routine", "Routine"],
                ["soon", "Soon"],
                ["urgent", "Urgent"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={repairDraft.submitted}
                onClick={() => updateRepairDraft({ urgency: value })}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  repairDraft.urgency === value
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                    : "border-[var(--line)] bg-white text-[var(--ink-soft)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--surface-2)] p-4">
          <SectionLabel>We’ll create</SectionLabel>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Work order · category guess · non-emergency unless you mark urgent ·
            linked to {PROPERTY.name}
          </p>
        </div>

        {repairDraft.submitted ? (
          <div className="flex flex-wrap gap-2">
            <StatusChip tone="positive">Submitted</StatusChip>
            <Button variant="secondary" onClick={() => setTenantView("home")}>
              Back to home
            </Button>
          </div>
        ) : (
          <Button disabled={!canSubmit} onClick={submitRepair}>
            Submit repair request
          </Button>
        )}
      </div>
    </div>
  );
}

export function TenantTimeline() {
  const { timeline, setTenantView, decisionStatus } = useDemo();

  return (
    <div className="space-y-5">
      <header className="fade-in">
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)]"
          onClick={() => setTenantView("home")}
        >
          ← Back to home
        </button>
        <h1 className="display mt-2 text-3xl font-semibold">
          Maintenance status
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Kitchen faucet drip · shared with owner & manager
        </p>
      </header>

      <div className="fade-in-delay-1 panel p-5">
        <ol className="timeline-rail relative space-y-5 pl-8">
          {timeline.map((step) => (
            <li key={step.label} className="relative">
              <span
                className={`absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[0.65rem] font-bold ${
                  step.done
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line-strong)] bg-white text-[var(--muted)]"
                }`}
              >
                {step.done ? "✓" : ""}
              </span>
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{step.detail}</p>
              {step.at && (
                <p className="mt-1 text-xs text-[var(--muted)]">{step.at}</p>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-[var(--muted)]">
          Current owner decision:{" "}
          <span className="font-semibold capitalize text-[var(--ink-soft)]">
            {decisionStatus}
          </span>
        </p>
      </div>
    </div>
  );
}

export function TenantPay() {
  const { setTenantView } = useDemo();
  return (
    <div className="space-y-5">
      <header className="fade-in">
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)]"
          onClick={() => setTenantView("home")}
        >
          ← Back to home
        </button>
        <h1 className="display mt-2 text-3xl font-semibold">Pay rent</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Demo only — payments would use a hosted provider in production.
        </p>
      </header>
      <div className="fade-in-delay-1 panel p-5">
        <p className="text-sm text-[var(--muted)]">Balance due Dec 1</p>
        <p className="money mt-1 text-4xl font-semibold">
          {formatMoney(PROPERTY.monthlyRent)}
        </p>
        <Button className="mt-5" disabled>
          Pay securely (demo)
        </Button>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Autopay and receipts ship in the production MVP — not this Sites-style
          demo.
        </p>
      </div>
    </div>
  );
}

export function TenantMessage() {
  const { setTenantView } = useDemo();
  return (
    <div className="space-y-5">
      <header className="fade-in">
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)]"
          onClick={() => setTenantView("home")}
        >
          ← Back to home
        </button>
        <h1 className="display mt-2 text-3xl font-semibold">Messages</h1>
      </header>
      <div className="fade-in-delay-1 panel space-y-3 p-5">
        <div className="rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm">
          <p className="font-semibold">Beachy Property Partners</p>
          <p className="mt-1 text-[var(--muted)]">
            Thanks for the faucet photos — we sent the quote to your owner for
            approval. We’ll update you when it’s scheduled.
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">Nov 17 · 9:24 AM</p>
        </div>
        <textarea
          className="w-full rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          rows={3}
          placeholder="Write a message…"
        />
        <Button variant="secondary">Send (demo)</Button>
      </div>
      <IllustPhoto caption="Property context stays attached to the thread" variant="fan" />
    </div>
  );
}
