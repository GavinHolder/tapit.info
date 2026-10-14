import { Fragment } from 'react';

// Shows plain text with web addresses turned into links. Never uses innerHTML, so pasted
// markup is shown as text. Only http and https links are made clickable.
const URL_RE = /(https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?])/g;

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="link">{p}</a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  );
}
