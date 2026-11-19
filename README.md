# PropertMax — Phase 1 Pilot

Production-oriented Phase 1 path for the townhouse pilot:

1. **Maintenance:** tenant intake → work order → estimate → owner approval (over threshold) → contractor
2. **Owner financials:** cash flow (NOI vs after debt service), actual vs forecast, adjustable 12-mo / 3-yr / 5-yr projections, renovation ROI / vacancy cost insights

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

## Owner financials click path

1. Sign in as **Owner**
2. **Open financials** (or header Financials)
3. Review actual vs forecast cash flow + pending faucet approval card
4. Switch **12 mo / 3 yr / 5 yr**, edit assumptions → Save
5. Optionally add a manual ledger entry (labeled manual, not bank-verified)

## Branches

- `cursor/townhouse-sites-demo-0807` — Sites demo
- `cursor/maintenance-mvp-0807` — maintenance MVP
- `cursor/owner-financials-mvp-0807` — owner financials (this branch)
