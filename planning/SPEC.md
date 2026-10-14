# TapIt build spec

Generated from `planning/flows/*.flow.json` by TapIt Studio. Edit the flows in Studio, not this file.

## Guest taps a stand and explores

What happens from the moment a guest taps the NFC stand: how the page is found, what loads, what is logged, and how a guest is sent to a partner.

### 1. Guest taps the NFC stand or scans the QR code

- Type: Action. Lane: Guest. Status: Draft.
- What happens: The phone opens tapit.info/t/{code}. No app and no sign-up.
- Next:
  - go to 2. Find the stand

### 2. Find the stand

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: Look up the stand code and its business. Record an anonymous scan.
- Reads: units, tenants
- Writes: events (scan: unit_id, tenant_id, anonymous session id, time)
- API: GET /t/{code}
- Next:
  - go to 3. Stand active and page published?

### 3. Stand active and page published?

- Type: Decision. Lane: Backend. Status: Draft.
- Next:
  - If no: go to 5. Fallback page: this stand is not active yet
  - If yes: go to 4. Concierge: Stay tab

### 4. Concierge: Stay tab

- Type: Screen. Lane: Frontend. Status: Draft.
- What happens: Host name, quick actions (Wi-Fi, WhatsApp, Review, Call), breakfast, check-out and the featured trail.
- Reads: page_versions (published), offers
- API: GET /api/t/{code}/concierge
- Mockup: App.dc.html
- Next:
  - go to 8. Taps a quick action
  - go to 7. Explore tab
  - go to 6. Trips, Wallet and Passport tabs

### 5. Fallback page: this stand is not active yet

- Type: Screen. Lane: Frontend. Status: Draft.
- What happens: Show TapIt information and a contact link.

### 6. Trips, Wallet and Passport tabs

- Type: Screen. Lane: Frontend. Status: Draft.
- What happens: See the trip recording flow.
- Mockup: App.dc.html

### 7. Explore tab

- Type: Screen. Lane: Frontend. Status: Draft.
- What happens: Search, category filters and places near this stand. Guests can save places.
- Reads: listings, offers (by tenant region)
- API: GET /api/listings?unit={code}
- Mockup: App.dc.html
- Next:
  - go to 9. Place detail sheet

### 8. Taps a quick action

- Type: Action. Lane: Guest. Status: Draft.
- What happens: Wi-Fi copies the password. WhatsApp, Review and Call open the other app.
- Next:
  - go to 10. Log the click

### 9. Place detail sheet

- Type: Screen. Lane: Frontend. Status: Draft.
- What happens: Description, operator, price, Save and Book with operator.
- Mockup: App.dc.html
- Next:
  - go to 11. Taps Book with operator

### 10. Log the click

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: Record which button was used from which stand.
- Writes: events (click: target, unit_id)
- API: POST /api/events

### 11. Taps Book with operator

- Type: Action. Lane: Guest. Status: Draft.
- Next:
  - go to 12. Create the referral and redirect

### 12. Create the referral and redirect

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: The guest is sent to the operator with a referral code so the booking can be traced to this stand.
- Writes: referrals (unit_id, listing_id, referral_code, session id, status=clicked)
- API: GET /go/{referral_code}
- Next:
  - go to 14. Operator's own booking page
  - go to 13. Can partners add the referral code at their own checkout?

### 13. Can partners add the referral code at their own checkout?

- Type: Open question. Lane: Admin. Status: Open question.
- What happens: This decides whether referrals can be matched automatically. Ask the client and the first partners.

### 14. Operator's own booking page

- Type: External. Lane: External. Status: Draft.
- What happens: The guest books and pays the operator directly. TapIt never takes the payment.

## Business onboarding to a live stand

How a guesthouse or operator goes from signed up to a working stand: who creates what, what is captured, and what goes live.

### 1. Admin creates the business

- Type: Action. Lane: Admin. Status: Draft.
- What happens: Name, town, contact and plan.
- Captures:
  - Business name (text, required)
  - Town (text, required)
  - Contact email (email, required) **personal information**
  - WhatsApp number (phone, optional) **personal information**
  - Plan (select, required)
- Writes: tenants, agreements
- API: POST /api/admin/tenants
- Next:
  - go to 2. Send the invite link

### 2. Send the invite link

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: A sign-in link is emailed from our own mail server.
- Writes: invites (token, expires)
- API: POST /api/admin/invites
- Next:
  - go to 3. Owner opens the invite link

### 3. Owner opens the invite link

- Type: Action. Lane: Business. Status: Draft.
- Next:
  - go to 4. Create the owner account

### 4. Create the owner account

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: Passwordless. A session is started.
- Writes: users (role=owner, tenant_id), sessions
- Next:
  - go to 5. Owner profile created

### 5. Owner profile created

- Type: Profile. Lane: Business. Status: Draft.
- What happens: The owner accepts the terms and privacy notice on first sign-in.
- Captures:
  - Display name (text, required) **personal information**
  - Email (email, required) **personal information**
  - Terms accepted at (timestamp, required)
  - Privacy notice version (text, required)
- Next:
  - go to 6. Concierge editor

### 6. Concierge editor

- Type: Screen. Lane: Business. Status: Draft.
- What happens: Edit welcome, hours, Wi-Fi, quick actions, content blocks and accent colour with a live phone preview.
- Writes: pages (draft)
- API: PUT /api/portal/page
- Mockup: Portal.dc.html
- Next:
  - go to 7. Ready to go live?
  - go to 8. Who writes the content for each pilot site?
  - go to 9. Which languages are needed at launch?

### 7. Ready to go live?

- Type: Decision. Lane: Business. Status: Draft.
- Next:
  - If not yet: go to 6. Concierge editor
  - If yes: go to 10. Publish changes

### 8. Who writes the content for each pilot site?

- Type: Open question. Lane: Admin. Status: Open question.
- What happens: The owner, the client or us. Decides how much editor help we offer.

### 9. Which languages are needed at launch?

- Type: Open question. Lane: Business. Status: Open question.
- What happens: English, Afrikaans, German?

### 10. Publish changes

- Type: Action. Lane: Business. Status: Draft.
- What happens: Confirm dialog, then a new version number. Older versions can be restored.
- Writes: page_versions (published)
- Next:
  - go to 11. Assign and program the stand

### 11. Assign and program the stand

- Type: Action. Lane: Admin. Status: Draft.
- What happens: Link the unit code to the business and write the URL to the NFC chip.
- Writes: units (tenant_id, code, status=active)
- Next:
  - go to 12. Stand goes live

### 12. Stand goes live

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: The first scan is recorded and the admin is told.
- Writes: audit_log, events

## Referral commission and billing

How a booking is traced back to a stand, verified, and turned into an invoice. TapIt only invoices businesses and never handles guest money.

### 1. Guest books with a partner after tapping Book

- Type: Action. Lane: Guest. Status: Draft.
- What happens: Starts in the guest tap flow.
- Next:
  - go to 2. Referral recorded

### 2. Referral recorded

- Type: Backend. Lane: Backend. Status: Draft.
- Writes: referrals (status=clicked)
- Next:
  - go to 3. Partner confirms the booking

### 3. Partner confirms the booking

- Type: External. Lane: External. Status: Draft.
- What happens: In their portal, or by quoting the referral code at checkout.
- Next:
  - go to 4. Match the referral

### 4. Match the referral

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: Three signals: referral code or tagged link, partner confirmation, and spot-checks.
- Reads: referrals, partner confirmations
- Writes: referrals (status=matched)
- Next:
  - go to 5. Matched and not disputed?

### 5. Matched and not disputed?

- Type: Decision. Lane: Backend. Status: Draft.
- Next:
  - If yes: go to 7. Month-end invoice run
  - If no: go to 6. Referral claims queue

### 6. Referral claims queue

- Type: Screen. Lane: Admin. Status: Draft.
- What happens: Admin reviews disputed or unmatched claims and asks the partner for proof.
- Mockup: Ledger.dc.html (first round)
- Next:
  - If resolved: go to 4. Match the referral

### 7. Month-end invoice run

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: Group matched referrals by business, apply the agreement rate, then add subscription and feature lines.
- Reads: agreements, referrals, subscriptions
- Writes: invoices, invoice_lines
- Next:
  - go to 8. Review and issue invoices
  - go to 9. What is the commission rate, and is it per partner?
  - go to 10. How are cancellations and chargebacks handled?
  - go to 11. What does "royalty" mean?

### 8. Review and issue invoices

- Type: Action. Lane: Admin. Status: Draft.
- Next:
  - go to 12. Invoice emailed to the business

### 9. What is the commission rate, and is it per partner?

- Type: Open question. Lane: Admin. Status: Open question.

### 10. How are cancellations and chargebacks handled?

- Type: Open question. Lane: Admin. Status: Open question.
- What happens: Credit notes against the next invoice?

### 11. What does "royalty" mean?

- Type: Open question. Lane: Admin. Status: Open question.
- What happens: A share of TapIt income to the forum or partners, or member points? It must never be a share of guest money.

### 12. Invoice emailed to the business

- Type: External. Lane: External. Status: Draft.
- What happens: TapIt only invoices businesses. No guest money passes through TapIt.
- Next:
  - go to 13. Business pays by EFT

### 13. Business pays by EFT

- Type: Action. Lane: Business. Status: Draft.
- Next:
  - go to 14. Record the payment

### 14. Record the payment

- Type: Backend. Lane: Backend. Status: Draft.
- Writes: payments, invoices (status=paid)
- Next:
  - go to 15. Statements in the business portal

### 15. Statements in the business portal

- Type: Screen. Lane: Business. Status: Draft.
- What happens: Invoices, credit notes and payment history.

## Trip recording, profile and replay

When a guest creates a profile, what location data is captured and kept, how the 3D replay loads, and how a guest deletes their data.

### 1. Trips tab

- Type: Screen. Lane: Frontend. Status: Draft.
- Mockup: App.dc.html
- Next:
  - go to 2. Taps Record a new trip

### 2. Taps Record a new trip

- Type: Action. Lane: Guest. Status: Draft.
- Next:
  - go to 3. Record sheet with the location consent switch

### 3. Record sheet with the location consent switch

- Type: Screen. Lane: Frontend. Status: Draft.
- What happens: Explains what is stored and that it is private.
- Mockup: App.dc.html
- Next:
  - go to 4. Consent given?

### 4. Consent given?

- Type: Decision. Lane: Frontend. Status: Draft.
- Next:
  - If no: go to 6. Back to Trips. Nothing is recorded.
  - If yes: go to 5. Guest already has a profile?

### 5. Guest already has a profile?

- Type: Decision. Lane: Backend. Status: Draft.
- Next:
  - If no: go to 8. Email sign-in link
  - If yes: go to 7. Records the trip

### 6. Back to Trips. Nothing is recorded.

- Type: Screen. Lane: Frontend. Status: Draft.

### 7. Records the trip

- Type: Action. Lane: Guest. Status: Draft.
- What happens: Browser location while the page is open and the screen is on. Points are kept on the phone and sent when the signal returns.
- Writes: trips, track_points (geometry, time, accuracy)
- API: POST /api/trips/{id}/points (batched)
- Next:
  - go to 10. Save the trip
  - go to 9. Do we ship background tracking, or only import GPX for long hikes?

### 8. Email sign-in link

- Type: Screen. Lane: Frontend. Status: Draft.
- What happens: Passwordless.
- Captures:
  - Email (email, required) **personal information**
- Next:
  - go to 11. Explorer profile created

### 9. Do we ship background tracking, or only import GPX for long hikes?

- Type: Open question. Lane: Admin. Status: Open question.
- What happens: Browsers pause tracking when the screen is off. A native wrapper is a later option.

### 10. Save the trip

- Type: Backend. Lane: Backend. Status: Draft.
- What happens: Private by default.
- Writes: trips (visibility=private)
- Next:
  - go to 13. Trip replay: 3D and flat map
  - go to 12. How long do we keep track points?

### 11. Explorer profile created

- Type: Profile. Lane: Backend. Status: Draft.
- Captures:
  - Email (email, required) **personal information**
  - Display name (text, optional) **personal information**
  - Location consent (boolean, required)
  - Consent given at (timestamp, required)
- Writes: users (role=explorer), consents
- Next:
  - go to 7. Records the trip

### 12. How long do we keep track points?

- Type: Open question. Lane: Admin. Status: Open question.
- What happens: POPIA: keep only as long as needed. Proposal: 12 months, then delete.

### 13. Trip replay: 3D and flat map

- Type: Screen. Lane: Frontend. Status: Draft.
- What happens: The route draws itself over the terrain. Toggle 3D and flat. Replay button.
- Reads: track_points, terrain tiles (self-hosted)
- Mockup: App.dc.html
- Next:
  - go to 14. Share the trip?
  - go to 15. Deletes or exports their data
  - go to 16. Where do the terrain tiles come from, and what do they cost?

### 14. Share the trip?

- Type: Decision. Lane: Frontend. Status: Draft.
- Next:
  - If yes: go to 17. Create a share link

### 15. Deletes or exports their data

- Type: Action. Lane: Guest. Status: Draft.
- What happens: Delete my trips and Export my data in Privacy settings.
- Writes: deletions, audit_log

### 16. Where do the terrain tiles come from, and what do they cost?

- Type: Open question. Lane: Admin. Status: Open question.
- What happens: Self-host as PMTiles. Check licensing for the elevation data.

### 17. Create a share link

- Type: Action. Lane: Guest. Status: Draft.
- Writes: trip_shares

## Open questions

- **Guest taps a stand and explores. Can partners add the referral code at their own checkout?.** This decides whether referrals can be matched automatically. Ask the client and the first partners.
- **Business onboarding to a live stand. Who writes the content for each pilot site?.** The owner, the client or us. Decides how much editor help we offer.
- **Business onboarding to a live stand. Which languages are needed at launch?.** English, Afrikaans, German?
- **Referral commission and billing. What is the commission rate, and is it per partner?.**
- **Referral commission and billing. How are cancellations and chargebacks handled?.** Credit notes against the next invoice?
- **Referral commission and billing. What does "royalty" mean?.** A share of TapIt income to the forum or partners, or member points? It must never be a share of guest money.
- **Trip recording, profile and replay. Do we ship background tracking, or only import GPX for long hikes?.** Browsers pause tracking when the screen is off. A native wrapper is a later option.
- **Trip recording, profile and replay. How long do we keep track points?.** POPIA: keep only as long as needed. Proposal: 12 months, then delete.
- **Trip recording, profile and replay. Where do the terrain tiles come from, and what do they cost?.** Self-host as PMTiles. Check licensing for the elevation data.

## Data captured (all flows)

| Flow | Step | Field | Type | Required | Personal info |
|---|---|---|---|---|---|
| Business onboarding to a live stand | Admin creates the business | Business name | text | yes | no |
| Business onboarding to a live stand | Admin creates the business | Town | text | yes | no |
| Business onboarding to a live stand | Admin creates the business | Contact email | email | yes | yes |
| Business onboarding to a live stand | Admin creates the business | WhatsApp number | phone | no | yes |
| Business onboarding to a live stand | Admin creates the business | Plan | select | yes | no |
| Business onboarding to a live stand | Owner profile created | Display name | text | yes | yes |
| Business onboarding to a live stand | Owner profile created | Email | email | yes | yes |
| Business onboarding to a live stand | Owner profile created | Terms accepted at | timestamp | yes | no |
| Business onboarding to a live stand | Owner profile created | Privacy notice version | text | yes | no |
| Trip recording, profile and replay | Email sign-in link | Email | email | yes | yes |
| Trip recording, profile and replay | Explorer profile created | Email | email | yes | yes |
| Trip recording, profile and replay | Explorer profile created | Display name | text | no | yes |
| Trip recording, profile and replay | Explorer profile created | Location consent | boolean | yes | no |
| Trip recording, profile and replay | Explorer profile created | Consent given at | timestamp | yes | no |

## Backend touchpoints (all flows)

| Flow | Step | Reads | Writes | API |
|---|---|---|---|---|
| Guest taps a stand and explores | Find the stand | units, tenants | events (scan: unit_id, tenant_id, anonymous session id, time) | GET /t/{code} |
| Guest taps a stand and explores | Concierge: Stay tab | page_versions (published), offers |  | GET /api/t/{code}/concierge |
| Guest taps a stand and explores | Explore tab | listings, offers (by tenant region) |  | GET /api/listings?unit={code} |
| Guest taps a stand and explores | Log the click |  | events (click: target, unit_id) | POST /api/events |
| Guest taps a stand and explores | Create the referral and redirect |  | referrals (unit_id, listing_id, referral_code, session id, status=clicked) | GET /go/{referral_code} |
| Business onboarding to a live stand | Admin creates the business |  | tenants, agreements | POST /api/admin/tenants |
| Business onboarding to a live stand | Send the invite link |  | invites (token, expires) | POST /api/admin/invites |
| Business onboarding to a live stand | Create the owner account |  | users (role=owner, tenant_id), sessions |  |
| Business onboarding to a live stand | Concierge editor |  | pages (draft) | PUT /api/portal/page |
| Business onboarding to a live stand | Publish changes |  | page_versions (published) |  |
| Business onboarding to a live stand | Assign and program the stand |  | units (tenant_id, code, status=active) |  |
| Business onboarding to a live stand | Stand goes live |  | audit_log, events |  |
| Referral commission and billing | Referral recorded |  | referrals (status=clicked) |  |
| Referral commission and billing | Match the referral | referrals, partner confirmations | referrals (status=matched) |  |
| Referral commission and billing | Month-end invoice run | agreements, referrals, subscriptions | invoices, invoice_lines |  |
| Referral commission and billing | Record the payment |  | payments, invoices (status=paid) |  |
| Trip recording, profile and replay | Records the trip |  | trips, track_points (geometry, time, accuracy) | POST /api/trips/{id}/points (batched) |
| Trip recording, profile and replay | Save the trip |  | trips (visibility=private) |  |
| Trip recording, profile and replay | Explorer profile created |  | users (role=explorer), consents |  |
| Trip recording, profile and replay | Trip replay: 3D and flat map | track_points, terrain tiles (self-hosted) |  |  |
| Trip recording, profile and replay | Deletes or exports their data |  | deletions, audit_log |  |
| Trip recording, profile and replay | Create a share link |  | trip_shares |  |
