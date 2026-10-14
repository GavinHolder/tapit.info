# TapIt

Mobile-first NFC "table talker" platform for the Overstrand (guesthouses, operators, restaurants). Guests tap a stand and get a branded concierge page, local things to do, a passport, and trip replay. No app download.

## Business rules (do not break these)
- TapIt is a **conduit**. No guest or end-user money ever passes through TapIt. Businesses sell their own bookings, vouchers and memberships and handle their own payments, refunds and terms.
- TapIt only earns: referral commission, subscriptions, and feature upsells. All of it is invoiced to businesses.
- POPIA applies. Scans are anonymous. Trips and location need explicit opt-in, are private by default, and can be exported or deleted.

## Stack decisions
- Next.js (React), mobile-first, TypeScript. Postgres (with PostGIS for tracks) on a VPS. No Supabase.
- Docker, Portainer, GitHub Actions. Everything self-hosted. All tooling must be internal: no third-party services at runtime.

## Where things are
- `planning/flows/*.flow.json` and `planning/SPEC.md`: the agreed flows and the generated build spec. Read these first. Open questions are listed at the end of SPEC.md and must be confirmed with the client, not assumed.
- `mockups/`: interactive UI mockups (version 2 is current). `studio/public/prototypes` has runnable copies.
- `studio/`: TapIt Studio, the planning workspace.
- `docs/`: client questions, research notes, and the voucher/membership/billing rules.
