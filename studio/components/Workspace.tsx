'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { KINDS, type NodeKind } from '@/lib/types';
import { StepNode } from './StepNode';
import { Inspector } from './Inspector';
import { useStudio, type RFNode } from './store';

const nodeTypes = { step: StepNode };

function Canvas({ readOnly }: { readOnly: boolean }) {
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const onNodesChange = useStudio((s) => s.onNodesChange);
  const onEdgesChange = useStudio((s) => s.onEdgesChange);
  const onConnect = useStudio((s) => s.onConnect);
  const select = useStudio((s) => s.select);
  const snapshot = useStudio((s) => s.snapshot);
  const flowId = useStudio((s) => s.flowId);
  const rf = useReactFlow();

  // Open at a readable zoom, starting from the first step. The Fit button still shows the whole flow.
  useEffect(() => {
    const t = setTimeout(() => {
      const all = useStudio.getState().nodes;
      if (!all.length) return;
      const b = rf.getNodesBounds(all);
      const zoom = 0.8;
      void rf.setViewport({ x: 32 - b.x * zoom, y: 130 - b.y * zoom, zoom }, { duration: 250 });
    }, 80);
    return () => clearTimeout(t);
  }, [flowId, rf]);

  const onSelectionChange = useCallback(
    ({ nodes: ns, edges: es }: { nodes: RFNode[]; edges: Edge[] }) => {
      if (ns.length === 1) select({ type: 'node', id: ns[0].id });
      else if (es.length === 1 && ns.length === 0) select({ type: 'edge', id: es[0].id });
      else if (ns.length === 0 && es.length === 0) select(null);
    },
    [select]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDragStart={() => snapshot()}
      onSelectionChange={onSelectionChange}
      deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      edgesReconnectable={!readOnly}
      minZoom={0.2}
      maxZoom={1.6}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#C9D8D2" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={(n) => KINDS[(n.data as { kind: NodeKind }).kind]?.color ?? '#999'} maskColor="rgba(246,248,247,.7)" />
    </ReactFlow>
  );
}

function Toolbar({ readOnly }: { readOnly: boolean }) {
  const addNode = useStudio((s) => s.addNode);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const tidy = useStudio((s) => s.tidy);
  const exportSpec = useStudio((s) => s.exportSpec);
  const rf = useReactFlow();
  const [spec, setSpec] = useState<string | null>(null);

  const add = (k: NodeKind) => {
    const c = rf.screenToFlowPosition({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 60 });
    const sel = useStudio.getState().selected;
    addNode(k, sel?.type === 'node' ? undefined : c);
  };

  return (
    <>
      {!readOnly && (
      <div className="toolbar" role="toolbar" aria-label="Flow tools">
        <div className="tgroup">
          <span className="tlabel">Add</span>
          {(['screen', 'action', 'decision', 'data', 'backend', 'profile', 'external', 'question'] as NodeKind[]).map((k) => (
            <button key={k} type="button" className="chip" style={{ background: KINDS[k].bg, color: KINDS[k].color }} onClick={() => add(k)}>{KINDS[k].label}</button>
          ))}
        </div>
        <div className="tgroup">
          <button type="button" className="btn small" onClick={undo} disabled={!canUndo}>Undo</button>
          <button type="button" className="btn small" onClick={redo} disabled={!canRedo}>Redo</button>
          <button type="button" className="btn small" onClick={() => { tidy(); setTimeout(() => void rf.fitView({ padding: 0.15, duration: 300 }), 50); }}>Tidy layout</button>
          <button type="button" className="btn primary small" onClick={async () => setSpec(await exportSpec())}>Export spec</button>
        </div>
      </div>
      )}
      {spec !== null && (
        <div className="modal-bg" onClick={() => setSpec(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Spec preview" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h"><h2>planning/SPEC.md</h2><button type="button" className="btn small" onClick={() => setSpec(null)}>Close</button></div>
            <p className="hint">Saved to the repo. Claude Code reads this file when development starts.</p>
            <pre className="spec">{spec}</pre>
          </div>
        </div>
      )}
    </>
  );
}

export function Workspace({ readOnly }: { readOnly: boolean }) {
  const list = useStudio((s) => s.list);
  const flowId = useStudio((s) => s.flowId);
  const title = useStudio((s) => s.title);
  const loadList = useStudio((s) => s.loadList);
  const open = useStudio((s) => s.open);
  const createFlow = useStudio((s) => s.createFlow);
  const dirty = useStudio((s) => s.dirty);
  const saving = useStudio((s) => s.saving);
  const savedAt = useStudio((s) => s.savedAt);
  const save = useStudio((s) => s.save);
  const toast = useStudio((s) => s.toast);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    void loadList().then(() => {
      const first = useStudio.getState().list[0];
      if (first && !useStudio.getState().flowId) void open(first.id);
    });
  }, [loadList, open]);

  // Autosave shortly after the last change.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const t = setTimeout(() => void save(), 900);
    return () => clearTimeout(t);
  }, [dirty, save, readOnly, nodesKey()]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (readOnly) return;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useStudio.getState().redo(); else useStudio.getState().undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  const status = useMemo(() => (saving ? 'Saving…' : dirty ? 'Unsaved changes' : savedAt ? 'Saved to planning/flows' : 'Up to date'), [saving, dirty, savedAt]);

  return (
    <div className="ws">
      <aside className="side">
        <h2>Flows</h2>
        <ul className="flist">
          {list.map((f) => (
            <li key={f.id}>
              <button type="button" className={'fbtn' + (f.id === flowId ? ' on' : '')} onClick={() => void open(f.id)}>
                <span className="ft">{f.title}</span>
                <span className="fm">{f.nodes} steps{f.open ? `, ${f.open} open` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        {!readOnly && <form
          className="newflow"
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) { void createFlow(newTitle.trim()); setNewTitle(''); }
          }}
        >
          <input className="in" aria-label="New flow name" placeholder="New flow name" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <button type="submit" className="btn small" disabled={!newTitle.trim()}>Add flow</button>
        </form>}
        <div className="legend">
          <h3>Status</h3>
          <p><span className="dot" style={{ background: '#B7791F' }} /> Draft</p>
          <p><span className="dot" style={{ background: '#2F8F4E' }} /> Agreed with the client</p>
          <p><span className="dot" style={{ background: '#C23B22' }} /> Open question</p>
        </div>
      </aside>

      <section className="canvas" aria-label="Flow canvas">
        <div className="canvas-head">
          <h1>{title || 'Choose a flow'}</h1>
          <span className={'save' + (dirty ? ' dirty' : '')}>{readOnly ? 'View only' : status}</span>
        </div>
        <div className="canvas-body">
          <ReactFlowProvider>
            <Toolbar readOnly={readOnly} />
            <Canvas readOnly={readOnly} />
          </ReactFlowProvider>
        </div>
      </section>

      <Inspector readOnly={readOnly} />
      <div role="status" aria-live="polite" className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  );
}

// Re-run the autosave timer whenever the nodes or edges change.
function nodesKey() {
  const s = useStudio.getState();
  return s.nodes.length + ':' + s.edges.length + ':' + s.lastEdit;
}
