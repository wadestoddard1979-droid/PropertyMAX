import type { AppStore, LedgerEntry, ProjectionAssumptions } from "../types";

export function defaultAssumptions(propertyId: string): ProjectionAssumptions {
  return {
    propertyId,
    monthlyRentCents: 185000,
    vacancyRatePct: 4,
    monthlyRepairsCents: 9500,
    monthlyMortgageCents: 68000,
    monthlyTaxesCents: 28500,
    monthlyInsuranceCents: 11200,
    monthlyPmFeeCents: 14800,
    monthlyHoaCents: 6500,
    monthlyUtilitiesOwnerCents: 4000,
    annualRentGrowthPct: 2.5,
    renovationSpendCents: 1850000,
    /** Modeled a couple months out so near-term cash flow stays readable. */
    renovationMonthOffset: 2,
    renovationRentUpliftCents: 15000,
    vacancyMonthsOnTurnover: 1.5,
  };
}

function novemberLedger(now: string): LedgerEntry[] {
  const month = "2026-11";
  const propertyId = "prop-maple";
  const rows: Omit<LedgerEntry, "id" | "createdAt">[] = [
    {
      propertyId,
      month,
      category: "rent",
      label: "November rent collected",
      amountCents: 185000,
      source: "illustrative",
    },
    {
      propertyId,
      month,
      category: "pm_fee",
      label: "Property management fee (8%)",
      amountCents: -14800,
      source: "illustrative",
    },
    {
      propertyId,
      month,
      category: "maintenance",
      label: "Maintenance reserve / minor repairs",
      amountCents: -9500,
      source: "illustrative",
    },
    {
      propertyId,
      month,
      category: "insurance",
      label: "Landlord insurance",
      amountCents: -11200,
      source: "illustrative",
    },
    {
      propertyId,
      month,
      category: "taxes",
      label: "Property taxes (monthly accrual)",
      amountCents: -28500,
      source: "illustrative",
    },
    {
      propertyId,
      month,
      category: "hoa",
      label: "HOA dues",
      amountCents: -6500,
      source: "illustrative",
    },
    {
      propertyId,
      month,
      category: "utilities",
      label: "Owner utilities",
      amountCents: -4000,
      source: "illustrative",
    },
    {
      propertyId,
      month,
      category: "mortgage",
      label: "Mortgage (P&I)",
      amountCents: -68000,
      source: "illustrative",
    },
  ];
  return rows.map((r, i) => ({
    ...r,
    id: `led-nov-${i + 1}`,
    createdAt: now,
  }));
}

/** Pilot sample users — password is "pilot" for all. Replace with Supabase Auth. */
export function createSeedStore(): AppStore {
  const now = new Date().toISOString();
  return {
    version: 2,
    seededAt: now,
    users: [
      {
        id: "user-owner",
        email: "owner@propertmax.demo",
        name: "Alex Rivera",
        role: "owner",
        password: "pilot",
      },
      {
        id: "user-manager",
        email: "manager@propertmax.demo",
        name: "Sam Chen",
        role: "manager",
        password: "pilot",
      },
      {
        id: "user-tenant",
        email: "tenant@propertmax.demo",
        name: "Jordan Ellis",
        role: "tenant",
        password: "pilot",
      },
      {
        id: "user-contractor",
        email: "contractor@propertmax.demo",
        name: "Chris Moen",
        role: "contractor",
        password: "pilot",
      },
    ],
    properties: [
      {
        id: "prop-maple",
        name: "847 Maple Lane",
        address: "847 Maple Lane, Virginia Beach, VA 23451",
        type: "Townhouse",
        beds: 3,
        baths: 2.5,
        sqft: 1680,
        occupancy: "Occupied",
        ownerId: "user-owner",
        managerId: "user-manager",
        tenantIds: ["user-tenant"],
        ownerApprovalThresholdCents: 20000, // $200
        monthlyRent: 1850,
        leaseEnd: "Aug 31, 2027",
      },
    ],
    vendors: [
      {
        id: "vendor-beach-plumbing",
        name: "Beachy Plumbing Co.",
        trade: "Plumbing",
        contractorUserId: "user-contractor",
      },
    ],
    workOrders: [
      {
        id: "wo-faucet-seed",
        propertyId: "prop-maple",
        createdByUserId: "user-tenant",
        title: "Kitchen faucet replacement",
        details:
          "Persistent drip at kitchen sink. Inspection confirmed failed cartridge; replacement recommended over repeat service calls.",
        category: "Plumbing",
        urgency: "soon",
        status: "awaiting_owner_approval",
        estimateCents: 42500,
        estimateNotes:
          "Moen Align faucet + labor + supply lines. Illustrative quote.",
        contractorUserId: null,
        vendorId: "vendor-beach-plumbing",
        ownerDecision: "pending",
        ownerNote: null,
        requiresOwnerApproval: true,
        createdAt: "2026-11-16T18:41:00.000Z",
        updatedAt: "2026-11-17T14:20:00.000Z",
      },
    ],
    activity: [
      {
        id: "act-1",
        workOrderId: "wo-faucet-seed",
        propertyId: "prop-maple",
        actorUserId: "user-tenant",
        kind: "work_order.created",
        message: "Tenant reported kitchen faucet drip with photos.",
        createdAt: "2026-11-16T18:41:00.000Z",
      },
      {
        id: "act-2",
        workOrderId: "wo-faucet-seed",
        propertyId: "prop-maple",
        actorUserId: "user-manager",
        kind: "work_order.triaged",
        message: "Categorized as plumbing · non-emergency.",
        createdAt: "2026-11-16T19:05:00.000Z",
      },
      {
        id: "act-3",
        workOrderId: "wo-faucet-seed",
        propertyId: "prop-maple",
        actorUserId: "user-manager",
        kind: "work_order.estimate_added",
        message:
          "Estimate $425 added. Over $200 threshold — owner approval required.",
        createdAt: "2026-11-17T14:20:00.000Z",
      },
    ],
    notifications: [
      {
        id: "notif-owner-1",
        userId: "user-owner",
        workOrderId: "wo-faucet-seed",
        title: "Approval needed",
        body: "Kitchen faucet replacement · $425 quote awaiting your decision.",
        read: false,
        createdAt: "2026-11-17T14:20:00.000Z",
      },
      {
        id: "notif-tenant-1",
        userId: "user-tenant",
        workOrderId: "wo-faucet-seed",
        title: "Request under review",
        body: "Your kitchen faucet request is with the owner for approval.",
        read: false,
        createdAt: "2026-11-17T14:20:00.000Z",
      },
    ],
    ledger: novemberLedger(now),
    projectionAssumptions: [defaultAssumptions("prop-maple")],
  };
}
