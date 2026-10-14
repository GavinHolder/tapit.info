import { NextResponse } from 'next/server';
import { listFlows, writeFlow } from '@/lib/planning';
import type { Flow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listFlows());
}

export async function POST(req: Request) {
  const body = (await req.json()) as { title?: string };
  const title = (body.title || '').trim();
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'flow';
  const flow: Flow = { id, title, description: '', nodes: [], edges: [] };
  await writeFlow(flow);
  return NextResponse.json(flow);
}
