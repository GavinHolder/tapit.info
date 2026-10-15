import { guard } from '@/lib/auth';
import { getMailConfig, saveMailConfig, validateMailInput, type MailInput } from '@/lib/settings';

export const dynamic = 'force-dynamic';

function view() {
  const c = getMailConfig();
  return {
    source: c.source,
    enabled: c.enabled,
    host: c.host,
    port: c.port,
    security: c.security,
    user: c.user,
    hasPassword: !!c.pass, // the password itself is never sent back
    fromName: c.fromName,
    fromAddress: c.fromAddress,
    publicUrl: c.publicUrl,
    delaySeconds: c.delaySeconds
  };
}

export async function GET(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  return Response.json(view());
}

export async function PUT(req: Request) {
  const g = await guard(req, 'owner');
  if (!g.ok) return g.res;
  const b = (await req.json().catch(() => ({}))) as MailInput;
  const input: MailInput = {
    enabled: typeof b.enabled === 'boolean' ? b.enabled : undefined,
    host: typeof b.host === 'string' ? b.host : undefined,
    port: b.port === undefined ? undefined : Number(b.port),
    security: typeof b.security === 'string' ? b.security : undefined,
    user: typeof b.user === 'string' ? b.user : undefined,
    password: typeof b.password === 'string' ? b.password : undefined,
    clearPassword: b.clearPassword === true,
    fromName: typeof b.fromName === 'string' ? b.fromName.slice(0, 80) : undefined,
    fromAddress: typeof b.fromAddress === 'string' ? b.fromAddress : undefined,
    publicUrl: typeof b.publicUrl === 'string' ? b.publicUrl : undefined,
    delaySeconds: b.delaySeconds === undefined ? undefined : Number(b.delaySeconds)
  };
  const problem = validateMailInput(input);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (input.enabled !== false && !(input.host ?? getMailConfig().host).trim()) return Response.json({ error: 'Enter the mail server name first.' }, { status: 400 });
  saveMailConfig(input);
  return Response.json(view());
}
