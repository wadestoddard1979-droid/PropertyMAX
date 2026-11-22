"use client";

import { useMemo, useState } from "react";
import {
  previewIntake,
  submitIntake,
  moneyFromCents,
} from "@/lib/api-client";
import type {
  IntakeAnswers,
  IntakeClassification,
  Property,
} from "@/lib/types";
import { Button, SectionLabel, StatusChip } from "@/components/ui";

type Step =
  | "summary"
  | "location"
  | "safety"
  | "photos"
  | "review"
  | "done";

const STEPS: Step[] = ["summary", "location", "safety", "photos", "review"];

export default function MaintenanceIntake({
  property,
  onCancel,
  onCreated,
}: {
  property: Property;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [step, setStep] = useState<Step>("summary");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    classification: IntakeClassification;
    trace: { step: string; detail: string }[];
  } | null>(null);
  const [answers, setAnswers] = useState<IntakeAnswers>({
    summary: "",
    location: "",
    flooding: "no",
    waterShutoffKnown: "na",
    electricityHazard: "no",
    smellGas: "no",
    canUseHome: "yes",
    photoNotes: "",
    freeText: "",
  });

  const stepIndex = STEPS.indexOf(step === "done" ? "review" : step);

  const examples = useMemo(
    () => [
      {
        label: "Kitchen drip",
        fill: {
          summary: "Kitchen faucet keeps dripping overnight",
          location: "Kitchen sink",
          flooding: "no" as const,
          waterShutoffKnown: "yes" as const,
          electricityHazard: "no" as const,
          smellGas: "no" as const,
          canUseHome: "yes" as const,
          photoNotes: "Photo of drip under spout (illustrative)",
          freeText: "Started this week after using the sprayer.",
        },
      },
      {
        label: "Active flooding",
        fill: {
          summary: "Water pouring from under the bathroom vanity",
          location: "Hall bathroom",
          flooding: "yes" as const,
          waterShutoffKnown: "yes" as const,
          electricityHazard: "unsure" as const,
          smellGas: "no" as const,
          canUseHome: "partially" as const,
          photoNotes: "Floor getting wet near outlet",
          freeText: "I can hear water running in the wall.",
        },
      },
    ],
    [],
  );

  async function runPreview() {
    setBusy(true);
    setErr(null);
    try {
      const res = await previewIntake(answers);
      setPreview({ classification: res.classification, trace: res.trace });
      setStep("review");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Classify failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await submitIntake({
        propertyId: property.id,
        answers,
      });
      if (res.classification && res.audit) {
        setPreview({
          classification: res.audit.classification,
          trace: res.audit.trace,
        });
      }
      setStep("done");
      onCreated(res.workOrder.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in space-y-5">
      <button
        type="button"
        className="text-sm font-medium text-[var(--accent)]"
        onClick={onCancel}
      >
        ← Back
      </button>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>AI maintenance intake</SectionLabel>
          <h1 className="display mt-1 text-3xl font-semibold">
            Tell us what&apos;s going on
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Guided questions for {property.name}. Classification is advisory —
            spend is never auto-authorized past your property policy.
          </p>
        </div>
        <StatusChip tone="warn">Recommend only · no auto-spend</StatusChip>
      </header>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              i <= stepIndex
                ? "bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                : "bg-[var(--surface-2)] text-[var(--muted)]"
            }`}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="rounded-full border border-[var(--line-strong)] bg-white px-3 py-1.5 text-xs font-medium"
            onClick={() => {
              setAnswers(ex.fill);
              setPreview(null);
              setStep("summary");
            }}
          >
            Example: {ex.label}
          </button>
        ))}
      </div>

      {err && (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {err}
        </p>
      )}

      {step === "summary" && (
        <section className="panel space-y-4 p-5">
          <SectionLabel>What happened?</SectionLabel>
          <textarea
            className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            rows={3}
            placeholder="Short description (e.g. kitchen faucet dripping)"
            value={answers.summary}
            onChange={(e) =>
              setAnswers({ ...answers, summary: e.target.value })
            }
          />
          <textarea
            className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            rows={2}
            placeholder="Anything else we should know?"
            value={answers.freeText}
            onChange={(e) =>
              setAnswers({ ...answers, freeText: e.target.value })
            }
          />
          <Button
            disabled={answers.summary.trim().length < 3}
            onClick={() => setStep("location")}
          >
            Continue
          </Button>
        </section>
      )}

      {step === "location" && (
        <section className="panel space-y-4 p-5">
          <SectionLabel>Where is the issue?</SectionLabel>
          <input
            className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            placeholder="Kitchen, hall bath, water heater closet…"
            value={answers.location}
            onChange={(e) =>
              setAnswers({ ...answers, location: e.target.value })
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep("summary")}>
              Back
            </Button>
            <Button onClick={() => setStep("safety")}>Continue</Button>
          </div>
        </section>
      )}

      {step === "safety" && (
        <section className="panel space-y-4 p-5">
          <SectionLabel>Safety checks</SectionLabel>
          <Choice
            label="Is there active flooding?"
            value={answers.flooding}
            options={[
              ["yes", "Yes"],
              ["no", "No"],
              ["unsure", "Unsure"],
            ]}
            onChange={(v) =>
              setAnswers({
                ...answers,
                flooding: v as IntakeAnswers["flooding"],
              })
            }
          />
          <Choice
            label="Do you know where the water shutoff is?"
            value={answers.waterShutoffKnown}
            options={[
              ["yes", "Yes"],
              ["no", "No"],
              ["na", "N/A"],
            ]}
            onChange={(v) =>
              setAnswers({
                ...answers,
                waterShutoffKnown: v as IntakeAnswers["waterShutoffKnown"],
              })
            }
          />
          <Choice
            label="Any electrical hazard (sparks, wet outlets)?"
            value={answers.electricityHazard}
            options={[
              ["yes", "Yes"],
              ["no", "No"],
              ["unsure", "Unsure"],
            ]}
            onChange={(v) =>
              setAnswers({
                ...answers,
                electricityHazard: v as IntakeAnswers["electricityHazard"],
              })
            }
          />
          <Choice
            label="Do you smell gas?"
            value={answers.smellGas}
            options={[
              ["yes", "Yes"],
              ["no", "No"],
            ]}
            onChange={(v) =>
              setAnswers({
                ...answers,
                smellGas: v as IntakeAnswers["smellGas"],
              })
            }
          />
          <Choice
            label="Can you safely use the home?"
            value={answers.canUseHome}
            options={[
              ["yes", "Yes"],
              ["partially", "Partially"],
              ["no", "No"],
            ]}
            onChange={(v) =>
              setAnswers({
                ...answers,
                canUseHome: v as IntakeAnswers["canUseHome"],
              })
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep("location")}>
              Back
            </Button>
            <Button onClick={() => setStep("photos")}>Continue</Button>
          </div>
        </section>
      )}

      {step === "photos" && (
        <section className="panel space-y-4 p-5">
          <SectionLabel>Photos</SectionLabel>
          <p className="text-sm text-[var(--muted)]">
            Phase 2 pilot stores photo notes as metadata (upload to Storage when
            Supabase is configured). Describe what a photo would show.
          </p>
          <textarea
            className="w-full rounded-xl border border-[var(--line-strong)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            rows={3}
            placeholder="e.g. Close-up of drip under kitchen spout"
            value={answers.photoNotes}
            onChange={(e) =>
              setAnswers({ ...answers, photoNotes: e.target.value })
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep("safety")}>
              Back
            </Button>
            <Button disabled={busy} onClick={runPreview}>
              Classify & review
            </Button>
          </div>
        </section>
      )}

      {(step === "review" || step === "done") && preview && (
        <section className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Classification (advisory)</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <StatusChip tone="accent">
                {preview.classification.category}
              </StatusChip>
              <StatusChip
                tone={
                  preview.classification.emergency ? "warn" : "neutral"
                }
              >
                {preview.classification.urgency}
                {preview.classification.emergency ? " · emergency" : ""}
              </StatusChip>
              <StatusChip tone="neutral">
                {Math.round(preview.classification.confidence * 100)}% ·{" "}
                {preview.classification.engine}
              </StatusChip>
            </div>
          </div>
          <p className="rounded-xl bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--warn)]">
            Hard rule: <strong>spendAuthorized = false</strong>. Suggested band{" "}
            {preview.classification.suggestedEstimateBandCents
              ? `${moneyFromCents(preview.classification.suggestedEstimateBandCents.min)}–${moneyFromCents(preview.classification.suggestedEstimateBandCents.max)}`
              : "n/a"}{" "}
            is for humans only — never auto-applied.
          </p>
          <p className="text-sm text-[var(--ink-soft)]">
            {preview.classification.recommendedNextStep}
          </p>
          <ul className="space-y-1 text-sm text-[var(--muted)]">
            {preview.classification.rationale.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
          <div>
            <SectionLabel>Decision trace</SectionLabel>
            <ol className="timeline-rail relative mt-3 space-y-3 pl-8">
              {preview.trace.map((t, i) => (
                <li key={`${t.step}-${i}`} className="relative">
                  <span className="absolute -left-8 top-1 h-5 w-5 rounded-full border-2 border-[var(--accent)] bg-[var(--accent)]" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {t.step}
                  </p>
                  <p className="text-sm text-[var(--ink-soft)]">{t.detail}</p>
                </li>
              ))}
            </ol>
          </div>
          {step === "review" && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
              <Button variant="secondary" onClick={() => setStep("photos")}>
                Back
              </Button>
              <Button disabled={busy} onClick={submit}>
                Create work order
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              value === v
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--line)]"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
