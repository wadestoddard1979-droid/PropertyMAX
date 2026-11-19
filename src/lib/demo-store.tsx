"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  FAUCET_DECISION,
  INITIAL_TIMELINE,
  type DecisionStatus,
  type ManagerView,
  type OwnerView,
  type Role,
  type TenantView,
  type WorkOrderStatus,
} from "./demo-data";

export type TenantRepairDraft = {
  issue: string;
  details: string;
  urgency: "routine" | "soon" | "urgent";
  submitted: boolean;
};

export type AttentionItem = {
  id: string;
  priority: "high" | "medium";
  title: string;
  subtitle: string;
  kind: "approval" | "maintenance" | "message";
  linked: "faucet" | "new-repair" | null;
};

type DemoState = {
  role: Role;
  setRole: (role: Role) => void;
  ownerView: OwnerView;
  setOwnerView: (view: OwnerView) => void;
  tenantView: TenantView;
  setTenantView: (view: TenantView) => void;
  managerView: ManagerView;
  setManagerView: (view: ManagerView) => void;
  decisionStatus: DecisionStatus;
  decisionNote: string;
  resolveDecision: (status: Exclude<DecisionStatus, "pending">, note?: string) => void;
  timeline: typeof INITIAL_TIMELINE;
  workOrderStatus: WorkOrderStatus;
  repairDraft: TenantRepairDraft;
  updateRepairDraft: (patch: Partial<TenantRepairDraft>) => void;
  submitRepair: () => void;
  attentionItems: AttentionItem[];
  toast: string | null;
  clearToast: () => void;
  resetDemo: () => void;
  entered: boolean;
  enterDemo: () => void;
};

const DemoContext = createContext<DemoState | null>(null);

const defaultRepair: TenantRepairDraft = {
  issue: "",
  details: "",
  urgency: "routine",
  submitted: false,
};

function buildAttention(
  decisionStatus: DecisionStatus,
  repairSubmitted: boolean,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (decisionStatus === "pending") {
    items.push({
      id: "att-faucet",
      priority: "high",
      title: "Owner approval needed",
      subtitle: `${FAUCET_DECISION.title} · $${FAUCET_DECISION.amount}`,
      kind: "approval",
      linked: "faucet",
    });
  } else if (decisionStatus === "asked") {
    items.push({
      id: "att-faucet-ask",
      priority: "high",
      title: "Owner asked a question",
      subtitle: "Kitchen faucet quote — reply before scheduling",
      kind: "message",
      linked: "faucet",
    });
  } else if (decisionStatus === "approved") {
    items.push({
      id: "att-schedule",
      priority: "medium",
      title: "Schedule Beachy Plumbing",
      subtitle: "Faucet approved — book within 3 business days",
      kind: "maintenance",
      linked: "faucet",
    });
  }

  if (repairSubmitted) {
    items.push({
      id: "att-new-repair",
      priority: "high",
      title: "New tenant repair request",
      subtitle: "Bathroom exhaust fan rattling — needs triage",
      kind: "maintenance",
      linked: "new-repair",
    });
  }

  items.push({
    id: "att-lease",
    priority: "medium",
    title: "Lease renewal window opens in 90 days",
    subtitle: "847 Maple Lane · Aug 31, 2027 end date",
    kind: "message",
    linked: null,
  });

  return items;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(false);
  const [role, setRole] = useState<Role>("owner");
  const [ownerView, setOwnerView] = useState<OwnerView>("home");
  const [tenantView, setTenantView] = useState<TenantView>("home");
  const [managerView, setManagerView] = useState<ManagerView>("home");
  const [decisionStatus, setDecisionStatus] =
    useState<DecisionStatus>("pending");
  const [decisionNote, setDecisionNote] = useState("");
  const [timeline, setTimeline] = useState(INITIAL_TIMELINE);
  const [workOrderStatus, setWorkOrderStatus] =
    useState<WorkOrderStatus>("under_review");
  const [repairDraft, setRepairDraft] =
    useState<TenantRepairDraft>(defaultRepair);
  const [toast, setToast] = useState<string | null>(null);

  const clearToast = useCallback(() => setToast(null), []);
  const enterDemo = useCallback(() => setEntered(true), []);

  const updateRepairDraft = useCallback((patch: Partial<TenantRepairDraft>) => {
    setRepairDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const resolveDecision = useCallback(
    (status: Exclude<DecisionStatus, "pending">, note = "") => {
      setDecisionStatus(status);
      setDecisionNote(note);
      if (status === "approved") {
        setWorkOrderStatus("scheduled");
        setTimeline((prev) =>
          prev.map((step, i) => {
            if (i === 2) {
              return {
                ...step,
                label: "Owner approved",
                detail: "Quote approved. Contractor booking in progress.",
                at: "Just now",
                done: true,
              };
            }
            if (i === 3) {
              return {
                ...step,
                label: "Scheduled",
                detail: "Beachy Plumbing — tentative Thu window.",
                at: "Pending confirm",
                done: true,
              };
            }
            return step;
          }),
        );
        setToast("Approved — manager will schedule Beachy Plumbing.");
      } else if (status === "asked") {
        setToast("Question sent to your property manager.");
      } else {
        setTimeline((prev) =>
          prev.map((step, i) =>
            i === 2
              ? {
                  ...step,
                  label: "Owner declined",
                  detail: note || "Decline recorded. Manager will propose options.",
                  at: "Just now",
                  done: true,
                }
              : step,
          ),
        );
        setToast("Decline recorded with your note.");
      }
      setOwnerView("home");
    },
    [],
  );

  const submitRepair = useCallback(() => {
    setRepairDraft((prev) => ({ ...prev, submitted: true }));
    setTenantView("timeline");
    setToast("Repair request submitted — we’ll keep you updated.");
  }, []);

  const resetDemo = useCallback(() => {
    setRole("owner");
    setOwnerView("home");
    setTenantView("home");
    setManagerView("home");
    setDecisionStatus("pending");
    setDecisionNote("");
    setTimeline(INITIAL_TIMELINE);
    setWorkOrderStatus("under_review");
    setRepairDraft(defaultRepair);
    setToast("Demo reset to the starting story.");
  }, []);

  const attentionItems = useMemo(
    () => buildAttention(decisionStatus, repairDraft.submitted),
    [decisionStatus, repairDraft.submitted],
  );

  const value = useMemo(
    () => ({
      role,
      setRole,
      ownerView,
      setOwnerView,
      tenantView,
      setTenantView,
      managerView,
      setManagerView,
      decisionStatus,
      decisionNote,
      resolveDecision,
      timeline,
      workOrderStatus,
      repairDraft,
      updateRepairDraft,
      submitRepair,
      attentionItems,
      toast,
      clearToast,
      resetDemo,
      entered,
      enterDemo,
    }),
    [
      role,
      ownerView,
      tenantView,
      managerView,
      decisionStatus,
      decisionNote,
      resolveDecision,
      timeline,
      workOrderStatus,
      repairDraft,
      updateRepairDraft,
      submitRepair,
      attentionItems,
      toast,
      clearToast,
      resetDemo,
      entered,
      enterDemo,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
