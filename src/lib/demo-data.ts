export type Role = "owner" | "manager" | "tenant";

export type DecisionStatus = "pending" | "approved" | "asked" | "declined";

export type WorkOrderStatus =
  | "reported"
  | "under_review"
  | "scheduled"
  | "in_progress"
  | "completed";

export type OwnerView = "home" | "financials" | "decision";
export type TenantView = "home" | "repair" | "timeline" | "pay" | "message";
export type ManagerView = "home" | "thread";

export const PROPERTY = {
  name: "847 Maple Lane",
  type: "Townhouse",
  beds: 3,
  baths: 2.5,
  sqft: 1680,
  address: "847 Maple Lane, Virginia Beach, VA 23451",
  occupancy: "Occupied",
  tenantName: "Jordan & Avery Ellis",
  leaseEnd: "Aug 31, 2027",
  monthlyRent: 1850,
  estimatedCashFlow: 425,
  ownerName: "Alex Rivera",
  managerName: "Sam Chen",
  managerCompany: "Beachy Property Partners",
} as const;

export const CASH_FLOW = {
  rent: 1850,
  pmFees: 148,
  maintenanceReserve: 95,
  insurance: 112,
  taxes: 285,
  hoa: 65,
  utilitiesOwner: 40,
  mortgage: 680,
} as const;

export function computeCashFlow() {
  const expenses =
    CASH_FLOW.pmFees +
    CASH_FLOW.maintenanceReserve +
    CASH_FLOW.insurance +
    CASH_FLOW.taxes +
    CASH_FLOW.hoa +
    CASH_FLOW.utilitiesOwner +
    CASH_FLOW.mortgage;
  return {
    ...CASH_FLOW,
    expenses,
    estimatedCashFlow: CASH_FLOW.rent - expenses,
  };
}

export const PROJECTION = [
  { month: "Dec", cashFlow: 425, label: "Dec '26" },
  { month: "Jan", cashFlow: 410, label: "Jan '27" },
  { month: "Feb", cashFlow: 430, label: "Feb '27" },
  { month: "Mar", cashFlow: 445, label: "Mar '27" },
  { month: "Apr", cashFlow: 420, label: "Apr '27" },
  { month: "May", cashFlow: 455, label: "May '27" },
  { month: "Jun", cashFlow: 470, label: "Jun '27" },
  { month: "Jul", cashFlow: 460, label: "Jul '27" },
  { month: "Aug", cashFlow: 440, label: "Aug '27" },
  { month: "Sep", cashFlow: 450, label: "Sep '27" },
  { month: "Oct", cashFlow: 465, label: "Oct '27" },
  { month: "Nov", cashFlow: 480, label: "Nov '27" },
] as const;

export const FAUCET_DECISION = {
  id: "dec-faucet-001",
  title: "Kitchen faucet replacement",
  amount: 425,
  category: "Plumbing",
  summary:
    "Tenant reported a persistent drip at the kitchen sink. Inspection confirmed a failed cartridge; replacement is more cost-effective than repeated service calls.",
  recommendation:
    "Approve Moen Align replacement with Beachy Plumbing. Parts + labor quote is $425 — under your $500 auto-threshold except this property requires photo confirmation.",
  contractor: "Beachy Plumbing Co.",
  eta: "Within 3 business days of approval",
  photos: [
    {
      id: "p1",
      alt: "Kitchen sink with dripping faucet",
      caption: "Active drip at spout",
    },
    {
      id: "p2",
      alt: "Close-up of faucet base wear",
      caption: "Corrosion at base",
    },
  ],
  quoteLineItems: [
    { label: "Moen Align faucet (chrome)", amount: 189 },
    { label: "Labor & disposal", amount: 175 },
    { label: "Supply lines & shutoff check", amount: 61 },
  ],
} as const;

export const AUTOMATION_FEED = [
  {
    id: "auto-1",
    time: "8:12 AM",
    text: "Rent reminder sent to Jordan Ellis for Dec 1 balance.",
  },
  {
    id: "auto-2",
    time: "Yesterday",
    text: "Lease document pack refreshed in owner Documents.",
  },
  {
    id: "auto-3",
    time: "Yesterday",
    text: "HVAC filter reminder scheduled for Dec 15 visit window.",
  },
  {
    id: "auto-4",
    time: "Mon",
    text: "November owner summary drafted — ready for review Friday.",
  },
] as const;

export const INITIAL_TIMELINE: {
  status: WorkOrderStatus;
  label: string;
  detail: string;
  at: string;
  done: boolean;
}[] = [
  {
    status: "reported",
    label: "Reported",
    detail: "Tenant submitted kitchen faucet drip with photos.",
    at: "Nov 16 · 6:41 PM",
    done: true,
  },
  {
    status: "under_review",
    label: "Under review",
    detail: "Categorized as plumbing · non-emergency. Quote requested.",
    at: "Nov 16 · 7:05 PM",
    done: true,
  },
  {
    status: "scheduled",
    label: "Awaiting owner decision",
    detail: "Estimate $425 prepared. Owner approval required.",
    at: "Nov 17 · 9:20 AM",
    done: true,
  },
  {
    status: "in_progress",
    label: "Scheduled",
    detail: "Contractor will book after approval.",
    at: "",
    done: false,
  },
  {
    status: "completed",
    label: "Completed",
    detail: "Repair finished and documented.",
    at: "",
    done: false,
  },
];

export function formatMoney(n: number) {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return n < 0 ? `−${formatted}` : formatted;
}

export function formatMoneySigned(n: number) {
  if (n > 0) return `+${formatMoney(n)}`;
  if (n < 0) return formatMoney(n);
  return formatMoney(0);
}
