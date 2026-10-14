// Seeds planning/flows with the starting TapIt flows, laid out automatically.
// Run once: `npm run seed`. Existing files are NOT overwritten unless you pass --force.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dagre from '@dagrejs/dagre';

const here = path.dirname(fileURLToPath(import.meta.url));
const planning = process.env.PLANNING_DIR || path.resolve(here, '..', '..', 'planning');
const dir = path.join(planning, 'flows');
fs.mkdirSync(dir, { recursive: true });
const force = process.argv.includes('--force');

const f = (name, type, required, pii) => ({ name, type, required, pii });
const n = (id, kind, lane, title, notes = '', x = {}) => ({
  id,
  type: 'step',
  position: { x: 0, y: 0 },
  data: { title, kind, lane, status: kind === 'question' ? 'question' : 'draft', notes, fields: [], reads: '', writes: '', api: '', mockup: '', comments: [], ...x }
});
const e = (source, target, label) => ({ id: `${source}-${target}`, source, target, ...(label ? { label } : {}) });

const flows = [
  {
    id: '01-guest-tap-to-concierge',
    title: 'Guest taps a stand and explores',
    description: 'What happens from the moment a guest taps the NFC stand: how the page is found, what loads, what is logged, and how a guest is sent to a partner.',
    nodes: [
      n('g1', 'action', 'Guest', 'Guest taps the NFC stand or scans the QR code', 'The phone opens tapit.info/t/{code}. No app and no sign-up.'),
      n('g2', 'backend', 'Backend', 'Find the stand', 'Look up the stand code and its business. Record an anonymous scan.', { reads: 'units, tenants', writes: 'events (scan: unit_id, tenant_id, anonymous session id, time)', api: 'GET /t/{code}' }),
      n('g3', 'decision', 'Backend', 'Stand active and page published?'),
      n('g4', 'screen', 'Frontend', 'Fallback page: this stand is not active yet', 'Show TapIt information and a contact link.'),
      n('g5', 'screen', 'Frontend', 'Concierge: Stay tab', 'Host name, quick actions (Wi-Fi, WhatsApp, Review, Call), breakfast, check-out and the featured trail.', { mockup: 'App.dc.html', reads: 'page_versions (published), offers', api: 'GET /api/t/{code}/concierge' }),
      n('g6', 'action', 'Guest', 'Taps a quick action', 'Wi-Fi copies the password. WhatsApp, Review and Call open the other app.'),
      n('g7', 'backend', 'Backend', 'Log the click', 'Record which button was used from which stand.', { writes: 'events (click: target, unit_id)', api: 'POST /api/events' }),
      n('g8', 'screen', 'Frontend', 'Explore tab', 'Search, category filters and places near this stand. Guests can save places.', { mockup: 'App.dc.html', reads: 'listings, offers (by tenant region)', api: 'GET /api/listings?unit={code}' }),
      n('g9', 'screen', 'Frontend', 'Place detail sheet', 'Description, operator, price, Save and Book with operator.', { mockup: 'App.dc.html' }),
      n('g10', 'action', 'Guest', 'Taps Book with operator'),
      n('g11', 'backend', 'Backend', 'Create the referral and redirect', 'The guest is sent to the operator with a referral code so the booking can be traced to this stand.', { writes: 'referrals (unit_id, listing_id, referral_code, session id, status=clicked)', api: 'GET /go/{referral_code}' }),
      n('g12', 'external', 'External', "Operator's own booking page", 'The guest books and pays the operator directly. TapIt never takes the payment.'),
      n('g13', 'question', 'Admin', 'Can partners add the referral code at their own checkout?', 'This decides whether referrals can be matched automatically. Ask the client and the first partners.'),
      n('g14', 'screen', 'Frontend', 'Trips, Wallet and Passport tabs', 'See the trip recording flow.', { mockup: 'App.dc.html' })
    ],
    edges: [e('g1', 'g2'), e('g2', 'g3'), e('g3', 'g4', 'no'), e('g3', 'g5', 'yes'), e('g5', 'g6'), e('g6', 'g7'), e('g5', 'g8'), e('g8', 'g9'), e('g9', 'g10'), e('g10', 'g11'), e('g11', 'g12'), e('g11', 'g13'), e('g5', 'g14')]
  },
  {
    id: '02-business-onboarding',
    title: 'Business onboarding to a live stand',
    description: 'How a guesthouse or operator goes from signed up to a working stand: who creates what, what is captured, and what goes live.',
    nodes: [
      n('b1', 'action', 'Admin', 'Admin creates the business', 'Name, town, contact and plan.', { fields: [f('Business name', 'text', true, false), f('Town', 'text', true, false), f('Contact email', 'email', true, true), f('WhatsApp number', 'phone', false, true), f('Plan', 'select', true, false)], writes: 'tenants, agreements', api: 'POST /api/admin/tenants' }),
      n('b2', 'backend', 'Backend', 'Send the invite link', 'A sign-in link is emailed from our own mail server.', { writes: 'invites (token, expires)', api: 'POST /api/admin/invites' }),
      n('b3', 'action', 'Business', 'Owner opens the invite link'),
      n('b4', 'backend', 'Backend', 'Create the owner account', 'Passwordless. A session is started.', { writes: 'users (role=owner, tenant_id), sessions' }),
      n('b5', 'profile', 'Business', 'Owner profile created', 'The owner accepts the terms and privacy notice on first sign-in.', { fields: [f('Display name', 'text', true, true), f('Email', 'email', true, true), f('Terms accepted at', 'timestamp', true, false), f('Privacy notice version', 'text', true, false)] }),
      n('b6', 'screen', 'Business', 'Concierge editor', 'Edit welcome, hours, Wi-Fi, quick actions, content blocks and accent colour with a live phone preview.', { mockup: 'Portal.dc.html', writes: 'pages (draft)', api: 'PUT /api/portal/page' }),
      n('b7', 'decision', 'Business', 'Ready to go live?'),
      n('b8', 'action', 'Business', 'Publish changes', 'Confirm dialog, then a new version number. Older versions can be restored.', { writes: 'page_versions (published)' }),
      n('b9', 'action', 'Admin', 'Assign and program the stand', 'Link the unit code to the business and write the URL to the NFC chip.', { writes: 'units (tenant_id, code, status=active)' }),
      n('b10', 'backend', 'Backend', 'Stand goes live', 'The first scan is recorded and the admin is told.', { writes: 'audit_log, events' }),
      n('b11', 'question', 'Admin', 'Who writes the content for each pilot site?', 'The owner, the client or us. Decides how much editor help we offer.'),
      n('b12', 'question', 'Business', 'Which languages are needed at launch?', 'English, Afrikaans, German?')
    ],
    edges: [e('b1', 'b2'), e('b2', 'b3'), e('b3', 'b4'), e('b4', 'b5'), e('b5', 'b6'), e('b6', 'b7'), e('b7', 'b6', 'not yet'), e('b7', 'b8', 'yes'), e('b8', 'b9'), e('b9', 'b10'), e('b6', 'b11'), e('b6', 'b12')]
  },
  {
    id: '03-referral-and-billing',
    title: 'Referral commission and billing',
    description: 'How a booking is traced back to a stand, verified, and turned into an invoice. TapIt only invoices businesses and never handles guest money.',
    nodes: [
      n('r1', 'action', 'Guest', 'Guest books with a partner after tapping Book', 'Starts in the guest tap flow.'),
      n('r2', 'backend', 'Backend', 'Referral recorded', '', { writes: 'referrals (status=clicked)' }),
      n('r3', 'external', 'External', 'Partner confirms the booking', 'In their portal, or by quoting the referral code at checkout.'),
      n('r4', 'backend', 'Backend', 'Match the referral', 'Three signals: referral code or tagged link, partner confirmation, and spot-checks.', { reads: 'referrals, partner confirmations', writes: 'referrals (status=matched)' }),
      n('r5', 'decision', 'Backend', 'Matched and not disputed?'),
      n('r6', 'screen', 'Admin', 'Referral claims queue', 'Admin reviews disputed or unmatched claims and asks the partner for proof.', { mockup: 'Ledger.dc.html (first round)' }),
      n('r7', 'backend', 'Backend', 'Month-end invoice run', 'Group matched referrals by business, apply the agreement rate, then add subscription and feature lines.', { reads: 'agreements, referrals, subscriptions', writes: 'invoices, invoice_lines' }),
      n('r8', 'action', 'Admin', 'Review and issue invoices'),
      n('r9', 'external', 'External', 'Invoice emailed to the business', 'TapIt only invoices businesses. No guest money passes through TapIt.'),
      n('r10', 'action', 'Business', 'Business pays by EFT'),
      n('r11', 'backend', 'Backend', 'Record the payment', '', { writes: 'payments, invoices (status=paid)' }),
      n('r12', 'screen', 'Business', 'Statements in the business portal', 'Invoices, credit notes and payment history.'),
      n('r13', 'question', 'Admin', 'What is the commission rate, and is it per partner?'),
      n('r14', 'question', 'Admin', 'How are cancellations and chargebacks handled?', 'Credit notes against the next invoice?'),
      n('r15', 'question', 'Admin', 'What does "royalty" mean?', 'A share of TapIt income to the forum or partners, or member points? It must never be a share of guest money.')
    ],
    edges: [e('r1', 'r2'), e('r2', 'r3'), e('r3', 'r4'), e('r4', 'r5'), e('r5', 'r7', 'yes'), e('r5', 'r6', 'no'), e('r6', 'r4', 'resolved'), e('r7', 'r8'), e('r8', 'r9'), e('r9', 'r10'), e('r10', 'r11'), e('r11', 'r12'), e('r7', 'r13'), e('r7', 'r14'), e('r7', 'r15')]
  },
  {
    id: '04-trip-recording-and-replay',
    title: 'Trip recording, profile and replay',
    description: 'When a guest creates a profile, what location data is captured and kept, how the 3D replay loads, and how a guest deletes their data.',
    nodes: [
      n('t1', 'screen', 'Frontend', 'Trips tab', '', { mockup: 'App.dc.html' }),
      n('t2', 'action', 'Guest', 'Taps Record a new trip'),
      n('t3', 'screen', 'Frontend', 'Record sheet with the location consent switch', 'Explains what is stored and that it is private.', { mockup: 'App.dc.html' }),
      n('t4', 'decision', 'Frontend', 'Consent given?'),
      n('t5', 'screen', 'Frontend', 'Back to Trips. Nothing is recorded.'),
      n('t6', 'decision', 'Backend', 'Guest already has a profile?'),
      n('t7', 'screen', 'Frontend', 'Email sign-in link', 'Passwordless.', { fields: [f('Email', 'email', true, true)] }),
      n('t8', 'profile', 'Backend', 'Explorer profile created', '', { fields: [f('Email', 'email', true, true), f('Display name', 'text', false, true), f('Location consent', 'boolean', true, false), f('Consent given at', 'timestamp', true, false)], writes: 'users (role=explorer), consents' }),
      n('t9', 'action', 'Guest', 'Records the trip', 'Browser location while the page is open and the screen is on. Points are kept on the phone and sent when the signal returns.', { writes: 'trips, track_points (geometry, time, accuracy)', api: 'POST /api/trips/{id}/points (batched)' }),
      n('t10', 'backend', 'Backend', 'Save the trip', 'Private by default.', { writes: 'trips (visibility=private)' }),
      n('t11', 'screen', 'Frontend', 'Trip replay: 3D and flat map', 'The route draws itself over the terrain. Toggle 3D and flat. Replay button.', { mockup: 'App.dc.html', reads: 'track_points, terrain tiles (self-hosted)' }),
      n('t12', 'decision', 'Frontend', 'Share the trip?'),
      n('t13', 'action', 'Guest', 'Create a share link', '', { writes: 'trip_shares' }),
      n('t14', 'action', 'Guest', 'Deletes or exports their data', 'Delete my trips and Export my data in Privacy settings.', { writes: 'deletions, audit_log' }),
      n('t15', 'question', 'Admin', 'Do we ship background tracking, or only import GPX for long hikes?', 'Browsers pause tracking when the screen is off. A native wrapper is a later option.'),
      n('t16', 'question', 'Admin', 'How long do we keep track points?', 'POPIA: keep only as long as needed. Proposal: 12 months, then delete.'),
      n('t17', 'question', 'Admin', 'Where do the terrain tiles come from, and what do they cost?', 'Self-host as PMTiles. Check licensing for the elevation data.')
    ],
    edges: [e('t1', 't2'), e('t2', 't3'), e('t3', 't4'), e('t4', 't5', 'no'), e('t4', 't6', 'yes'), e('t6', 't7', 'no'), e('t7', 't8'), e('t6', 't9', 'yes'), e('t8', 't9'), e('t9', 't10'), e('t10', 't11'), e('t11', 't12'), e('t12', 't13', 'yes'), e('t11', 't14'), e('t9', 't15'), e('t10', 't16'), e('t11', 't17')]
  }
];

for (const flow of flows) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 90 });
  flow.nodes.forEach((x) => g.setNode(x.id, { width: 250, height: 110 }));
  flow.edges.forEach((x) => g.setEdge(x.source, x.target));
  dagre.layout(g);
  flow.nodes.forEach((x) => {
    const p = g.node(x.id);
    x.position = { x: Math.round(p.x - 125), y: Math.round(p.y - 55) };
  });
  const file = path.join(dir, `${flow.id}.flow.json`);
  if (fs.existsSync(file) && !force) {
    console.log('kept existing', path.basename(file));
    continue;
  }
  fs.writeFileSync(file, JSON.stringify(flow, null, 2) + '\n');
  console.log('wrote', path.basename(file), `(${flow.nodes.length} nodes)`);
}
