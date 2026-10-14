import fs from 'node:fs/promises';
import path from 'node:path';
import type { Flow, FlowSummary } from './types';

// The planning folder lives in the repo so Claude Code can read it directly.
export const PLANNING_DIR = process.env.PLANNING_DIR || path.resolve(process.cwd(), '..', 'planning');
const FLOWS_DIR = path.join(PLANNING_DIR, 'flows');

const safeId = (id: string) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(id);
const fileFor = (id: string) => path.join(FLOWS_DIR, `${id}.flow.json`);

export async function readFlow(id: string): Promise<Flow> {
  if (!safeId(id)) throw new Error('bad id');
  return JSON.parse(await fs.readFile(fileFor(id), 'utf8')) as Flow;
}

export async function listFlows(): Promise<FlowSummary[]> {
  await fs.mkdir(FLOWS_DIR, { recursive: true });
  const files = (await fs.readdir(FLOWS_DIR)).filter((f) => f.endsWith('.flow.json')).sort();
  const out: FlowSummary[] = [];
  for (const f of files) {
    const flow = await readFlow(f.replace(/\.flow\.json$/, ''));
    out.push({
      id: flow.id,
      title: flow.title,
      nodes: flow.nodes.length,
      open: flow.nodes.filter((n) => n.data.status === 'question' || n.data.kind === 'question').length
    });
  }
  return out;
}

export async function readFlows(): Promise<Flow[]> {
  const list = await listFlows();
  return Promise.all(list.map((s) => readFlow(s.id)));
}

export async function writeFlow(flow: Flow): Promise<void> {
  if (!safeId(flow.id)) throw new Error('bad id');
  await fs.mkdir(FLOWS_DIR, { recursive: true });
  await fs.writeFile(fileFor(flow.id), JSON.stringify(flow, null, 2) + '\n', 'utf8');
}

export async function writeSpec(markdown: string): Promise<string> {
  const file = path.join(PLANNING_DIR, 'SPEC.md');
  await fs.writeFile(file, markdown, 'utf8');
  return file;
}
