"use client";

import { useCallback, useEffect, useState } from "react";
import {
  askFaq,
  fetchPayments,
  moneyFromCents,
  startRentCheckout,
  completeDemoCheckout,
  setAutopayEnrollment,
} from "@/lib/api-client";
import type {
  AutopayEnrollment,
  PaymentRef,
  Property,
  SessionUser,
  VerifiedFaq,
} from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

type Props = {
  user: SessionUser;
  property: Property;
  onBack: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
};

export default function TenantPayments({
  user,
  property,
  onBack,
  onToast,
  onError,
}: Props) {
  const [payments, setPayments] = useState<PaymentRef[]>([]);
  const [autopay, setAutopay] = useState<AutopayEnrollment[]>([]);
  const [mode, setMode] = useState<"demo" | "stripe">("demo");
  const [busy, setBusy] = useState(false);
  const [pendingDemoId, setPendingDemoId] = useState<string | null>(null);
  const [faqText, setFaqText] = useState("");
  const [faqReply, setFaqReply] = useState<{
    kind: string;
    reply: string;
    faq: VerifiedFaq | null;
    reasons: string[];
  } | null>(null);
  const month = new Date().toISOString().slice(0, 7);
  const amountCents = Math.round(property.monthlyRent * 100);

  const refresh = useCallback(async () => {
    const data = await fetchPayments();
    setPayments(data.payments);
    setAutopay(data.autopay);
    setMode(data.mode);
  }, []);

  useEffect(() => {
    refresh().catch((e) =>
      onError(e instanceof Error ? e.message : "Failed to load payments"),
    );
  }, [refresh, onError]);

  const enrollment = autopay.find(
    (a) => a.propertyId === property.id && a.tenantUserId === user.id,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>Tenant payments</SectionLabel>
          <h1 className="display mt-1 text-2xl font-semibold">
            Rent · {property.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Hosted checkout only — PropertMax stores payment references, never
            card numbers.
          </p>
        </div>
        <Button variant="soft" onClick={onBack}>
          Back
        </Button>
      </div>

      {mode === "demo" && (
        <div className="rounded-[var(--radius)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <strong>DEMO MODE</strong> — Stripe keys are not set. Checkout
          success is simulated and clearly labeled. No real charges.
        </div>
      )}

      <section className="panel space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">Amount due</p>
            <p className="display text-3xl font-semibold">
              {moneyFromCents(amountCents)}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Period {month} · provider {mode}
            </p>
          </div>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await startRentCheckout({
                  propertyId: property.id,
                  month,
                  amountCents,
                  origin: window.location.origin,
                });
                if (res.mode === "stripe" && res.url) {
                  onToast("Redirecting to Stripe Checkout…");
                  window.location.href = res.url;
                  return;
                }
                setPendingDemoId(res.paymentId);
                onToast("Demo checkout opened — simulate success below");
                await refresh();
              } catch (e) {
                onError(e instanceof Error ? e.message : "Checkout failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode === "stripe" ? "Pay with Stripe Checkout" : "Start demo checkout"}
          </Button>
        </div>

        {pendingDemoId && mode === "demo" && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-[var(--surface-2)] px-4 py-4">
            <p className="text-sm font-semibold">
              Simulate hosted pay success
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Payment ref {pendingDemoId} · labeled DEMO — not a real charge
            </p>
            <Button
              className="mt-3"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await completeDemoCheckout(pendingDemoId);
                  setPendingDemoId(null);
                  onToast("DEMO payment recorded (payment_ref only)");
                  await refresh();
                } catch (e) {
                  onError(e instanceof Error ? e.message : "Demo pay failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Mark DEMO checkout paid
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
          <div className="flex-1">
            <p className="text-sm font-semibold">Autopay enrollment (stub)</p>
            <p className="text-sm text-[var(--muted)]">
              Records intent only — no card vault, no Stripe mandate in pilot.
            </p>
          </div>
          <Button
            variant="soft"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setAutopayEnrollment({
                  propertyId: property.id,
                  enabled: !enrollment?.enabled,
                  dayOfMonth: 1,
                });
                onToast(
                  enrollment?.enabled
                    ? "Autopay stub disabled"
                    : "Autopay stub enabled",
                );
                await refresh();
              } catch (e) {
                onError(e instanceof Error ? e.message : "Autopay failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {enrollment?.enabled ? "Disable autopay stub" : "Enable autopay stub"}
          </Button>
          {enrollment && (
            <StatusChip tone={enrollment.enabled ? "positive" : "accent"}>
              {enrollment.enabled ? "Enrolled (stub)" : "Off"} · day{" "}
              {enrollment.dayOfMonth}
            </StatusChip>
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="display text-lg font-semibold">Payment references</h2>
          <p className="text-sm text-[var(--muted)]">
            Status + external ids only — never card data
          </p>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {payments.length === 0 && (
            <li className="px-5 py-6 text-sm text-[var(--muted)]">
              No payments yet.
            </li>
          )}
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
            >
              <div>
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {moneyFromCents(p.amountCents)} · {p.provider}
                  {p.provider === "demo" ? " · DEMO" : ""} ·{" "}
                  {p.externalId || "no external id"}
                </p>
              </div>
              <StatusChip
                tone={
                  p.status === "paid"
                    ? "positive"
                    : p.status === "failed"
                      ? "warn"
                      : "accent"
                }
              >
                {p.status}
              </StatusChip>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel space-y-3 px-5 py-5">
        <h2 className="display text-lg font-semibold">Ask a verified FAQ</h2>
        <p className="text-sm text-[var(--muted)]">
          Routine answers from verified docs. Legal, disputes, and safety
          escalate to a human.
        </p>
        <textarea
          className="w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          rows={3}
          value={faqText}
          onChange={(e) => setFaqText(e.target.value)}
          placeholder="e.g. When is rent due? / trash day / I have a legal dispute…"
        />
        <Button
          disabled={busy || !faqText.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await askFaq(faqText.trim());
              setFaqReply(res);
              if (res.kind === "escalated") {
                onToast("Escalated to human — no auto policy reply");
              }
            } catch (e) {
              onError(e instanceof Error ? e.message : "FAQ failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Ask
        </Button>
        {faqReply && (
          <div
            className={`rounded-[var(--radius)] px-4 py-3 text-sm ${
              faqReply.kind === "escalated"
                ? "border border-amber-500/40 bg-amber-500/10"
                : "bg-[var(--surface-2)]"
            }`}
          >
            <p className="font-semibold capitalize">{faqReply.kind}</p>
            <p className="mt-1">{faqReply.reply}</p>
            {faqReply.reasons?.length > 0 && (
              <p className="mt-2 text-[var(--muted)]">
                {faqReply.reasons.join(" · ")}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
