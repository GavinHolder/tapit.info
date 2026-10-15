import { getMailConfig, validateMailInput, type MailConfig, type MailInput } from './settings';

// The settings as typed on the page (not yet saved), on top of what is saved. Used by the test buttons.
export function effectiveConfig(i: MailInput | undefined): { cfg: MailConfig; problem: string | null } {
  const base = getMailConfig();
  if (!i) return { cfg: base, problem: null };
  const problem = validateMailInput(i);
  const cfg: MailConfig = {
    ...base,
    enabled: true,
    host: typeof i.host === 'string' ? i.host.trim() : base.host,
    port: i.port === undefined ? base.port : Number(i.port),
    security: (['starttls', 'ssl', 'none'].includes(String(i.security)) ? i.security : base.security) as MailConfig['security'],
    user: typeof i.user === 'string' ? i.user.trim() : base.user,
    pass: i.clearPassword ? '' : typeof i.password === 'string' && i.password !== '' ? i.password : base.pass,
    fromName: typeof i.fromName === 'string' && i.fromName.trim() ? i.fromName.trim() : base.fromName,
    fromAddress: typeof i.fromAddress === 'string' ? i.fromAddress.trim() : base.fromAddress,
    publicUrl: typeof i.publicUrl === 'string' && i.publicUrl.trim() ? i.publicUrl.trim().replace(/\/$/, '') : base.publicUrl,
    source: base.source === 'none' ? 'saved' : base.source
  };
  if (!cfg.host) return { cfg, problem: problem ?? 'Enter the mail server name first.' };
  return { cfg, problem };
}

// A small brake so the test buttons cannot be used to send a flood of email.
const sent: number[] = [];
export function testAllowed(): boolean {
  const now = Date.now();
  while (sent.length && now - sent[0] > 60_000) sent.shift();
  if (sent.length >= 6) return false;
  sent.push(now);
  return true;
}
