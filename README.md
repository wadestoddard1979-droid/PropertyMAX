# PropertMax — Phase 2 foundation

Property management OS pilot (Beachy Renovations townhouse). Phase 1 closeout features remain; this branch adds the **Supabase foundation** while keeping a zero-secret local demo mode.

## Stack

- Next.js + TypeScript
- **Default (no secrets):** cookie demo RBAC + local JSON `data/propertmax-store.json`
- **With Supabase env:** Postgres primary store, Auth path + demo fallback, Storage bucket `documents`, DB-backed `job_queue`, RLS policies

## Local remote after rename

If an older clone still points at `PeopertyMAX`:

```bash
git remote set-url origin https://github.com/wadestoddard1979-droid/PropertyMAX.git
```

## Pilot logins

Password for all: `pilot`

| Role | Email |
|------|--------|
| Owner | owner@propertmax.demo |
| Manager | manager@propertmax.demo |
| Tenant | tenant@propertmax.demo |
| Contractor | contractor@propertmax.demo |

## Run without Supabase (default)

```bash
npm install
npm run build && npm run start -- -p 3000
```

Open http://localhost:3000 — persistence shows `local-json`. Demo logins work.

## Run with Supabase

1. Copy `.env.example` → `.env.local` and fill:

   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Apply `supabase/migrations/20261122000000_phase2_foundation.sql` (see `supabase/README.md`).

3. Seed:

```bash
npm run seed:supabase
```

4. Start the app. `/api/system/status` should report `persistence: "supabase"`.

5. Auth: Supabase Auth is tried first; pilot demo passwords remain available unless `ALLOW_DEMO_LOGIN=false`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run seed` | Seed local JSON (or Supabase if env present) |
| `npm run seed:supabase` | Force seed into Supabase |
| `npm run build` | Works **without** secrets |

## Phase 1 surfaces (still present)

Records · Documents/Activity · Messages · Maintenance workflow · Owner financials (illustrative vs manual ledger labels)

## Phase 2 foundation (this branch)

- Schema: orgs, profiles/memberships, properties, units, leases, work orders, ledger/expenses, payment_refs, documents, messages, automation_policies, audit_logs, job_queue
- Auth adapter with demo fallback
- RLS + server-side checks
- Storage adapter for documents
- Durable job queue abstraction (DB or local file)

## AI maintenance intake

Tenant/manager **Request Repair** opens a guided conversational intake (flooding, location, shutoff, hazards, photos). A rule-based classifier (optional LLM via `AI_INTAKE_LLM=true`) sets category/urgency/emergency flags and writes an audit trace. **Hard rule:** classification never authorizes spend — estimates and owner approval stay on the existing human/policy workflow.

## Spending policies & vendor coordination

Manager **Policies** configures per-property spend threshold, preapproved categories, preferred vendors, escalation wait, and emergency process (`automation_policies`). Estimates/quotes are routed by policy — over threshold or non-preapproved category → owner approval; AI recommendations never authorize spend. Managers can **request vendor estimate**; contractors **submit quote**.

**Not in this branch:** Stripe payments / automated owner comms (later).

## Approval policy

Property `ownerApprovalThresholdCents` defaults to **$200**.
