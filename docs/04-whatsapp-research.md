# WhatsApp: notes for the real app MVP

Studio (the planning app) does **not** use WhatsApp. A short experiment with OpenWA (https://github.com/rmyndharis/OpenWA) was built, tested against a stand-in server, and then removed on purpose. The plan is to test WhatsApp inside the real TapIt app's MVP instead. This note keeps what was learned.

## OpenWA risks (from its own README and docs)

- It uses reverse-engineered clients (whatsapp-web.js or Baileys), not Meta's official Cloud API. Numbers can be restricted or banned. There is no appeal path through OpenWA.
- A WhatsApp protocol change can break it until the maintainers catch up.
- Some accounts cannot link a new device at all (a passkey step neither engine supports).
- The first message to a brand-new contact may silently never arrive, even though the API says it was sent.
- A linked session can read everything on that number, so its API key is a high-value secret.
- The safer engine runs a headless Chromium (about 300 to 500 MB of RAM per session). Datacenter IPs are flagged more often than home connections.
- The README says it is not approved for regulated or large-scale commercial messaging. Use Meta's Cloud API there.

## If WhatsApp goes into the real MVP

- Test with a **dedicated number**. Keep another channel (in-app inbox, email) so nothing depends on WhatsApp.
- Consider Meta's official WhatsApp Cloud API for anything guest-facing or paid. It avoids the ban risk but needs business verification and approved message templates.
- Guest-facing "message the guesthouse" buttons should be plain `https://wa.me/<number>` links. They need no gateway.
- Never route invoices, commission statements or anything contractual through it. Those need an email record.

## What worked in the experiment (reusable design)

- People link their own number and confirm it with a 6-digit code sent to it. Nobody is messaged otherwise.
- Strangers who message the number get no reply.
- Notifications are batched into one digest, and capped per person per day, to look like normal use.
- Replies are accepted only through a webhook with a verified HMAC signature, de-duplicated by idempotency key, and attached to the conversation the person was last told about.
- STOP and START commands pause and resume messages.
- An invite link delivered on WhatsApp can also confirm the recipient's number.

The code was in commit `456ca72` of this repository (reverted afterwards). `git show 456ca72` shows it.
