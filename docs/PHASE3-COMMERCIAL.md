# Phase 3 — Commercial platform (how to test)

Local-json demo works with **no secrets**. Password for all sample users: `pilot`.

**Branding:** Login + `@propertmax.demo` = PropertMax. Beachy Renovations white-label only for `@beachy.demo` / `org-beachy`.

## Quick bar

| Check | How |
| --- | --- |
| Default brand | Open `/` logged out — PropertMax login. Sign in `owner@propertmax.demo` — header stays PropertMax. |
| Second org | Sign in as `owner@beachy.demo` (Beachy Renovations PM). Header shows Beachy white-label. |
| Multi-property | Sign in as `owner@propertmax.demo` → **Commercial** → Portfolio. Pilot org has Maple + Ocean View. |
| SaaS subscription | Commercial → SaaS billing → set pilot/growth/portfolio. Without Stripe keys you get **DEMO** invoices labeled “not a real charge”. |
| White-label | Beachy org theme (logo/colors/tagline) only on Beachy accounts. Or Pilot org **Touch tagline** under Overview. |
| Org switch | Commercial → Active org buttons (memberships only). |
| MFA | Commercial → Security → Enable MFA → Verify with `123456`. Plan changes then require verification. |
| Accounting stub | Commercial → Accounting → Import sample CSV; Export CSV. |
| Vendor network | Commercial → Vendor network (org preferred directory). |
| Benchmarking | Commercial → Overview peer metrics. |
| Audit export | Commercial → Security → Export audit JSON. |

## Demo users

**Org pilot (`org-pilot`)**

- `owner@propertmax.demo` / `manager@propertmax.demo` / `tenant@propertmax.demo` / `contractor@propertmax.demo`

**Org Beachy (`org-beachy`)**

- `owner@beachy.demo` / `manager@beachy.demo` / `tenant@beachy.demo`

## Stripe (optional)

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for live Checkout / Billing paths. Without them, rent payments and SaaS plan changes stay in labeled demo mode.

## Reset

Use **Reset data** in the app header to reseed Phase 3 commercial (orgs, second doors, Beachy theme, demo invoices).
