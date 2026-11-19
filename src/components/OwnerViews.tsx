"use client";

import {
  CASH_FLOW,
  FAUCET_DECISION,
  PROPERTY,
  PROJECTION,
  computeCashFlow,
  formatMoney,
  formatMoneySigned,
} from "@/lib/demo-data";
import { useDemo } from "@/lib/demo-store";
import { Button, IllustPhoto, SectionLabel, StatusChip } from "./ui";
import { useState } from "react";

export function OwnerHome() {
  const { decisionStatus, setOwnerView } = useDemo();
  const cash = computeCashFlow();

  return (
    <div className="space-y-5">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel>Owner home</SectionLabel>
          <h1 className="display mt-1 text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            {PROPERTY.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {PROPERTY.type} · {PROPERTY.beds} bed · {PROPERTY.baths} bath ·{" "}
            {PROPERTY.sqft.toLocaleString()} sq ft
          </p>
        </div>
        <StatusChip tone="positive">
          <span className="pulse-dot" />
          {PROPERTY.occupancy}
        </StatusChip>
      </header>

      <div className="fade-in-delay-1 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Monthly rent"
          value={formatMoney(PROPERTY.monthlyRent)}
          hint="Illustrative · lease rate"
        />
        <Metric
          label="Est. monthly cash flow"
          value={formatMoneySigned(PROPERTY.estimatedCashFlow)}
          hint="After ops + mortgage"
          emphasize
        />
        <Metric
          label="Lease ends"
          value={PROPERTY.leaseEnd}
          hint={PROPERTY.tenantName}
          plain
        />
      </div>

      <section className="fade-in-delay-2 panel overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <SectionLabel>Needs your decision</SectionLabel>
            <h2 className="display mt-1 text-xl font-semibold">
              {decisionStatus === "pending"
                ? "One item waiting on you"
                : "Decision recorded"}
            </h2>
          </div>
          <StatusChip
            tone={
              decisionStatus === "pending"
                ? "warn"
                : decisionStatus === "approved"
                  ? "positive"
                  : decisionStatus === "asked"
                    ? "accent"
                    : "neutral"
            }
          >
            {decisionStatus === "pending"
              ? "Pending"
              : decisionStatus === "approved"
                ? "Approved"
                : decisionStatus === "asked"
                  ? "Question sent"
                  : "Declined"}
          </StatusChip>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">
              {FAUCET_DECISION.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {FAUCET_DECISION.summary}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              {FAUCET_DECISION.recommendation}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Quote</dt>
                <dd className="money text-lg font-semibold">
                  {formatMoney(FAUCET_DECISION.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Contractor</dt>
                <dd className="font-medium">{FAUCET_DECISION.contractor}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[var(--muted)]">ETA if approved</dt>
                <dd className="font-medium">{FAUCET_DECISION.eta}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {decisionStatus === "pending" ? (
                <Button onClick={() => setOwnerView("decision")}>
                  Review decision
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setOwnerView("decision")}
                >
                  View thread
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setOwnerView("financials")}
              >
                See financials
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <IllustPhoto
              caption={FAUCET_DECISION.photos[0].caption}
              variant="drip"
            />
            <IllustPhoto
              caption={FAUCET_DECISION.photos[1].caption}
              variant="base"
            />
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setOwnerView("financials")}
        className="fade-in-delay-3 panel flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:border-[var(--accent)]/30"
      >
        <div>
          <SectionLabel>Cash flow snapshot</SectionLabel>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Rent {formatMoney(cash.rent)} − expenses {formatMoney(cash.expenses)}{" "}
            ={" "}
            <span className="font-semibold text-[var(--positive)]">
              {formatMoneySigned(cash.estimatedCashFlow)}
            </span>{" "}
            estimated this month
          </p>
        </div>
        <span className="text-sm font-semibold text-[var(--accent)]">
          Open →
        </span>
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  emphasize,
  plain,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
  plain?: boolean;
}) {
  return (
    <div className="panel px-4 py-4">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p
        className={`mt-1 ${plain ? "display text-xl font-semibold" : "money text-2xl font-semibold"} ${
          emphasize ? "text-[var(--positive)]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export function OwnerFinancials() {
  const { setOwnerView } = useDemo();
  const cash = computeCashFlow();
  const maxBar = Math.max(...PROJECTION.map((p) => p.cashFlow));
  const yearTotal = PROJECTION.reduce((sum, p) => sum + p.cashFlow, 0);

  const rows = [
    { label: "Rent collected", amount: CASH_FLOW.rent, tone: "pos" as const },
    { label: "Property management fee", amount: -CASH_FLOW.pmFees },
    { label: "Maintenance reserve", amount: -CASH_FLOW.maintenanceReserve },
    { label: "Insurance", amount: -CASH_FLOW.insurance },
    { label: "Property taxes (monthly)", amount: -CASH_FLOW.taxes },
    { label: "HOA", amount: -CASH_FLOW.hoa },
    { label: "Owner utilities", amount: -CASH_FLOW.utilitiesOwner },
    { label: "Mortgage", amount: -CASH_FLOW.mortgage },
  ];

  return (
    <div className="space-y-5">
      <header className="fade-in flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-sm font-medium text-[var(--accent)]"
            onClick={() => setOwnerView("home")}
          >
            ← Back to home
          </button>
          <h1 className="display mt-2 text-3xl font-semibold">Financials</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Plain-language cash flow for {PROPERTY.name}. Figures are
            illustrative demo data — not bank-verified.
          </p>
        </div>
        <StatusChip tone="accent">Illustrative</StatusChip>
      </header>

      <div className="fade-in-delay-1 panel p-5">
        <SectionLabel>This month</SectionLabel>
        <p className="money mt-2 text-4xl font-semibold text-[var(--positive)]">
          {formatMoneySigned(cash.estimatedCashFlow)}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Estimated cash flow after operating costs and mortgage
        </p>

        <ul className="mt-5 divide-y divide-[var(--line)]">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <span className="text-[var(--ink-soft)]">{row.label}</span>
              <span
                className={`money font-semibold ${
                  row.tone === "pos"
                    ? "text-[var(--positive)]"
                    : "text-[var(--ink)]"
                }`}
              >
                {row.amount > 0
                  ? formatMoney(row.amount)
                  : formatMoney(row.amount)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="font-semibold">Estimated cash flow</span>
            <span className="money text-lg font-semibold text-[var(--positive)]">
              {formatMoneySigned(cash.estimatedCashFlow)}
            </span>
          </li>
        </ul>
      </div>

      <div className="fade-in-delay-2 panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionLabel>12-month projection peek</SectionLabel>
            <h2 className="display mt-1 text-xl font-semibold">
              Next-year cash flow outlook
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Assumptions held flat except seasonal maintenance noise. Not a
              guarantee.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--muted)]">Projected 12-mo total</p>
            <p className="money text-2xl font-semibold text-[var(--positive)]">
              {formatMoneySigned(yearTotal)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex h-40 items-end gap-1.5 sm:gap-2">
          {PROJECTION.map((p) => (
            <div
              key={p.month}
              className="group flex flex-1 flex-col items-center gap-2"
            >
              <div
                className="w-full rounded-t-md bg-[var(--accent)]/80 transition group-hover:bg-[var(--accent)]"
                style={{ height: `${(p.cashFlow / maxBar) * 100}%` }}
                title={`${p.label}: ${formatMoneySigned(p.cashFlow)}`}
              />
              <span className="text-[0.65rem] text-[var(--muted)]">
                {p.month}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OwnerDecision() {
  const { decisionStatus, decisionNote, resolveDecision, setOwnerView } =
    useDemo();
  const [askOpen, setAskOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-5">
      <header className="fade-in">
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)]"
          onClick={() => setOwnerView("home")}
        >
          ← Back to home
        </button>
        <h1 className="display mt-2 text-3xl font-semibold">
          {FAUCET_DECISION.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Decision card · photos, quote, and clear choices
        </p>
      </header>

      <div className="fade-in-delay-1 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="accent">{FAUCET_DECISION.category}</StatusChip>
            <StatusChip tone="warn">
              {formatMoney(FAUCET_DECISION.amount)} quote
            </StatusChip>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]">
            {FAUCET_DECISION.summary}
          </p>
          <p className="mt-3 rounded-2xl bg-[var(--accent-soft)]/70 px-4 py-3 text-sm leading-relaxed text-[var(--accent-deep)]">
            {FAUCET_DECISION.recommendation}
          </p>

          <h3 className="mt-5 text-sm font-semibold">Quote breakdown</h3>
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {FAUCET_DECISION.quoteLineItems.map((item) => (
              <li
                key={item.label}
                className="flex justify-between gap-3 py-2 text-sm"
              >
                <span className="text-[var(--muted)]">{item.label}</span>
                <span className="money font-medium">
                  {formatMoney(item.amount)}
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-3 py-2.5 text-sm font-semibold">
              <span>Total</span>
              <span className="money">
                {formatMoney(FAUCET_DECISION.amount)}
              </span>
            </li>
          </ul>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2">
              <dt className="text-xs text-[var(--muted)]">Contractor</dt>
              <dd className="font-medium">{FAUCET_DECISION.contractor}</dd>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2">
              <dt className="text-xs text-[var(--muted)]">ETA</dt>
              <dd className="font-medium">{FAUCET_DECISION.eta}</dd>
            </div>
          </dl>

          {decisionStatus === "pending" ? (
            <div className="mt-6 space-y-3">
              {!askOpen && !declineOpen && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => resolveDecision("approved")}>
                    Approve ${FAUCET_DECISION.amount}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAskOpen(true);
                      setDeclineOpen(false);
                    }}
                  >
                    Ask a question
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDeclineOpen(true);
                      setAskOpen(false);
                    }}
                  >
                    Decline
                  </Button>
                </div>
              )}

              {askOpen && (
                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <p className="text-sm font-semibold">Ask your manager</p>
                  <textarea
                    className="mt-2 w-full rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    rows={3}
                    placeholder="e.g. Can we get a second quote, or is Moen the preferred spec?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() =>
                        resolveDecision(
                          "asked",
                          note || "Please clarify options before I approve.",
                        )
                      }
                    >
                      Send question
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setAskOpen(false);
                        setNote("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {declineOpen && (
                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <p className="text-sm font-semibold">Decline with reason</p>
                  <textarea
                    className="mt-2 w-full rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    rows={3}
                    placeholder="e.g. Hold until next month’s reserve is topped up."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="danger"
                      onClick={() =>
                        resolveDecision(
                          "declined",
                          note || "Declined for now.",
                        )
                      }
                    >
                      Confirm decline
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDeclineOpen(false);
                        setNote("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm">
              <p className="font-semibold capitalize">
                Status: {decisionStatus}
              </p>
              {decisionNote && (
                <p className="mt-1 text-[var(--muted)]">{decisionNote}</p>
              )}
            </div>
          )}
        </section>

        <aside className="fade-in-delay-2 space-y-3">
          <IllustPhoto
            caption={FAUCET_DECISION.photos[0].caption}
            variant="drip"
          />
          <IllustPhoto
            caption={FAUCET_DECISION.photos[1].caption}
            variant="base"
          />
          <p className="text-xs text-[var(--muted)]">
            Demo photos are illustrative placeholders for the kitchen faucet
            story.
          </p>
        </aside>
      </div>
    </div>
  );
}
