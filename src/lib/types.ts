export type Role = "owner" | "manager" | "tenant" | "contractor";

export type WorkOrderStatus =
  | "reported"
  | "under_review"
  | "awaiting_estimate"
  | "awaiting_owner_approval"
  | "approved"
  | "declined"
  | "assigned"
  | "scheduled"
  | "in_progress"
  | "completed";

export type Urgency = "routine" | "soon" | "urgent";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Pilot demo password — replace with hashed auth via Supabase Auth. */
  password: string;
};

export type Property = {
  id: string;
  name: string;
  address: string;
  type: string;
  beds: number;
  baths: number;
  sqft: number;
  occupancy: "Occupied" | "Vacant";
  ownerId: string;
  managerId: string;
  tenantIds: string[];
  /** Cents of spend that auto-clear without owner; over requires owner. */
  ownerApprovalThresholdCents: number;
  monthlyRent: number;
  leaseEnd: string;
  notes?: string;
};

export type Unit = {
  id: string;
  propertyId: string;
  label: string;
  beds: number;
  baths: number;
  sqft: number;
  occupancy: "Occupied" | "Vacant";
  monthlyRentCents: number;
};

export type Lease = {
  id: string;
  propertyId: string;
  unitId: string;
  tenantIds: string[];
  startDate: string;
  endDate: string;
  monthlyRentCents: number;
  depositCents: number;
  status: "active" | "upcoming" | "ended";
  notes: string;
};

export type DocumentRecord = {
  id: string;
  propertyId: string;
  workOrderId: string | null;
  leaseId: string | null;
  title: string;
  category:
    | "lease"
    | "insurance"
    | "inspection"
    | "invoice"
    | "photo"
    | "statement"
    | "other";
  fileName: string;
  uploadedByUserId: string;
  /** Roles allowed to see this document (manager always can). */
  visibility: Role[];
  note: string;
  createdAt: string;
};

export type MessageThread = {
  id: string;
  propertyId: string;
  workOrderId: string | null;
  subject: string;
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  threadId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
};

export type Vendor = {
  id: string;
  name: string;
  trade: string;
  contractorUserId: string;
};

export type WorkOrder = {
  id: string;
  propertyId: string;
  createdByUserId: string;
  title: string;
  details: string;
  category: string;
  urgency: Urgency;
  status: WorkOrderStatus;
  estimateCents: number | null;
  estimateNotes: string | null;
  contractorUserId: string | null;
  vendorId: string | null;
  ownerDecision: "pending" | "approved" | "declined" | "asked" | null;
  ownerNote: string | null;
  requiresOwnerApproval: boolean;
  /** Optional link to AI/rule intake classification audit. */
  intakeAuditId?: string | null;
  emergencyFlag?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Answers collected during conversational maintenance intake. */
export type IntakeAnswers = {
  summary: string;
  location: string;
  flooding: "yes" | "no" | "unsure";
  waterShutoffKnown: "yes" | "no" | "na";
  electricityHazard: "yes" | "no" | "unsure";
  smellGas: "yes" | "no";
  canUseHome: "yes" | "partially" | "no";
  photoNotes: string;
  freeText: string;
};

export type IntakeCategory =
  | "Plumbing"
  | "Electrical"
  | "HVAC"
  | "Appliance"
  | "Structural"
  | "Pest"
  | "General";

/** Classification is advisory only — never authorizes spend. */
export type IntakeClassification = {
  category: IntakeCategory;
  urgency: Urgency;
  emergency: boolean;
  confidence: number;
  rationale: string[];
  recommendedNextStep: string;
  /** Always false — hard product rule. */
  spendAuthorized: false;
  /** Optional suggested range for humans; never applied automatically. */
  suggestedEstimateBandCents: { min: number; max: number } | null;
  engine: "rules" | "llm+rules";
};

export type IntakeAudit = {
  id: string;
  propertyId: string;
  workOrderId: string | null;
  actorUserId: string;
  answers: IntakeAnswers;
  classification: IntakeClassification;
  /** Trace of decision steps for managers/owners. */
  trace: { step: string; detail: string }[];
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  workOrderId: string | null;
  propertyId: string;
  actorUserId: string;
  kind: string;
  message: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  workOrderId: string | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

/** Ledger line for Phase 1 manual / illustrative books. */
export type LedgerEntry = {
  id: string;
  propertyId: string;
  /** Calendar month key YYYY-MM */
  month: string;
  category:
    | "rent"
    | "pm_fee"
    | "maintenance"
    | "insurance"
    | "taxes"
    | "hoa"
    | "utilities"
    | "mortgage"
    | "renovation"
    | "other";
  label: string;
  /** Positive = inflow, negative = outflow (cents). */
  amountCents: number;
  /** verified = bank-synced later; Phase 1 is illustrative or manual. */
  source: "illustrative" | "manual" | "verified";
  createdAt: string;
};

export type ProjectionAssumptions = {
  propertyId: string;
  monthlyRentCents: number;
  vacancyRatePct: number;
  monthlyRepairsCents: number;
  monthlyMortgageCents: number;
  monthlyTaxesCents: number;
  monthlyInsuranceCents: number;
  monthlyPmFeeCents: number;
  monthlyHoaCents: number;
  monthlyUtilitiesOwnerCents: number;
  annualRentGrowthPct: number;
  /** One-time renovation spend modeled in the horizon. */
  renovationSpendCents: number;
  renovationMonthOffset: number;
  /** Monthly rent uplift after renovation completes. */
  renovationRentUpliftCents: number;
  /** Vacancy months assumed on a turnover event. */
  vacancyMonthsOnTurnover: number;
};

export type AppStore = {
  version: 4;
  /** Domain snapshot — persisted to Supabase Postgres when configured, else local JSON. */
  seededAt: string;
  users: User[];
  properties: Property[];
  units: Unit[];
  leases: Lease[];
  documents: DocumentRecord[];
  messageThreads: MessageThread[];
  messages: Message[];
  vendors: Vendor[];
  workOrders: WorkOrder[];
  activity: ActivityEvent[];
  notifications: Notification[];
  ledger: LedgerEntry[];
  projectionAssumptions: ProjectionAssumptions[];
  intakeAudits: IntakeAudit[];
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  reported: "Reported",
  under_review: "Under review",
  awaiting_estimate: "Awaiting estimate",
  awaiting_owner_approval: "Awaiting owner approval",
  approved: "Approved",
  declined: "Declined",
  assigned: "Assigned",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
};
