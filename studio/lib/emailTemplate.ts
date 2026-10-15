// The look and wording of Studio's emails. Wording comes from the settings page; this file builds the HTML and text.

export type Templates = {
  brandName: string;
  brandColor: string;
  accentColor: string;
  subjectOne: string;
  subjectMany: string;
  greeting: string;
  introOne: string;
  introMany: string;
  button: string;
  showPreview: string; // '1' or '0'
  footer: string;
  subjectInvite: string;
  introInvite: string;
  buttonInvite: string;
};

export const TEMPLATE_DEFAULTS: Templates = {
  brandName: 'TapIt Studio',
  brandColor: '#0f3d3e',
  accentColor: '#c8f560',
  subjectOne: 'TapIt Studio: {{title}}',
  subjectMany: 'TapIt Studio: {{count}} new messages',
  greeting: 'Hi {{name}},',
  introOne: 'You have a new message in TapIt Studio.',
  introMany: 'You have {{count}} new messages in TapIt Studio.',
  button: 'Open in Studio',
  showPreview: '1',
  footer: 'You get this email because email notifications are on for your account. You can turn them off with the Email switch in the top bar of TapIt Studio.',
  subjectInvite: '{{inviter}} invited you to {{brand}}',
  introInvite: '{{inviter}} has invited you to {{brand}}, where we plan the project together. Open the link below to choose your password. The link works once and expires in {{days}} days.',
  buttonInvite: 'Set my password'
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_DEFAULTS) as (keyof Templates)[];
const COLOR = /^#[0-9a-fA-F]{6}$/;

export function cleanTemplates(input: Partial<Record<string, unknown>>): Templates {
  const out = { ...TEMPLATE_DEFAULTS };
  for (const k of TEMPLATE_KEYS) {
    const v = input[k];
    if (typeof v !== 'string') continue;
    const t = v.replace(/\r/g, '').trim().slice(0, 1000);
    if (k === 'brandColor' || k === 'accentColor') { if (COLOR.test(t)) out[k] = t; continue; }
    if (k === 'showPreview') { out[k] = t === '0' ? '0' : '1'; continue; }
    if (t) out[k] = t;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl: string, vars: Record<string, string | number>, html: boolean) => tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in vars ? (html ? esc(String(vars[k])) : String(vars[k])) : ''));
const paras = (s: string) => s.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

export type NotifyItem = { title: string; count: number; who: string; last: string; url: string };
export type Rendered = { subject: string; text: string; html: string };

function shell(t: Templates, body: string, footer: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(t.brandName)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f3;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0f2a2e;">
<tr><td style="background:${t.brandColor};padding:18px 24px;font-size:18px;font-weight:bold;color:#ffffff;">${esc(t.brandName)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55;">${body}</td></tr>
<tr><td style="padding:16px 24px 24px;font-size:12px;line-height:1.5;color:#5b7377;border-top:1px solid #e8efec;">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (t: Templates, url: string, label: string) =>
  `<p style="margin:22px 0 4px;"><a href="${esc(url)}" style="display:inline-block;background:${t.accentColor};color:#0b1f24;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;">${esc(label)}</a></p>`;

export function renderNotify(t: Templates, data: { name: string; items: NotifyItem[] }): Rendered {
  const total = data.items.reduce((n, i) => n + i.count, 0);
  const many = total > 1;
  const vars = { name: data.name, count: total, title: data.items[0]?.title ?? '', brand: t.brandName };
  const intro = fill(many ? t.introMany : t.introOne, vars, false);
  const greeting = fill(t.greeting, vars, false);
  const subject = fill(many ? t.subjectMany : t.subjectOne, vars, false).slice(0, 150);
  const first = data.items[0];

  const textLines = [greeting, '', intro, ''];
  for (const i of data.items) {
    textLines.push(`${i.title}${i.count > 1 ? ` (${i.count} messages)` : ''}`);
    if (t.showPreview === '1') textLines.push(`${i.who}: ${i.last}`);
    textLines.push(i.url, '');
  }
  textLines.push(t.footer);

  const blocks = data.items
    .map((i) => `<div style="margin:14px 0;padding:12px 14px;background:#f6f8f7;border:1px solid #e8efec;border-radius:10px;">
<div style="font-weight:bold;">${esc(i.title)}${i.count > 1 ? ` <span style="font-weight:normal;color:#5b7377;">(${i.count} messages)</span>` : ''}</div>
${t.showPreview === '1' ? `<div style="margin-top:6px;color:#334;"><span style="color:#5b7377;">${esc(i.who)}:</span> ${esc(i.last)}</div>` : ''}
<div style="margin-top:8px;"><a href="${esc(i.url)}" style="color:#1e5a55;">Open this conversation</a></div></div>`)
    .join('');
  const html = shell(
    t,
    `<p style="margin:0 0 10px;">${esc(greeting)}</p><p style="margin:0 0 6px;">${esc(intro)}</p>${blocks}${first ? button(t, first.url, fill(t.button, vars, false)) : ''}`,
    esc(t.footer)
  );
  return { subject, text: textLines.join('\n'), html };
}

export function renderInvite(t: Templates, data: { name: string; inviter: string; url: string; days: number }): Rendered {
  const vars = { name: data.name, inviter: data.inviter, brand: t.brandName, days: data.days };
  const greeting = fill(t.greeting, vars, false);
  const intro = fill(t.introInvite, vars, false);
  const subject = fill(t.subjectInvite, vars, false).slice(0, 150);
  const label = fill(t.buttonInvite, vars, false);
  const text = [greeting, '', intro, '', data.url, '', t.footer.includes('notifications') ? '' : t.footer].join('\n').trim();
  const html = shell(
    t,
    `<p style="margin:0 0 10px;">${esc(greeting)}</p>${paras(intro).map((p) => `<p style="margin:0 0 10px;">${esc(p)}</p>`).join('')}${button(t, data.url, label)}<p style="margin:14px 0 0;font-size:12px;color:#5b7377;word-break:break-all;">If the button does not work, copy this link into your browser:<br>${esc(data.url)}</p>`,
    esc('If you did not expect this invitation, you can ignore this email.')
  );
  return { subject, text, html };
}

// Sample content for previews and test emails.
export const SAMPLE_NOTIFY = (base: string, name: string, one = false): { name: string; items: NotifyItem[] } => ({
  name,
  items: ([
    { title: 'How many pilot sites are confirmed?', count: 2, who: 'Your developer', last: 'Thanks. Can you also send the names and towns of the five sites?', url: `${base}/inbox` },
    { title: 'Decision: Base colour palette', count: 1, who: 'Your developer', last: 'I updated the options. Please have another look.', url: `${base}/decisions` }
  ] as NotifyItem[]).slice(0, one ? 1 : 2).map((i) => (one ? { ...i, count: 1 } : i))
});
