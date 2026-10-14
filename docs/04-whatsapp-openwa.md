# WhatsApp for Studio messages (OpenWA)

TapIt Studio can send every message between the client and the developer to WhatsApp, and take replies back into the same conversation. It uses **OpenWA** (https://github.com/rmyndharis/OpenWA), a self-hosted WhatsApp gateway. Nothing goes through a third-party service except WhatsApp itself.

## Read this first: the risk

OpenWA is an **unofficial** gateway. It is not Meta's official WhatsApp Cloud API. WhatsApp can restrict or ban a number that is automated this way. OpenWA's own README says so plainly.

- Use a **dedicated number** you can afford to lose. Never your own personal or business number.
- Studio keeps the risk low on purpose: only the **client and the developer** are messaged (people who expect it), messages are **batched** (one digest, not one message per reply), there is a **daily cap per person** (default 30), and nobody is messaged unless they linked and confirmed their own number. Strangers who message the number get **no answer**.
- Keep email (and the Inbox) on as a fallback. If the number is ever restricted, nothing is lost.
- OpenWA says it is not approved for regulated work. This use (project messages between two parties) is the kind of small internal use it is suited to. It is not for messaging the public or guests.

## What it does

| Direction | What happens |
|---|---|
| Studio to you | A short digest on WhatsApp when new messages arrive, with the sender, a preview and a link. |
| You to Studio | Reply on WhatsApp. It is added to the conversation you were last notified about. |
| Invites | In Team, add a mobile number and the invite link is sent on WhatsApp. Opening it also confirms the number. |
| Controls | Send STOP to pause WhatsApp messages and START to resume. The Notifications button in the top bar links or removes your number. |

Replies only attach to the **latest** conversation you were told about (within 2 days). Anything else says "open Studio". Images are not carried over from WhatsApp.

## Set up

1. On the VM, start OpenWA from its own repository: `docker compose up -d` (see its README). Open its dashboard, create a session (for example `studio`), scan the QR code with the **dedicated** number's WhatsApp, and create an **operator** API key.
2. Put Studio and OpenWA on the same Docker network so Studio can reach `http://openwa:2785`.
3. Set these for Studio (Portainer stack variables or `studio/.env.local`):

   ```
   STUDIO_WA_URL=http://openwa:2785
   STUDIO_WA_API_KEY=<the OpenWA API key>
   STUDIO_WA_SESSION=studio
   STUDIO_WA_WEBHOOK_SECRET=<a random string of 16+ characters>
   STUDIO_WA_DEFAULT_COUNTRY=27
   STUDIO_PUBLIC_URL=https://<the address your client opens>
   ```

   Leave `STUDIO_WA_WEBHOOK_SECRET` empty for sending only (no replies).

4. To receive replies, register a webhook in OpenWA for that session pointing at Studio:

   ```
   POST http://openwa:2785/api/sessions/studio/webhooks
   X-API-Key: <key>
   {"url":"http://studio:3100/api/wa/webhook","events":["message.received"],"secret":"<same as STUDIO_WA_WEBHOOK_SECRET>"}
   ```

   OpenWA blocks webhook targets on private addresses by default (`WEBHOOK_SSRF_PROTECT`). Either add Studio's host to OpenWA's `SSRF_ALLOWED_HOSTS` or turn that protection off for your private network. Check OpenWA's `.env.example`, because its bundled compose files do not pass every variable through. Setting `RESOLVE_LID_TO_PHONE=true` in OpenWA helps when WhatsApp hides a sender's number.
5. Sign in to Studio, press **Notifications**, enter your number, type the code WhatsApp sends you.

Studio checks the `X-OpenWA-Signature` HMAC on every webhook and ignores duplicates (`X-OpenWA-Idempotency-Key`).

## Privacy (POPIA)

Phone numbers are stored only for the two parties using Studio, only to message them about this project, and only after they confirm the number with a code. "Remove my number" in Notifications deletes it. WhatsApp message content passes through your own OpenWA and through WhatsApp.

## Not tested against a real number

This was built from OpenWA's published API documentation and tested against a stand-in server that behaves as the documentation describes. Before relying on it, test once with your real dedicated number: link it, send yourself a message from Studio, reply, send STOP.
