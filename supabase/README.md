# Supabase (Phase 2 foundation)

## Apply schema

1. Create a Supabase project.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Run the migration SQL:

```bash
# Supabase CLI
supabase db push

# or
psql "$DATABASE_URL" -f supabase/migrations/20261122000000_phase2_foundation.sql
```

4. Seed:

```bash
npm run seed:supabase
```

5. (Optional) Create Auth users for pilot emails and link `profiles.auth_user_id`. Demo cookie login still works when `ALLOW_DEMO_LOGIN` is not `false`.

## Production job queue

The app uses a **DB-backed `job_queue` table** behind `src/lib/server/jobs/queue.ts`. For production scale, swap that adapter to Inngest, Cloud Tasks, or SQS — call sites (`enqueueJob` / `processDueJobs`) stay the same.

## RLS vs server checks

RLS policies are enabled for defense-in-depth. The Next.js API continues to enforce **server-side permission checks** on every mutation (Phase 1 pattern). Service-role is used for the pilot store adapter; migrate toward user-scoped clients as Auth wiring matures.
