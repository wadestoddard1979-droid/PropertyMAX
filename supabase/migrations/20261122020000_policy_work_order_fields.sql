-- Extra work-order fields for policy routing + vendor quote coordination
alter table public.work_orders
  add column if not exists policy_decision_reason text,
  add column if not exists quote_requested_at timestamptz,
  add column if not exists escalation_due_at timestamptz;
