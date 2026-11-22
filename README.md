# PropertMax — Phase 1 Pilot (closeout)

Production-oriented Phase 1 path for the townhouse pilot:

1. **Property / unit / lease records** — manager edit; owner/tenant authorized views
2. **Documents + activity history** — role-filtered surfaces for all roles
3. **Maintenance:** tenant intake → work order → estimate → owner approval (over threshold) → contractor
4. **Owner financials:** cash flow (NOI vs after debt service), actual vs forecast, adjustable projections; **manual rent/expense entry** clearly labeled illustrative vs manual vs verified
5. **Messages** — property and work-order threads with server RBAC

Sites-style clickable prototype remains at `/sites-demo`.

## Stack

- Next.js + TypeScript
- Cookie session RBAC (server-checked on every API mutation)
- Durable local JSON store at `data/propertmax-store.json`
- **TODO(supabase):** Auth + Postgres + RLS (types already centralized in `src/lib/types.ts`)

## Approval policy

Property `ownerApprovalThresholdCents` defaults to **$200**.

- Estimate **> $200** → `awaiting_owner_approval`
- Estimate **≤ $200** → auto-approved for assignment

## Pilot logins

Password for all: `pilot`

| Role | Email |
|------|--------|
| Owner | owner@propertmax.demo |
| Manager | manager@propertmax.demo |
| Tenant | tenant@propertmax.demo |
| Contractor | contractor@propertmax.demo |

## Run

```bash
npm install
npm run build && npm run start -- -p 3000
```

Open http://localhost:3000

## Phase 1 closeout click paths

1. Sign in as **Manager** → **Records** → edit property/unit/lease → Save
2. **Docs** → view role-filtered documents + activity timeline; add a document reference
3. **Messages** → open faucet work-order thread or start a property thread
4. Sign in as **Owner** → **Financials** → review ledger badges (illustrative vs manual) → add a manual entry
5. Sign in as **Tenant** → **Records** (lease view) · **Message** · **Request Repair**

## Data quality labels (ledger)

| Source | Meaning |
|--------|---------|
| `illustrative` | Seed / demo planning figures |
| `manual` | Human-entered in the pilot UI — **not bank-verified** |
| `verified` | Reserved for future bank sync (not produced in Phase 1) |
