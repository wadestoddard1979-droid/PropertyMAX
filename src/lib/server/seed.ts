import type {
  AppStore,
  DocumentRecord,
  LedgerEntry,
  Lease,
  Message,
  MessageThread,
  ProjectionAssumptions,
  Unit,
} from "../types";

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

function mapleUnit(): Unit {
  return {
    id: "unit-maple-main",
    propertyId: "prop-maple",
    label: "Main townhouse",
    beds: 3,
    baths: 2.5,
    sqft: 1680,
    occupancy: "Occupied",
    monthlyRentCents: 185000,
  };
}

function mapleLease(): Lease {
  return {
    id: "lease-maple-2026",
    propertyId: "prop-maple",
    unitId: "unit-maple-main",
    tenantIds: ["user-tenant"],
    startDate: "2026-09-01",
    endDate: "2027-08-31",
    monthlyRentCents: 185000,
    depositCents: 185000,
    status: "active",
    notes: "12-month residential lease. Pets not permitted without written approval.",
  };
}

function mapleDocuments(now: string): DocumentRecord[] {
  return [
    {
      id: "doc-lease-pdf",
      propertyId: "prop-maple",
      workOrderId: null,
      leaseId: "lease-maple-2026",
      title: "Residential lease agreement",
      category: "lease",
      fileName: "maple-lane-lease-2026.pdf",
      uploadedByUserId: "user-manager",
      visibility: ["owner", "manager", "tenant"],
      note: "Fully executed lease · pilot metadata only (no blob storage yet).",
      createdAt: "2026-08-20T15:00:00.000Z",
    },
    {
      id: "doc-insurance",
      propertyId: "prop-maple",
      workOrderId: null,
      leaseId: null,
      title: "Landlord insurance declarations",
      category: "insurance",
      fileName: "maple-insurance-2026.pdf",
      uploadedByUserId: "user-manager",
      visibility: ["owner", "manager"],
      note: "Illustrative policy summary for the pilot.",
      createdAt: "2026-01-05T12:00:00.000Z",
    },
    {
      id: "doc-faucet-photo",
      propertyId: "prop-maple",
      workOrderId: "wo-faucet-seed",
      leaseId: null,
      title: "Kitchen faucet drip photo",
      category: "photo",
      fileName: "faucet-drip.jpg",
      uploadedByUserId: "user-tenant",
      visibility: ["owner", "manager", "tenant", "contractor"],
      note: "Attached to maintenance request.",
      createdAt: "2026-11-16T18:41:00.000Z",
    },
    {
      id: "doc-nov-statement",
      propertyId: "prop-maple",
      workOrderId: null,
      leaseId: null,
      title: "November owner statement (illustrative)",
      category: "statement",
      fileName: "owner-statement-2026-11.pdf",
      uploadedByUserId: "user-manager",
      visibility: ["owner", "manager"],
      note: "Figures are illustrative — not bank-verified.",
      createdAt: now,
    },
  ];
}

function mapleMessages(now: string): {
  threads: MessageThread[];
  messages: Message[];
} {
  return {
    threads: [
      {
        id: "thread-faucet",
        propertyId: "prop-maple",
        workOrderId: "wo-faucet-seed",
        subject: "Kitchen faucet replacement",
        participantIds: ["user-tenant", "user-manager", "user-owner"],
        createdAt: "2026-11-16T18:45:00.000Z",
        updatedAt: "2026-11-17T15:10:00.000Z",
      },
      {
        id: "thread-property",
        propertyId: "prop-maple",
        workOrderId: null,
        subject: "847 Maple Lane — general",
        participantIds: ["user-tenant", "user-manager", "user-owner"],
        createdAt: "2026-09-02T14:00:00.000Z",
        updatedAt: "2026-11-10T09:30:00.000Z",
      },
    ],
    messages: [
      {
        id: "msg-1",
        threadId: "thread-faucet",
        authorUserId: "user-tenant",
        body: "The kitchen faucet keeps dripping overnight. Photo attached to the request.",
        createdAt: "2026-11-16T18:45:00.000Z",
      },
      {
        id: "msg-2",
        threadId: "thread-faucet",
        authorUserId: "user-manager",
        body: "Thanks — we categorized this as plumbing. Beachy Plumbing quoted $425 for a full faucet replacement.",
        createdAt: "2026-11-17T14:25:00.000Z",
      },
      {
        id: "msg-3",
        threadId: "thread-faucet",
        authorUserId: "user-owner",
        body: "Looking at the quote now. Is the Moen Align the preferred option?",
        createdAt: "2026-11-17T15:10:00.000Z",
      },
      {
        id: "msg-4",
        threadId: "thread-property",
        authorUserId: "user-manager",
        body: "Welcome to 847 Maple Lane. Reach out here for anything that is not an emergency repair.",
        createdAt: "2026-09-02T14:00:00.000Z",
      },
      {
        id: "msg-5",
        threadId: "thread-property",
        authorUserId: "user-tenant",
        body: "Thanks — rent reminders look good. Will use this thread for general questions.",
        createdAt: "2026-11-10T09:30:00.000Z",
      },
    ],
  };
}

/** Pilot sample users — password is "pilot" for all. Replace with Supabase Auth. */
export function createSeedStore(): AppStore {
  const now = new Date().toISOString();
  const { threads, messages } = mapleMessages(now);
  return {
    version: 3,
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
        notes:
          "Pilot townhouse · Beachy Renovations turnover complete · single-unit record.",
      },
    ],
    units: [mapleUnit()],
    leases: [mapleLease()],
    documents: mapleDocuments(now),
    messageThreads: threads,
    messages,
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
        id: "act-0",
        workOrderId: null,
        propertyId: "prop-maple",
        actorUserId: "user-manager",
        kind: "property.records_seeded",
        message: "Property, unit, and lease records established for Maple Lane.",
        createdAt: "2026-08-20T15:05:00.000Z",
      },
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
      {
        id: "act-4",
        workOrderId: "wo-faucet-seed",
        propertyId: "prop-maple",
        actorUserId: "user-owner",
        kind: "message.posted",
        message: "Owner replied on the faucet thread.",
        createdAt: "2026-11-17T15:10:00.000Z",
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
