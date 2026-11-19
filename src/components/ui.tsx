"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] shadow-[var(--shadow-lift)]",
    secondary:
      "bg-white text-[var(--ink)] border border-[var(--line-strong)] hover:bg-[var(--surface-2)]",
    ghost: "bg-transparent text-[var(--ink-soft)] hover:bg-black/5",
    danger:
      "bg-[var(--danger-soft)] text-[var(--danger)] hover:brightness-95",
    soft: "bg-[var(--accent-soft)] text-[var(--accent-deep)] hover:brightness-95",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
      {children}
    </p>
  );
}

export function StatusChip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "positive" | "warn" | "accent";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-black/5 text-[var(--ink-soft)]",
    positive: "bg-[var(--positive-soft)] text-[var(--positive)]",
    warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent-deep)]",
  };
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function IllustPhoto({
  caption,
  variant = "drip",
}: {
  caption: string;
  variant?: "drip" | "base" | "fan";
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[#d9e4ea]">
      <div
        className="relative aspect-[4/3] overflow-hidden"
        aria-hidden
        style={{
          background:
            variant === "drip"
              ? "linear-gradient(160deg,#9fb4c0 0%,#6f8a97 40%,#415868 100%)"
              : variant === "base"
                ? "linear-gradient(160deg,#b7c4cb 0%,#7f939e 45%,#4a5d69 100%)"
                : "linear-gradient(160deg,#c5d0d6 0%,#8fa0aa 50%,#556774 100%)",
        }}
      >
        <svg
          viewBox="0 0 160 120"
          className="absolute inset-0 h-full w-full opacity-90"
        >
          {variant === "drip" && (
            <>
              <rect x="58" y="18" width="44" height="10" rx="3" fill="#e8eef2" />
              <path
                d="M80 28 v42"
                stroke="#e8eef2"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M62 70 h36"
                stroke="#e8eef2"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <circle cx="80" cy="88" r="4" fill="#9fd7ff" opacity="0.9">
                <animate
                  attributeName="cy"
                  values="82;96;82"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.9;0.2;0.9"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}
          {variant === "base" && (
            <>
              <rect x="40" y="70" width="80" height="18" rx="4" fill="#d7e0e6" />
              <rect x="70" y="34" width="20" height="40" rx="4" fill="#eef3f6" />
              <circle cx="80" cy="30" r="10" fill="#cfd8de" />
              <path
                d="M48 84 h64"
                stroke="#8a5a3a"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.55"
              />
            </>
          )}
          {variant === "fan" && (
            <>
              <rect x="55" y="28" width="50" height="42" rx="8" fill="#e8eef2" />
              <circle cx="80" cy="49" r="10" fill="#9aaeb8" />
              <path
                d="M80 49 L98 38 M80 49 L98 60 M80 49 L62 38 M80 49 L62 60"
                stroke="#c5d2d9"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
        <div className="hero-sheen" />
      </div>
      <figcaption className="px-3 py-2 text-xs text-[var(--muted)]">
        {caption}
      </figcaption>
    </figure>
  );
}
