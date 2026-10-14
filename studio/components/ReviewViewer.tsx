'use client';

import { useState } from 'react';
import { PROTOTYPES } from '@/lib/prototypes';

export function ReviewViewer({ initial }: { initial?: string }) {
  const first = PROTOTYPES.find((p) => p.id === initial) ?? PROTOTYPES[0];
  const [id, setId] = useState(first.id);
  const [nonce, setNonce] = useState(0);
  const proto = PROTOTYPES.find((p) => p.id === id) ?? PROTOTYPES[0];
  const src = `/api/prototypes/${proto.file}`;

  return (
    <div className="rv">
      <aside className="rv-list">
        <h2>Mockups</h2>
        {PROTOTYPES.map((p) => (
          <button key={p.id} type="button" className={'rv-item' + (p.id === id ? ' on' : '')} onClick={() => setId(p.id)}>
            <b>{p.title}</b>
            <span>{p.note}</span>
          </button>
        ))}
      </aside>
      <section className="rv-main">
        <div className="rv-bar">
          <h1>{proto.title}</h1>
          <div className="sp">
            <button type="button" className="btn small" onClick={() => setNonce((n) => n + 1)}>Restart</button>
            <a className="btn small" href={src} target="_blank" rel="noreferrer">Open full screen</a>
          </div>
        </div>
        <div className="rv-stage">
          <iframe key={id + nonce} className={'rv-frame ' + proto.device} src={src} title={proto.title} />
        </div>
        <div className="rv-note">Click through the mockup as a guest would. Pin and draw comments on the screen are the next step.</div>
      </section>
    </div>
  );
}
