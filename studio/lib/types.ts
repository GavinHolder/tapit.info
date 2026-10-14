export type NodeKind = 'screen' | 'action' | 'decision' | 'data' | 'backend' | 'profile' | 'external' | 'question';
export type Status = 'draft' | 'agreed' | 'question';

export type Field = { name: string; type: string; required: boolean; pii: boolean };
export type Comment = { id: string; author: string; at: string; text: string };

export type NodeData = {
  title: string;
  kind: NodeKind;
  lane: string;
  status: Status;
  notes: string;
  fields: Field[];
  reads: string;
  writes: string;
  api: string;
  mockup: string;
  comments: Comment[];
  [key: string]: unknown;
};

export type FlowNode = { id: string; type: 'step'; position: { x: number; y: number }; data: NodeData };
export type FlowEdge = { id: string; source: string; target: string; label?: string };
export type Flow = { id: string; title: string; description: string; nodes: FlowNode[]; edges: FlowEdge[] };
export type FlowSummary = { id: string; title: string; nodes: number; open: number };

export const KINDS: Record<NodeKind, { label: string; color: string; bg: string }> = {
  screen: { label: 'Screen', color: '#1E5A55', bg: '#D9ECE6' },
  action: { label: 'Action', color: '#2F5D12', bg: '#E3F3C2' },
  decision: { label: 'Decision', color: '#7A4A0E', bg: '#FBE6C8' },
  data: { label: 'Data captured', color: '#5B2F6B', bg: '#EBDDF0' },
  backend: { label: 'Backend', color: '#1F3B73', bg: '#DCE6F7' },
  profile: { label: 'Profile', color: '#7A1F4B', bg: '#F7DCEA' },
  external: { label: 'External', color: '#4A5560', bg: '#E4E8EC' },
  question: { label: 'Open question', color: '#8A2A12', bg: '#FBDDD3' }
};

export const LANES = ['Guest', 'Frontend', 'Backend', 'Database', 'Business', 'Admin', 'External'];
export const STATUSES: Record<Status, { label: string; dot: string }> = {
  draft: { label: 'Draft', dot: '#B7791F' },
  agreed: { label: 'Agreed', dot: '#2F8F4E' },
  question: { label: 'Open question', dot: '#C23B22' }
};
