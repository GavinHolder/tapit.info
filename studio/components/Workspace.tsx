'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { KINDS, type NodeKind } from '@/lib/types';
import { StepNode } from './StepNode';
import { Inspector } from './Inspector';
import { MermaidDialog, ShortcutsDialog } from './MermaidDialog';
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
  const addNodeAt = useStudio((s) => s.addNodeAt);
  const removeNode = useStudio((s) => s.removeNode);
  const removeEdge = useStudio((s) => s.removeEdge);
  const duplicateNode = useStudio((s) => s.duplicateNode);
  const toggleCollapse = useStudio((s) => s.toggleCollapse);
  const expandAll = useStudio((s) => s.expandAll);
  const addAfter = useStudio((s) => s.addAfter);
  const connectFrom = useRef<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; type: 'pane' | 'node' | 'edge'; id?: string; at: { x: number; y: number } } | null>(null);

  // A collapsed step hides everything after it.
  const { shownNodes, shownEdges, anyCollapsed } = useMemo(() => {
    const out = new Map<string, string[]>();
    edges.forEach((e) => out.set(e.source, [...(out.get(e.source) ?? []), e.target]));
    const hidden = new Set<string>();
    const counts = new Map<string, number>();
    for (const n of nodes) {
      if (!n.data.collapsed) continue;
      const seen = new Set<string>();
      const stack = [...(out.get(n.id) ?? [])];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id) || id === n.id) continue;
        seen.add(id);
        stack.push(...(out.get(id) ?? []));
      }
      seen.forEach((id) => hidden.add(id));
      counts.set(n.id, seen.size);
    }
    return {
      shownNodes: nodes.map((n) => (hidden.has(n.id) ? { ...n, hidden: true } : counts.has(n.id) ? { ...n, data: { ...n.data, hiddenCount: counts.get(n.id) } } : n)),
      shownEdges: edges.map((e) => (hidden.has(e.source) || hidden.has(e.target) ? { ...e, hidden: true } : e)),
      anyCollapsed: nodes.some((n) => n.data.collapsed)
    };
  }, [nodes, edges]);

  const openMenu = (e: React.MouseEvent | MouseEvent, type: 'pane' | 'node' | 'edge', id?: string) => {
    if (readOnly) return;
    e.preventDefault();
    const box = document.querySelector('.canvas-body')?.getBoundingClientRect();
    const h = type === 'pane' ? 340 : type === 'node' ? 420 : 60;
    const x = Math.max(4, Math.min(e.clientX - (box?.left ?? 0), (box?.width ?? 800) - 240));
    const y = Math.max(4, Math.min(e.clientY - (box?.top ?? 0), (box?.height ?? 600) - h));
    setMenu({ x, y, type, id, at: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
  };

  const setReadOnlyFlag = useStudio((s) => s.setReadOnly);
  useEffect(() => { setReadOnlyFlag(readOnly); }, [readOnly, setReadOnlyFlag]);
  useEffect(() => {
    const open = (ev: Event) => {
      const d = (ev as CustomEvent<{ id: string; x: number; y: number }>).detail;
      select({ type: 'node', id: d.id });
      openMenu(new MouseEvent('contextmenu', { clientX: d.x, clientY: d.y }), 'node', d.id);
    };
    window.addEventListener('studio:nodemenu', open);
    return () => window.removeEventListener('studio:nodemenu', open);
  });

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', key); window.removeEventListener('blur', close); };
  }, [menu]);

  // Open at a readable zoom, starting from the first step. The Fit button still shows the whole flow.
  // A link to a specific step (?flow=&step=) centres on that step and selects it instead.
  useEffect(() => {
    const t = setTimeout(() => {
      const st = useStudio.getState();
      const all = st.nodes;
      if (!all.length) return;
      const target = st.focus && all.find((n) => n.id === st.focus);
      if (target) {
        const w = target.measured?.width ?? 250;
        const h = target.measured?.height ?? 110;
        void rf.setCenter(target.position.x + w / 2, target.position.y + h / 2, { zoom: 0.9, duration: 300 });
        rf.setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === target.id })));
        st.select({ type: 'node', id: target.id });
        st.setFocus(null);
        return;
      }
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

  const kinds: NodeKind[] = ['screen', 'action', 'decision', 'data', 'backend', 'profile', 'external', 'question'];
  const item = (label: string, run: () => void, danger = false, kind?: NodeKind) => (
    <button key={label} type="button" role="menuitem" className={'cm-item' + (danger ? ' danger' : '')} onClick={() => { run(); setMenu(null); }}>
      {kind && <span className="cm-dot" style={{ background: KINDS[kind].color }} />}{label}
    </button>
  );

  return (
    <>
    <ReactFlow
      nodes={shownNodes}
      edges={shownEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectStart={(_, p) => { connectFrom.current = p.handleType === 'source' ? p.nodeId : null; }}
      onConnectEnd={(event, state) => {
        const from = connectFrom.current;
        connectFrom.current = null;
        if (readOnly || !from || state.toHandle) return;
        const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
        const at = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
        addNodeAt('action', { x: Math.round(at.x - 20), y: Math.round(at.y - 20) }, from);
      }}
      onNodeDragStart={() => snapshot()}
      onSelectionChange={onSelectionChange}
      onPaneContextMenu={(e) => openMenu(e, 'pane')}
      onNodeContextMenu={(e, n) => { select({ type: 'node', id: n.id }); openMenu(e, 'node', n.id); }}
      onEdgeContextMenu={(e, ed) => { select({ type: 'edge', id: ed.id }); openMenu(e, 'edge', ed.id); }}
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
    {menu && (
      <div className="ctxmenu" role="menu" aria-label={menu.type === 'pane' ? 'Add a step' : menu.type === 'node' ? 'Step actions' : 'Arrow actions'} style={{ left: Math.min(menu.x, 9999), top: menu.y }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
        {menu.type === 'pane' && (<><div className="cm-h">Add a step here</div>{kinds.map((k) => item(KINDS[k].label, () => addNodeAt(k, menu.at), false, k))}{anyCollapsed && (<><div className="cm-sep" />{item('Expand all collapsed steps', () => expandAll())}</>)}</>)}
        {menu.type === 'node' && menu.id && (
          <>
            <div className="cm-h">Add a step after this one</div>
            {kinds.map((k) => item(KINDS[k].label, () => { const n = nodes.find((x) => x.id === menu.id); if (n) addNodeAt(k, { x: n.position.x + 330, y: n.position.y + (edges.filter((e) => e.source === n.id).length * 130) }, n.id); }, false, k))}
            <div className="cm-sep" />
            {item(nodes.find((x) => x.id === menu.id)?.data.collapsed ? 'Expand the steps after this' : 'Collapse the steps after this', () => toggleCollapse(menu.id!))}
            {item('Duplicate step', () => duplicateNode(menu.id!))}
            {item('Delete step', () => removeNode(menu.id!), true)}
          </>
        )}
        {menu.type === 'edge' && menu.id && item('Delete arrow', () => removeEdge(menu.id!), true)}
      </div>
    )}
    </>
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
  const [mermaid, setMermaid] = useState(false);
  const [keys, setKeys] = useState(false);

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
          <button type="button" className="btn small" onClick={() => setMermaid(true)}>Mermaid</button>
          <button type="button" className="btn small" onClick={() => setKeys(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts">?</button>
          <button type="button" className="btn primary small" onClick={async () => setSpec(await exportSpec())}>Export spec</button>
        </div>
      </div>
      )}
      {mermaid && <MermaidDialog onClose={() => setMermaid(false)} onDone={() => { setMermaid(false); setTimeout(() => void rf.fitView({ padding: 0.15, duration: 300 }), 50); }} />}
      {keys && <ShortcutsDialog onClose={() => setKeys(false)} />}
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

// Add ?debug=1 to the Flows address to see whether right-clicks reach the page.
function DebugPanel() {
  const [log, setLog] = useState({ ctx: 0, last: '', prevented: '', nodeMenu: 0, clicks: 0 });
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const desc = `${t?.tagName?.toLowerCase()}.${(typeof t?.className === 'string' ? t.className : '').split(' ').slice(0, 2).join('.')}`;
      setLog((l) => ({ ...l, ctx: l.ctx + 1, last: desc, prevented: 'checking' }));
      setTimeout(() => setLog((l) => ({ ...l, prevented: String(e.defaultPrevented) })), 0);
    };
    const onNode = () => setLog((l) => ({ ...l, nodeMenu: l.nodeMenu + 1 }));
    const onClick = () => setLog((l) => ({ ...l, clicks: l.clicks + 1 }));
    window.addEventListener('contextmenu', onCtx, true);
    window.addEventListener('studio:nodemenu', onNode);
    window.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('contextmenu', onCtx, true); window.removeEventListener('studio:nodemenu', onNode); window.removeEventListener('click', onClick, true); };
  }, []);
  const menus = typeof document === 'undefined' ? 0 : document.querySelectorAll('.ctxmenu').length;
  const dots = typeof document === 'undefined' ? 0 : document.querySelectorAll('.node-menu').length;
  return (
    <div className="debugpanel" role="status">
      <b>Debug</b> v{process.env.NEXT_PUBLIC_STUDIO_VERSION} · right-click events seen: {log.ctx} · last target: {log.last || 'none yet'} · handled by app: {log.prevented || '-'} · ⋯ buttons clicked: {log.nodeMenu} · clicks: {log.clicks} · menus on screen: {menus} · ⋯ buttons on page: {dots} · {typeof navigator === 'undefined' ? '' : navigator.userAgent.replace(/Mozilla\/5.0 /, '').slice(0, 60)}
    </div>
  );
}

export function Workspace({ readOnly }: { readOnly: boolean }) {
  const [debug, setDebug] = useState(false);
  useEffect(() => { setDebug(new URLSearchParams(window.location.search).has('debug')); }, []);
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
    const q = new URLSearchParams(window.location.search);
    const wantFlow = q.get('flow');
    const wantStep = q.get('step');
    void loadList().then(() => {
      const st = useStudio.getState();
      const pick = st.list.find((f) => f.id === wantFlow) ?? (st.flowId ? undefined : st.list[0]);
      if (pick) {
        if (wantStep) st.setFocus(wantStep);
        void open(pick.id);
      }
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
      if (readOnly) return;
      const t = e.target as HTMLElement;
      const typing = !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
      const st = useStudio.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 's') { e.preventDefault(); void st.save(); return; }
      if (typing || document.querySelector('.modal-bg')) return;
      const node = st.selected?.type === 'node' ? st.selected.id : null;
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return; }
      if (mod && key === 'y') { e.preventDefault(); st.redo(); return; }
      if (mod && key === 'd' && node) { e.preventDefault(); st.duplicateNode(node); return; }
      if (mod || e.altKey) return;
      if (key === 'tab' && node) { e.preventDefault(); st.addAfter(node); return; }
      if ((key === 'enter' || key === 'f2') && node) { e.preventDefault(); document.getElementById('insp-title')?.focus(); return; }
      if (key === 'c' && node) { e.preventDefault(); st.toggleCollapse(node); return; }
      if (key === 'escape') { st.selectNode(null); return; }
      const dir = ({ arrowright: 'right', arrowleft: 'left', arrowup: 'up', arrowdown: 'down' } as const)[key as 'arrowright'];
      if (dir) { e.preventDefault(); st.selectRelative(dir); }
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
      {debug && <DebugPanel />}
      <div role="status" aria-live="polite" className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  );
}

// Re-run the autosave timer whenever the nodes or edges change.
function nodesKey() {
  const s = useStudio.getState();
  return s.nodes.length + ':' + s.edges.length + ':' + s.lastEdit;
}
