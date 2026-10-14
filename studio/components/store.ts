'use client';

import { create } from 'zustand';
import {
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type { Flow, FlowSummary, NodeData, NodeKind } from '@/lib/types';
import { api } from '@/lib/api';

export type RFNode = Node<NodeData, 'step'>;
type Snap = { nodes: RFNode[]; edges: Edge[] };
export type Selection = { type: 'node' | 'edge'; id: string } | null;

const NODE_W = 250;
const NODE_H = 110;

const edgeStyle = {
  type: 'smoothstep' as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#6F8588' },
  style: { stroke: '#6F8588', strokeWidth: 1.5 },
  labelStyle: { fontSize: 12, fontWeight: 700, fill: '#0F2A2E' },
  labelBgStyle: { fill: '#F6F8F7', stroke: '#DCE5E1' },
  labelBgPadding: [6, 3] as [number, number],
  labelBgBorderRadius: 6
};

const toRF = (flow: Flow): { nodes: RFNode[]; edges: Edge[] } => ({
  nodes: flow.nodes.map((n) => ({ id: n.id, type: 'step', position: n.position, data: n.data })),
  edges: flow.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, ...edgeStyle }))
});

const newId = () => 'n' + Math.random().toString(36).slice(2, 8);

const blank = (kind: NodeKind): NodeData => ({
  title: 'New step',
  kind,
  lane: kind === 'backend' ? 'Backend' : kind === 'screen' ? 'Frontend' : kind === 'external' ? 'External' : 'Guest',
  status: kind === 'question' ? 'question' : 'draft',
  notes: '',
  fields: [],
  reads: '',
  writes: '',
  api: '',
  mockup: '',
  comments: []
});

interface State {
  list: FlowSummary[];
  flowId: string | null;
  title: string;
  description: string;
  nodes: RFNode[];
  edges: Edge[];
  selected: Selection;
  past: Snap[];
  future: Snap[];
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  lastEdit: number;
  toast: string;
  readOnly: boolean;
  setReadOnly: (v: boolean) => void;
  focus: string | null;
  setFocus: (id: string | null) => void;
  loadList: () => Promise<void>;
  open: (id: string) => Promise<void>;
  onNodesChange: (c: NodeChange<RFNode>[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  snapshot: () => void;
  addNode: (kind: NodeKind, pos?: { x: number; y: number }) => void;
  updateNode: (id: string, patch: Partial<NodeData>) => void;
  updateEdgeLabel: (id: string, label: string) => void;
  removeSelected: () => void;
  addNodeAt: (kind: NodeKind, pos: { x: number; y: number }, after?: string) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  duplicateNode: (id: string) => void;
  select: (s: Selection) => void;
  undo: () => void;
  redo: () => void;
  tidy: () => void;
  save: () => Promise<void>;
  exportSpec: () => Promise<string>;
  createFlow: (title: string) => Promise<void>;
  say: (m: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStudio = create<State>()((set, get) => ({
  list: [],
  flowId: null,
  title: '',
  description: '',
  nodes: [],
  edges: [],
  selected: null,
  past: [],
  future: [],
  dirty: false,
  saving: false,
  savedAt: null,
  lastEdit: 0,
  toast: '',
  readOnly: true,
  setReadOnly: (v) => set({ readOnly: v }),
  focus: null,
  setFocus: (id) => set({ focus: id }),

  say: (m) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: m });
    toastTimer = setTimeout(() => set({ toast: '' }), 2200);
  },

  loadList: async () => {
    set({ list: await api<FlowSummary[]>('/api/flows') });
  },

  open: async (id) => {
    if (get().dirty) await get().save();
    const flow = await api<Flow>(`/api/flows/${id}`);
    const { nodes, edges } = toRF(flow);
    set({ flowId: flow.id, title: flow.title, description: flow.description, nodes, edges, selected: null, past: [], future: [], dirty: false });
  },

  snapshot: () => {
    const { nodes, edges, past } = get();
    set({ past: [...past.slice(-99), { nodes, edges }], future: [] });
  },

  onNodesChange: (changes) => {
    const meaningful = changes.some((c) => c.type === 'position' || c.type === 'remove' || c.type === 'add' || c.type === 'replace');
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), dirty: s.dirty || meaningful }));
  },

  onEdgesChange: (changes) => {
    const meaningful = changes.some((c) => c.type === 'remove' || c.type === 'add' || c.type === 'replace');
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), dirty: s.dirty || meaningful }));
  },

  onConnect: (c) => {
    get().snapshot();
    set((s) => ({ edges: addEdge({ ...c, ...edgeStyle }, s.edges), dirty: true }));
  },

  addNode: (kind, pos) => {
    get().snapshot();
    const { nodes, selected } = get();
    const anchor = selected?.type === 'node' ? nodes.find((n) => n.id === selected.id) : undefined;
    const position = pos ?? (anchor ? { x: anchor.position.x + NODE_W + 80, y: anchor.position.y } : { x: 40, y: 40 });
    const node: RFNode = { id: newId(), type: 'step', position, data: blank(kind), selected: true };
    set((s) => ({ nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), node], selected: { type: 'node', id: node.id }, dirty: true }));
    if (anchor) {
      set((s) => ({ edges: addEdge({ source: anchor.id, target: node.id, sourceHandle: null, targetHandle: null, ...edgeStyle }, s.edges) }));
    }
  },

  // Right-click actions. Unlike addNode these never depend on what is selected.
  addNodeAt: (kind, pos, after) => {
    get().snapshot();
    const node: RFNode = { id: newId(), type: 'step', position: pos, data: blank(kind), selected: true };
    set((s) => ({ nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), node], selected: { type: 'node', id: node.id }, dirty: true }));
    if (after) set((s) => ({ edges: addEdge({ source: after, target: node.id, sourceHandle: null, targetHandle: null, ...edgeStyle }, s.edges) }));
  },

  removeNode: (id) => {
    get().snapshot();
    set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id), edges: s.edges.filter((e) => e.source !== id && e.target !== id), selected: s.selected?.id === id ? null : s.selected, dirty: true }));
  },

  removeEdge: (id) => {
    get().snapshot();
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id), selected: s.selected?.id === id ? null : s.selected, dirty: true }));
  },

  duplicateNode: (id) => {
    const src = get().nodes.find((n) => n.id === id);
    if (!src) return;
    get().snapshot();
    const copy: RFNode = { id: newId(), type: 'step', position: { x: src.position.x + 40, y: src.position.y + 60 }, data: JSON.parse(JSON.stringify({ ...src.data, title: src.data.title + ' (copy)', comments: [] })), selected: true };
    set((s) => ({ nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), copy], selected: { type: 'node', id: copy.id }, dirty: true }));
  },

  updateNode: (id, patch) => {
    const now = Date.now();
    if (now - get().lastEdit > 1200) get().snapshot();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      dirty: true,
      lastEdit: now
    }));
  },

  updateEdgeLabel: (id, label) => {
    const now = Date.now();
    if (now - get().lastEdit > 1200) get().snapshot();
    set((s) => ({ edges: s.edges.map((e) => (e.id === id ? { ...e, label: label || undefined } : e)), dirty: true, lastEdit: now }));
  },

  removeSelected: () => {
    const { selected } = get();
    if (!selected) return;
    get().snapshot();
    if (selected.type === 'node') {
      set((s) => ({ nodes: s.nodes.filter((n) => n.id !== selected.id), edges: s.edges.filter((e) => e.source !== selected.id && e.target !== selected.id), selected: null, dirty: true }));
    } else {
      set((s) => ({ edges: s.edges.filter((e) => e.id !== selected.id), selected: null, dirty: true }));
    }
  },

  select: (selected) => set({ selected }),

  undo: () => {
    const { past, nodes, edges, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ nodes: prev.nodes, edges: prev.edges, past: past.slice(0, -1), future: [{ nodes, edges }, ...future], dirty: true, selected: null });
  },

  redo: () => {
    const { future, nodes, edges, past } = get();
    if (!future.length) return;
    const next = future[0];
    set({ nodes: next.nodes, edges: next.edges, future: future.slice(1), past: [...past, { nodes, edges }], dirty: true, selected: null });
  },

  tidy: () => {
    get().snapshot();
    const { nodes, edges } = get();
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 90 });
    nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    set({
      nodes: nodes.map((n) => {
        const p = g.node(n.id);
        return { ...n, position: { x: Math.round(p.x - NODE_W / 2), y: Math.round(p.y - NODE_H / 2) } };
      }),
      dirty: true
    });
  },

  save: async () => {
    const { flowId, title, description, nodes, edges, saving } = get();
    if (!flowId || saving) return;
    set({ saving: true });
    const body: Flow = {
      id: flowId,
      title,
      description,
      nodes: nodes.map((n) => ({ id: n.id, type: 'step', position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, ...(typeof e.label === 'string' && e.label ? { label: e.label } : {}) }))
    };
    try {
      await api(`/api/flows/${flowId}`, { method: 'PUT', json: body });
      set({ saving: false, dirty: false, savedAt: Date.now() });
      void get().loadList();
    } catch {
      set({ saving: false });
      get().say('Could not save. Check the server is running.');
    }
  },

  exportSpec: async () => {
    if (get().dirty) await get().save();
    const data = await api<{ markdown: string }>('/api/spec', { method: 'POST' });
    get().say('Wrote planning/SPEC.md');
    return data.markdown;
  },

  createFlow: async (title) => {
    const flow = await api<Flow>('/api/flows', { method: 'POST', json: { title } });
    await get().loadList();
    await get().open(flow.id);
  }
}));
