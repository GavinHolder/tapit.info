'use client';

import { useMemo, useState } from 'react';
import { exportMermaid, parseMermaid } from '@/lib/mermaid';
import { useStudio } from './store';

// Export the open flow as Mermaid (for docs and diagrams) or import a Mermaid flowchart as new steps.
export function MermaidDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const title = useStudio((s) => s.title);
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const importMermaid = useStudio((s) => s.importMermaid);
  const say = useStudio((s) => s.say);
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const [msg, setMsg] = useState('');

  const out = useMemo(() => exportMermaid(nodes, edges), [nodes, edges]);
  const parsed = useMemo(() => (text.trim() ? parseMermaid(text) : null), [text]);

  async function copy() {
    try { await navigator.clipboard.writeText(out); setMsg('Copied.'); } catch { setMsg('Copy was blocked. Select the text and copy it yourself.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([out], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'flow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow'}.mmd`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function run() {
    if (mode === 'replace' && !window.confirm('Replace every step in this flow with the imported ones? You can undo with Ctrl+Z.')) return;
    const r = importMermaid(text, mode);
    if (!r.nodes) { setMsg('Nothing could be read. Paste a Mermaid flowchart (it starts with “flowchart” or “graph”).'); return; }
    say(`Imported ${r.nodes} steps and ${r.edges} arrows`);
    onDone();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Mermaid" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><h2>Mermaid</h2><button type="button" className="btn small" onClick={onClose}>Close</button></div>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'export'} className={'tabbtn' + (tab === 'export' ? ' on' : '')} onClick={() => setTab('export')}>Export this flow</button>
          <button type="button" role="tab" aria-selected={tab === 'import'} className={'tabbtn' + (tab === 'import' ? ' on' : '')} onClick={() => setTab('import')}>Import a flowchart</button>
        </div>
        {tab === 'export' && (
          <>
            <p className="hint">Step titles, kinds (as shapes) and arrows. Fields, notes and comments are not included. Paste it into any Mermaid viewer, a README or a GitHub issue.</p>
            <pre className="spec">{out}</pre>
            <div className="tv-actions"><button type="button" className="btn primary small" onClick={copy}>Copy</button><button type="button" className="btn small" onClick={download}>Download .mmd</button><span className="hint">{msg}</span></div>
          </>
        )}
        {tab === 'import' && (
          <>
            <p className="hint">Paste a Mermaid flowchart. Shapes decide the step type: rectangle is a screen, rounded is an action, diamond is a decision, cylinder is data, double box is backend, circle is external, hexagon is an open question.</p>
            <textarea className="in mono" rows={10} aria-label="Mermaid flowchart" placeholder={'flowchart TD\n  A[Guest taps stand] --> B{Business active?}\n  B -->|yes| C(Show concierge)\n  B -->|no| D[Show closed page]'} value={text} onChange={(e) => { setText(e.target.value); setMsg(''); }} />
            {parsed && <p className="hint">{parsed.nodes.length} steps and {parsed.edges.length} arrows found{parsed.skipped.length ? `. ${parsed.skipped.length} line${parsed.skipped.length === 1 ? '' : 's'} could not be read and will be skipped` : ''}.</p>}
            <div className="tv-actions">
              <label className="chk"><input type="radio" name="mm" checked={mode === 'add'} onChange={() => setMode('add')} />Add below the existing steps</label>
              <label className="chk"><input type="radio" name="mm" checked={mode === 'replace'} onChange={() => setMode('replace')} />Replace this flow</label>
              <span className="grow" />
              <button type="button" className="btn primary small" disabled={!parsed || !parsed.nodes.length} onClick={run}>Import</button>
            </div>
            <div className="form-error" role="alert">{msg}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['Tab', 'Add a step after the selected one'],
    ['Arrow keys', 'Move between steps (right = next, left = previous, up and down = neighbours)'],
    ['Enter or F2', 'Edit the selected step’s title'],
    ['Delete', 'Delete the selected step or arrow'],
    ['Ctrl+D', 'Duplicate the selected step'],
    ['C', 'Collapse or expand the steps after the selected one'],
    ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'],
    ['Ctrl+S', 'Save now'],
    ['Esc', 'Deselect, or close a menu'],
    ['Right-click', 'Add, duplicate or delete (canvas, step or arrow)'],
    ['Drag from a step’s right dot onto empty space', 'Create a connected new step there']
  ];
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><h2>Shortcuts</h2><button type="button" className="btn small" onClick={onClose}>Close</button></div>
        <table className="tbl"><tbody>{rows.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
