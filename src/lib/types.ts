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
  /** Orgs this user belongs to (Phase 3). */
  orgIds?: string[];
  /** MFA enabled for sensitive roles (owner/manager). */
  mfaEnabled?: boolean;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  /** Owner of the SaaS seat / billing contact. */
  billingUserId: string;
  createdAt: string;
};

export type Membership = {
  id: string;
  orgId: string;
  userId: string;
  role: Role;
  createdAt: string;
};

export type SaasPlan = "pilot" | "growth" | "portfolio";

export type SaasSubscription = {
  id: string;
  orgId: string;
  plan: SaasPlan;
  status: "trialing" | "active" | "past_due" | "canceled";
  provider: "stripe" | "demo";
  externalId: string | null;
  seats: number;
  unitAmountCents: number;
  currentPeriodEnd: string;
  updatedAt: string;
};

export type SaasInvoice = {
  id: string;
  orgId: string;
  subscriptionId: string;
  amountCents: number;
  status: "paid" | "open" | "void" | "demo";
  label: string;
  issuedAt: string;
  /** Demo invoices are clearly labeled fake — never real charges. */
  demo: boolean;
};

export type WhiteLabelTheme = {
  orgId: string;
  brandName: string;
  logoText: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  /** Optional logo mark (emoji/initial — no binary assets required). */
  mark: string;
};

export type AccountingImportLine = {
  id: string;
  orgId: string;
  propertyId: string | null;
  externalRef: string;
  label: string;
  amountCents: number;
  postedOn: string;
  matchedLedgerId: string | null;
  status: "imported" | "matched" | "unmatched" | "ignored";
};

export type AuditLogEntry = {
  id: string;
  orgId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: string;
  createdAt: string;
};

export type MonitoringEvent = {
  id: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  createdAt: string;
};

export type BenchmarkSnapshot = {
  orgId: string;
  generatedAt: string;
  metrics: {
    avgRentCents: number;
    avgCashFlowCents: number;
    occupancyPct: number;
    maintenancePerDoorCents: number;
    peerAvgRentCents: number;
    peerOccupancyPct: number;
    peerMaintenancePerDoorCents: number;
  };
  notes: string;
};

export type Property = {
  id: string;
  orgId?: string;
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
  /** Owning org for preferred network (Phase 3). Null = legacy global. */
  orgId?: string | null;
  preferred?: boolean;
  serviceArea?: string;
  rating?: number;
};

/** Per-property spending / automation policy (Phase 2). */
export type AutomationPolicy = {
  id: string;
  propertyId: string;
  name: string;
  spendThresholdCents: number;
  preapprovedCategories: string[];
  emergencyProcess: string;
  preferredVendorIds: string[];
  escalationContactUserId: string | null;
  maxWaitHours: number;
  enabled: boolean;
};

export type SpendDecisionReason =
  | "over_threshold"
  | "preapproved_under_threshold"
  | "category_not_preapproved"
  | "policy_disabled_fallback_threshold";

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
  /** Why policy routed this estimate (never because AI recommended). */
  policyDecisionReason?: SpendDecisionReason | null;
  quoteRequestedAt?: string | null;
  escalationDueAt?: string | null;
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

/** Hosted-pay / webhook payment reference — never stores card data. */
export type PaymentRef = {
  id: string;
  propertyId: string;
  leaseId: string | null;
  tenantUserId: string;
  provider: "stripe" | "demo";
  externalId: string | null;
  amountCents: number;
  status: "planned" | "checkout_open" | "paid" | "failed" | "canceled";
  month: string;
  label: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AutopayEnrollment = {
  id: string;
  propertyId: string;
  tenantUserId: string;
  enabled: boolean;
  /** Stub only — no real Stripe subscription/mandate stored in pilot. */
  provider: "stripe" | "demo";
  dayOfMonth: number;
  createdAt: string;
  updatedAt: string;
};

export type VerifiedFaq = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  sourceDocId: string | null;
};

/** Generated monthly owner statement (ledger + maintenance rollup). */
export type OwnerStatement = {
  id: string;
  propertyId: string;
  month: string;
  generatedAt: string;
  generatedByUserId: string;
  rentCollectedCents: number;
  operatingExpensesCents: number;
  maintenanceCents: number;
  mortgageCents: number;
  noiCents: number;
  cashFlowCents: number;
  renovationCents: number;
  workOrderCount: number;
  workOrderIds: string[];
  expenseByCategory: Record<string, number>;
  notes: string;
};

export type RenoStatus =
  | "draft"
  | "proposed"
  | "awaiting_owner_approval"
  | "approved"
  | "in_progress"
  | "completed"
  | "canceled";

export type RenovationChangeOrder = {
  id: string;
  title: string;
  amountCents: number;
  status: "proposed" | "approved" | "declined";
  note: string;
  createdAt: string;
  decidedAt: string | null;
};

export type RenovationMilestone = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "done";
  percent: number;
  updatedAt: string;
};

export type RenovationProject = {
  id: string;
  propertyId: string;
  unitId: string | null;
  title: string;
  scope: string;
  budgetCents: number;
  spentCents: number;
  status: RenoStatus;
  ownerDecision: "pending" | "approved" | "declined" | null;
  ownerNote: string | null;
  managerUserId: string;
  vendorId: string | null;
  milestones: RenovationMilestone[];
  changeOrders: RenovationChangeOrder[];
  progressPct: number;
  createdAt: string;
  updatedAt: string;
};

export type TurnoverChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  note: string | null;
};

export type TurnoverChecklist = {
  id: string;
  propertyId: string;
  unitId: string | null;
  leaseId: string | null;
  title: string;
  moveOutDate: string;
  status: "open" | "in_progress" | "ready" | "completed";
  items: TurnoverChecklistItem[];
  vacancyMonthsAssumed: number;
  vacancyCostCents: number;
  createdAt: string;
  updatedAt: string;
};

export type AssetCategory =
  | "hvac"
  | "water_heater"
  | "appliance"
  | "roof"
  | "plumbing"
  | "electrical"
  | "other";

export type AssetRecord = {
  id: string;
  propertyId: string;
  unitId: string | null;
  category: AssetCategory;
  name: string;
  makeModel: string | null;
  serialNumber: string | null;
  installedAt: string | null;
  warrantyEndsAt: string | null;
  expectedLifeYears: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppStore = {
  version: 8;
  /** Domain snapshot — persisted to Supabase Postgres when configured, else local JSON. */
  seededAt: string;
  users: User[];
  organizations: Organization[];
  memberships: Membership[];
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
  automationPolicies: AutomationPolicy[];
  paymentRefs: PaymentRef[];
  autopayEnrollments: AutopayEnrollment[];
  verifiedFaqs: VerifiedFaq[];
  ownerStatements: OwnerStatement[];
  renovationProjects: RenovationProject[];
  turnoverChecklists: TurnoverChecklist[];
  assets: AssetRecord[];
  saasSubscriptions: SaasSubscription[];
  saasInvoices: SaasInvoice[];
  whiteLabelThemes: WhiteLabelTheme[];
  accountingImports: AccountingImportLine[];
  auditLogs: AuditLogEntry[];
  monitoringEvents: MonitoringEvent[];
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId?: string | null;
  mfaVerified?: boolean;
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
