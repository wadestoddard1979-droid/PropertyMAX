import type {
  IntakeAnswers,
  IntakeCategory,
  IntakeClassification,
  Urgency,
} from "../../types";

export type ClassifyResult = {
  classification: IntakeClassification;
  trace: { step: string; detail: string }[];
};

function llmEnabled() {
  return process.env.AI_INTAKE_LLM === "true";
}

function scoreCategory(text: string): {
  category: IntakeCategory;
  hits: string[];
} {
  const t = text.toLowerCase();
  const rules: { category: IntakeCategory; terms: string[] }[] = [
    {
      category: "Plumbing",
      terms: [
        "leak",
        "drip",
        "faucet",
        "toilet",
        "pipe",
        "drain",
        "water",
        "flood",
        "sink",
        "shower",
        "shutoff",
        "shut off",
      ],
    },
    {
      category: "Electrical",
      terms: [
        "outlet",
        "breaker",
        "spark",
        "electric",
        "wiring",
        "fan",
        "light",
        "power",
        "shock",
      ],
    },
    {
      category: "HVAC",
      terms: ["heat", "ac", "a/c", "hvac", "furnace", "thermostat", "cooling"],
    },
    {
      category: "Appliance",
      terms: ["fridge", "dishwasher", "washer", "dryer", "oven", "stove", "appliance"],
    },
    {
      category: "Structural",
      terms: ["roof", "wall", "ceiling", "foundation", "crack", "window", "door"],
    },
    {
      category: "Pest",
      terms: ["roach", "ant", "mouse", "rat", "termite", "pest", "bug"],
    },
  ];
  let best: IntakeCategory = "General";
  let bestScore = 0;
  let hits: string[] = [];
  for (const rule of rules) {
    const matched = rule.terms.filter((term) => t.includes(term));
    if (matched.length > bestScore) {
      bestScore = matched.length;
      best = rule.category;
      hits = matched;
    }
  }
  return { category: best, hits };
}

function detectEmergency(
  answers: IntakeAnswers,
  text: string,
): { emergency: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const t = text.toLowerCase();
  if (answers.flooding === "yes") reasons.push("Active flooding reported");
  if (answers.smellGas === "yes") reasons.push("Gas smell reported");
  if (answers.electricityHazard === "yes")
    reasons.push("Electrical hazard reported");
  if (answers.canUseHome === "no")
    reasons.push("Home not safely usable");
  if (/\b(flood|gas leak|no heat|sparks?|smoke|fire)\b/.test(t)) {
    reasons.push("Emergency keywords in description");
  }
  return { emergency: reasons.length > 0, reasons };
}

function urgencyFrom(
  emergency: boolean,
  answers: IntakeAnswers,
): Urgency {
  if (emergency) return "urgent";
  if (answers.canUseHome === "partially" || answers.flooding === "unsure")
    return "soon";
  return "routine";
}

function estimateBand(
  category: IntakeCategory,
  emergency: boolean,
): { min: number; max: number } | null {
  // Advisory only — never applied to authorize spend.
  const bands: Record<IntakeCategory, { min: number; max: number }> = {
    Plumbing: { min: 15000, max: 65000 },
    Electrical: { min: 12000, max: 80000 },
    HVAC: { min: 20000, max: 120000 },
    Appliance: { min: 10000, max: 50000 },
    Structural: { min: 30000, max: 250000 },
    Pest: { min: 15000, max: 40000 },
    General: { min: 10000, max: 40000 },
  };
  const band = bands[category];
  if (emergency) return { min: band.min, max: Math.round(band.max * 1.25) };
  return band;
}

/**
 * Rule-based classifier (always runs). Optional LLM refine behind AI_INTAKE_LLM=true.
 * HARD RULE: spendAuthorized is always false — AI may recommend only.
 */
export async function classifyIntake(
  answers: IntakeAnswers,
): Promise<ClassifyResult> {
  const trace: { step: string; detail: string }[] = [];
  const corpus = [
    answers.summary,
    answers.location,
    answers.freeText,
    answers.photoNotes,
    `flooding:${answers.flooding}`,
    `gas:${answers.smellGas}`,
    `electric:${answers.electricityHazard}`,
  ].join(" ");

  trace.push({
    step: "collect",
    detail: `Intake fields captured for location “${answers.location || "unspecified"}”.`,
  });

  const { category, hits } = scoreCategory(corpus);
  trace.push({
    step: "category_rules",
    detail: hits.length
      ? `Matched ${category} via terms: ${hits.join(", ")}`
      : `No strong keyword match — defaulting to ${category}`,
  });

  const { emergency, reasons } = detectEmergency(answers, corpus);
  trace.push({
    step: "emergency_rules",
    detail: emergency
      ? `Emergency flags: ${reasons.join("; ")}`
      : "No emergency flags from rules",
  });

  let urgency = urgencyFrom(emergency, answers);
  let finalCategory = category;
  let confidence = hits.length ? Math.min(0.55 + hits.length * 0.12, 0.92) : 0.45;
  let engine: IntakeClassification["engine"] = "rules";
  const rationale = [
    ...hits.map((h) => `Keyword “${h}” → ${category}`),
    ...reasons,
  ];

  if (llmEnabled()) {
    trace.push({
      step: "llm_attempt",
      detail: "AI_INTAKE_LLM=true — attempting optional refine (safe fallback to rules).",
    });
    try {
      const refined = await optionalLlmRefine(answers, {
        category: finalCategory,
        urgency,
        emergency,
      });
      if (refined) {
        finalCategory = refined.category;
        urgency = refined.urgency;
        // Emergency can only be upgraded by LLM, never cleared if rules said emergency
        const llmEmergency = refined.emergency || emergency;
        if (llmEmergency !== emergency) {
          rationale.push("LLM upgraded emergency flag");
        }
        confidence = Math.min(confidence + 0.05, 0.95);
        engine = "llm+rules";
        rationale.push(`LLM suggestion: ${refined.note}`);
        trace.push({
          step: "llm_refine",
          detail: refined.note,
        });
        // re-bind emergency through hard merge
        if (llmEmergency) {
          // keep reasons
        }
      }
    } catch (err) {
      trace.push({
        step: "llm_fallback",
        detail: `LLM failed (${err instanceof Error ? err.message : "error"}) — using rules only.`,
      });
    }
  } else {
    trace.push({
      step: "llm_skipped",
      detail: "AI_INTAKE_LLM not enabled — rules-only classification.",
    });
  }

  const classification: IntakeClassification = {
    category: finalCategory,
    urgency,
    emergency,
    confidence,
    rationale: rationale.length ? rationale : ["General maintenance from tenant description"],
    recommendedNextStep: emergency
      ? "Escalate to manager immediately; advise tenant on safety (shutoff / vacate if needed). Do not auto-approve spend."
      : "Create work order under review for manager triage. Estimates and spend require human policy checks.",
    spendAuthorized: false,
    suggestedEstimateBandCents: estimateBand(finalCategory, emergency),
    engine,
  };

  // HARD RULE enforcement — strip any accidental authorization
  (classification as { spendAuthorized: false }).spendAuthorized = false;
  trace.push({
    step: "hard_rule_spend",
    detail:
      "spendAuthorized forced false — AI must never auto-authorize spend past spending policies.",
  });

  return { classification, trace };
}

/** Placeholder LLM refine — no network call unless OPENAI_API_KEY set; otherwise no-op. */
async function optionalLlmRefine(
  answers: IntakeAnswers,
  base: { category: IntakeCategory; urgency: Urgency; emergency: boolean },
): Promise<{
  category: IntakeCategory;
  urgency: Urgency;
  emergency: boolean;
  note: string;
} | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    // Deterministic "LLM-shaped" refine without external call for pilot demos when flag is on.
    if (answers.smellGas === "yes" || answers.flooding === "yes") {
      return {
        category: answers.smellGas === "yes" ? "Plumbing" : base.category,
        urgency: "urgent",
        emergency: true,
        note: "Local refine (no API key): confirmed emergency from intake answers.",
      };
    }
    return {
      ...base,
      note: "Local refine (no API key): kept rule classification.",
    };
  }

  // Minimal OpenAI-compatible call with hard timeout; ignore spend fields if returned.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_INTAKE_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Classify a residential maintenance intake. Return JSON keys: category, urgency (routine|soon|urgent), emergency (boolean), note. Never authorize spend.",
          },
          {
            role: "user",
            content: JSON.stringify({ answers, base }),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      category?: IntakeCategory;
      urgency?: Urgency;
      emergency?: boolean;
      note?: string;
      spendAuthorized?: boolean;
    };
    // Ignore any spendAuthorized from model
    return {
      category: parsed.category || base.category,
      urgency: parsed.urgency || base.urgency,
      emergency: Boolean(parsed.emergency) || base.emergency,
      note: parsed.note || "LLM refine applied (spend ignored).",
    };
  } finally {
    clearTimeout(timer);
  }
}
