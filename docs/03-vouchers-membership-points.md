# Vouchers, Membership and Points – business rules

## Membership (purchasable)
- Tiers: **Explorer** (free), **Insider** (paid, annual), **VIP** (paid, annual). Prices are placeholders until agreed.
- Entitlements are data, not code: a `plans` table links each tier to `perks` (discount %, freebie, early access, points multiplier).
- Purchase via a hosted payment page (no card data on our servers). Webhook confirms payment, then creates `memberships` row and a ledger entry (membership revenue, VAT).
- Renewal reminders by email; cancellation and refund rules come from the Terms (needs legal review).

## Vouchers
- Types: partner-funded (business pays), sponsor-funded (sponsor pays), TapIt-funded (marketing).
- Fields: `issuer`, `funder`, `value` (percent, fixed amount or freebie), `eligible_tiers`, `valid_from/to`, `max_redemptions`, `per_user_limit`.
- Redemption: user shows a one-time QR/code; the business confirms in the portal (or scans). Each redemption is an event and, where the funder is not the issuer, a ledger entry so the funder is billed correctly.
- Fraud controls: single-use codes, rotating QR, per-user limits, admin reversal with reason.

## Points ("royalties")
- Earn rules: points per rand on completed bookings (multiplier by tier), stamp bonuses, challenge completion.
- Points are a ledger of earn/spend entries, never an editable balance. Balance = sum of entries.
- Expiry policy: to be decided (e.g. 12 months). Points have no cash value in the terms.
- Spend: redeem for vouchers or perks.

## Money ledger (separate from points)
- Accounts: guest payments, operator payable, commission income, forum/partner royalty payable, membership revenue, voucher funding receivable, VAT.
- "Royalty" in the client's wording may mean either partner revenue share (money) or member points. Confirm with the client; the design keeps them separate.

## Open questions for the client
1. Is "royalty" a revenue share to a partner, a member points scheme, or both?
2. Who funds vouchers: the issuing business, sponsors, or TapIt?
3. Do points expire? Are tier prices annual only, or monthly too?
4. Cancellation and refund policy for memberships?
