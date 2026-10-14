// Builds planning/questions.json from docs/01-client-questions.md plus the extra questions
// that came out of the flow maps. After the first run the JSON is the source of truth:
// this script will not overwrite it unless you pass --force.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const planning = process.env.PLANNING_DIR || path.join(repo, 'planning');
const out = path.join(planning, 'questions.json');
if (fs.existsSync(out) && !process.argv.includes('--force')) {
  console.log('planning/questions.json already exists. Use --force to rebuild it.');
  process.exit(0);
}

const md = fs.readFileSync(path.join(repo, 'docs', '01-client-questions.md'), 'utf8').split('\n');

// Why we ask: shown to the client under the question. Only for the ones that block work.
const WHY = {
  1: 'Decides how many stands we make and how much content we prepare before the pilot.',
  2: 'Decides whether we build a simple form for owners or write the content for them.',
  7: 'The company name goes on the invoices, the terms and the privacy policy.',
  8: 'We need to know who holds the keys before we set anything up.',
  11: 'The pricing model decides how billing is built, so it must be settled early.',
  12: 'Commission only works if we can trace and verify bookings. This shapes the billing flow.',
  17: 'Stand cost and lead time decide the setup fee and how soon pilot sites can go live.',
  19: 'POPIA requires a named Information Officer before we collect any guest data.',
  23: 'We need the server details before we can deploy the pilot.',
  24: 'We need control of the domain name to put the pilot site on it.',
  29: 'The 3D trip replay is the most demanding feature. We want to confirm the scope.'
};

// Questions that came out of the flow maps (see planning/flows). Numbered after the document's own.
const EXTRA = [
  { text: 'Who funds the Passport prizes (for example the Kogelberg Explorer prize): sponsors, partners, or the forum?', first: false, why: '', related: [] },
  { text: 'Can partners add the TapIt referral code at their own checkout, or must they confirm each booking by hand in the portal?', first: true, why: 'This decides whether referrals can be matched automatically or need manual checking.', related: [{ flow: '01-guest-tap-to-concierge', step: 'g13', title: 'Referral code at partner checkout' }] },
  { text: 'How should cancellations and chargebacks affect commission? For example, a credit note against the next invoice.', first: false, why: '', related: [{ flow: '03-referral-and-billing', step: 'r14', title: 'Cancellations and chargebacks' }] },
  { text: 'For long hikes, is it acceptable that phone tracking pauses when the screen is off, with GPX import from a watch as the fallback?', first: false, why: 'Browsers pause location tracking in the background. The alternative is a native app, which is a later and larger step.', related: [{ flow: '04-trip-recording-and-replay', step: 't15', title: 'Background tracking or GPX import' }] },
  { text: "How long may we keep a guest's recorded trip points? We propose 12 months, then delete.", first: true, why: 'POPIA says personal information must not be kept longer than needed.', related: [{ flow: '04-trip-recording-and-replay', step: 't16', title: 'Retention of track points' }] }
];

// Existing questions that match a question step in a flow.
const RELATED = {
  2: [{ flow: '02-business-onboarding', step: 'b11', title: 'Who writes the content' }],
  3: [{ flow: '02-business-onboarding', step: 'b12', title: 'Languages at launch' }],
  12: [{ flow: '03-referral-and-billing', step: 'r13', title: 'Commission rate' }],
  15: [{ flow: '03-referral-and-billing', step: 'r15', title: 'What royalty means' }],
  29: [{ flow: '04-trip-recording-and-replay', step: 't11', title: 'Trip replay' }]
};

const questions = [];
let section = '';
for (const line of md) {
  const h = line.match(/^##\s+[A-Z]\.\s+(.*)$/);
  if (h) { section = h[1].replace(/\s*\(.*\)\s*$/, '').trim(); continue; }
  const q = line.match(/^(\d+)\.\s+(★\s+)?(.*)$/);
  if (q && section) {
    const n = Number(q[1]);
    questions.push({ id: `q${String(n).padStart(2, '0')}`, num: n, section, text: q[3].trim(), priority: q[2] ? 'first' : 'normal', why: WHY[n] || '', related: RELATED[n] || [], source: 'docs/01-client-questions.md' });
  }
}
let n = questions.length;
for (const e of EXTRA) {
  n += 1;
  questions.push({ id: `q${String(n).padStart(2, '0')}`, num: n, section: 'From the flow maps', text: e.text, priority: e.first ? 'first' : 'normal', why: e.why, related: e.related, source: 'planning/flows' });
}
fs.writeFileSync(out, JSON.stringify(questions, null, 2) + '\n');
const bySection = questions.reduce((a, q) => ((a[q.section] = (a[q.section] || 0) + 1), a), {});
console.log(`Wrote ${questions.length} questions (${questions.filter((q) => q.priority === 'first').length} needed first)`, bySection);
