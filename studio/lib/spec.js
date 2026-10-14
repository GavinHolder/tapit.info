// Turns the flow maps into a plain-English build spec (SPEC.md).
// Shared by the Studio "Export spec" button and `npm run spec`.

const KIND = { screen: 'Screen', action: 'Action', decision: 'Decision', data: 'Data captured', backend: 'Backend', profile: 'Profile', external: 'External', question: 'Open question' };
const STATUS = { draft: 'Draft', agreed: 'Agreed', question: 'Open question' };

function order(flow) {
  const incoming = new Map(flow.nodes.map((n) => [n.id, 0]));
  flow.edges.forEach((e) => incoming.set(e.target, (incoming.get(e.target) || 0) + 1));
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const starts = flow.nodes.filter((n) => !incoming.get(n.id)).sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
  const seen = new Set();
  const out = [];
  const queue = [...starts];
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
    flow.edges
      .filter((e) => e.source === n.id)
      .map((e) => byId.get(e.target))
      .filter(Boolean)
      .sort((a, b) => a.position.y - b.position.y)
      .forEach((t) => queue.push(t));
  }
  flow.nodes.filter((n) => !seen.has(n.id)).forEach((n) => out.push(n));
  return out;
}

export function buildSpec(flows) {
  const L = [];
  L.push('# TapIt build spec');
  L.push('');
  L.push('Generated from `planning/flows/*.flow.json` by TapIt Studio. Edit the flows in Studio, not this file.');
  L.push('');
  const questions = [];
  const data = [];
  const backend = [];

  for (const flow of flows) {
    const nodes = order(flow);
    const num = new Map(nodes.map((n, i) => [n.id, i + 1]));
    const byId = new Map(flow.nodes.map((n) => [n.id, n]));
    L.push(`## ${flow.title}`);
    L.push('');
    if (flow.description) { L.push(flow.description); L.push(''); }
    for (const n of nodes) {
      const d = n.data;
      L.push(`### ${num.get(n.id)}. ${d.title}`);
      L.push('');
      L.push(`- Type: ${KIND[d.kind] || d.kind}. Lane: ${d.lane}. Status: ${STATUS[d.status] || d.status}.`);
      if (d.notes) L.push(`- What happens: ${d.notes.replace(/\n+/g, ' ')}`);
      if (d.fields && d.fields.length) {
        L.push('- Captures:');
        d.fields.forEach((f) => {
          L.push(`  - ${f.name} (${f.type}${f.required ? ', required' : ', optional'})${f.pii ? ' **personal information**' : ''}`);
          data.push({ flow: flow.title, step: d.title, ...f });
        });
      }
      if (d.reads) L.push(`- Reads: ${d.reads}`);
      if (d.writes) L.push(`- Writes: ${d.writes}`);
      if (d.api) L.push(`- API: ${d.api}`);
      if (d.reads || d.writes || d.api) backend.push({ flow: flow.title, step: d.title, reads: d.reads, writes: d.writes, api: d.api });
      if (d.mockup) L.push(`- Mockup: ${d.mockup}`);
      const outs = flow.edges.filter((e) => e.source === n.id);
      if (outs.length) {
        L.push('- Next:');
        outs.forEach((e) => {
          const t = byId.get(e.target);
          if (t) L.push(`  - ${e.label ? `If ${e.label}: ` : ''}go to ${num.get(t.id)}. ${t.data.title}`);
        });
      }
      const cs = d.comments || [];
      if (cs.length) {
        L.push('- Comments:');
        cs.forEach((c) => L.push(`  - ${c.author}: ${c.text.replace(/\n+/g, ' ')}`));
      }
      if (d.status === 'question' || d.kind === 'question') questions.push({ flow: flow.title, step: d.title, notes: d.notes });
      L.push('');
    }
  }

  L.push('## Open questions');
  L.push('');
  if (!questions.length) L.push('None.');
  questions.forEach((q) => L.push(`- **${q.flow}. ${q.step}.** ${q.notes || ''}`.trim()));
  L.push('');
  L.push('## Data captured (all flows)');
  L.push('');
  if (!data.length) L.push('None recorded.');
  else {
    L.push('| Flow | Step | Field | Type | Required | Personal info |');
    L.push('|---|---|---|---|---|---|');
    data.forEach((f) => L.push(`| ${f.flow} | ${f.step} | ${f.name} | ${f.type} | ${f.required ? 'yes' : 'no'} | ${f.pii ? 'yes' : 'no'} |`));
  }
  L.push('');
  L.push('## Backend touchpoints (all flows)');
  L.push('');
  if (!backend.length) L.push('None recorded.');
  else {
    L.push('| Flow | Step | Reads | Writes | API |');
    L.push('|---|---|---|---|---|');
    backend.forEach((b) => L.push(`| ${b.flow} | ${b.step} | ${b.reads || ''} | ${b.writes || ''} | ${b.api || ''} |`));
  }
  L.push('');
  return L.join('\n');
}
