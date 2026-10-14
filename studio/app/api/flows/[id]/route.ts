import { NextResponse } from 'next/server';
import { readFlow, writeFlow } from '@/lib/planning';
import type { Flow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await readFlow(id));
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const flow = (await req.json()) as Flow;
  if (flow.id !== id) return NextResponse.json({ error: 'id mismatch' }, { status: 400 });
  try {
    await writeFlow(flow);
    return NextResponse.json({ ok: true, savedAt: Date.now() });
  } catch {
    return NextResponse.json({ error: 'could not save' }, { status: 500 });
  }
}
