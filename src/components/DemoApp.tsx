"use client";

import { useEffect } from "react";
import { PROPERTY, type Role } from "@/lib/demo-data";
import { DemoProvider, useDemo } from "@/lib/demo-store";
import {
  OwnerDecision,
  OwnerFinancials,
  OwnerHome,
} from "./OwnerViews";
import {
  ManagerHome,
  ManagerThread,
} from "./ManagerViews";
import {
  TenantHome,
  TenantMessage,
  TenantPay,
  TenantRepair,
  TenantTimeline,
} from "./TenantViews";
import { Button, SectionLabel } from "./ui";

export default function DemoApp() {
  return (
    <DemoProvider>
      <DemoRoot />
    </DemoProvider>
  );
}

function DemoRoot() {
  const { entered, enterDemo } = useDemo();
  if (!entered) return <Landing onEnter={enterDemo} />;
  return <DemoShell />;
}

function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 townhouse-art opacity-[0.97]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,28,0.25)_0%,rgba(8,16,28,0.55)_45%,rgba(8,16,28,0.82)_100%)]" />
      <div className="hero-sheen opacity-40" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <p className="display text-lg font-semibold tracking-tight text-white sm:text-xl">
            PropertMax
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            Interactive demo
          </span>
        </div>

        <div className="fade-in flex flex-1 flex-col justify-end pb-10 pt-24 sm:pb-16 sm:pt-32">
          <p className="display text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl md:text-7xl">
            PropertMax
          </p>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            Property management that practically runs itself — humans decide
            what matters.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              className="bg-white text-[var(--ink)] hover:bg-white/90"
              onClick={onEnter}
            >
              Enter townhouse demo
            </Button>
            <p className="text-sm text-white/65">
              Owner · Manager · Tenant on one property
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function DemoShell() {
  const {
    role,
    setRole,
    ownerView,
    tenantView,
    managerView,
    toast,
    clearToast,
    resetDemo,
  } = useDemo();

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(clearToast, 3200);
    return () => window.clearTimeout(t);
  }, [toast, clearToast]);

  const roles: { id: Role; label: string }[] = [
    { id: "owner", label: "Owner" },
    { id: "manager", label: "Manager" },
    { id: "tenant", label: "Tenant" },
  ];

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[var(--demo-banner)] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <p className="display truncate text-sm font-semibold tracking-tight">
              PropertMax
            </p>
            <span className="hidden text-xs text-white/55 sm:inline">
              Illustrative demo · {PROPERTY.name}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white/10 p-1">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    role === r.id
                      ? "bg-white text-[var(--ink)]"
                      : "text-white/75 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={resetDemo}
              className="text-xs font-medium text-white/60 hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <header className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-4 pb-2 pt-6 sm:px-6">
        <div>
          <SectionLabel>
            {role === "owner"
              ? "Alex Rivera · Owner"
              : role === "manager"
                ? "Sam Chen · Manager"
                : "Jordan Ellis · Tenant"}
          </SectionLabel>
          <p className="mt-1 text-sm text-[var(--muted)]">{PROPERTY.address}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6">
        {role === "owner" && ownerView === "home" && <OwnerHome />}
        {role === "owner" && ownerView === "financials" && <OwnerFinancials />}
        {role === "owner" && ownerView === "decision" && <OwnerDecision />}
        {role === "tenant" && tenantView === "home" && <TenantHome />}
        {role === "tenant" && tenantView === "repair" && <TenantRepair />}
        {role === "tenant" && tenantView === "timeline" && <TenantTimeline />}
        {role === "tenant" && tenantView === "pay" && <TenantPay />}
        {role === "tenant" && tenantView === "message" && <TenantMessage />}
        {role === "manager" && managerView === "home" && <ManagerHome />}
        {role === "manager" && managerView === "thread" && <ManagerThread />}
      </main>

      {toast && (
        <div className="toast fixed bottom-5 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-lift)]">
          {toast}
        </div>
      )}
    </div>
  );
}
