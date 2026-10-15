import fs from 'node:fs/promises';
import path from 'node:path';
import { guard } from '@/lib/auth';
import { readImported } from '@/lib/mockups';

export const dynamic = 'force-dynamic';

const ROOT = path.resolve(process.cwd(), 'prototypes');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json'
};

const IMPORTED_CSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'self'";

// The mockups are only served to signed-in people.
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { path: parts } = await ctx.params;
  // Imported mockups live in the data folder. They run with a strict policy: no requests to anywhere but this app.
  if (parts.length === 1 && parts[0].startsWith('u-')) {
    const f = await readImported(parts[0]);
    if (!f) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(f.data), { headers: { 'content-type': f.type, 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-cache', 'content-security-policy': IMPORTED_CSP } });
  }
  const file = path.resolve(ROOT, ...parts);
  if (!file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
  const type = TYPES[path.extname(file)];
  if (!type) return new Response('Not found', { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), { headers: { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=300' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
