import { NextResponse } from 'next/server';
import { readFlows, writeSpec } from '@/lib/planning';
import { buildSpec } from '@/lib/spec';

export const dynamic = 'force-dynamic';

// Rebuilds planning/SPEC.md from every flow and returns the text.
export async function POST() {
  const markdown = buildSpec(await readFlows());
  await writeSpec(markdown);
  return NextResponse.json({ markdown, path: 'planning/SPEC.md' });
}

export async function GET() {
  return NextResponse.json({ markdown: buildSpec(await readFlows()) });
}
