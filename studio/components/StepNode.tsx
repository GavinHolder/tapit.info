'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KINDS, STATUSES } from '@/lib/types';
import type { RFNode } from './store';

export function StepNode({ data, selected }: NodeProps<RFNode>) {
  const kind = KINDS[data.kind];
  const status = STATUSES[data.status];
  const pii = data.fields.some((f) => f.pii);
  return (
    <div className={'step' + (selected ? ' step-selected' : '')} data-kind={data.kind}>
      <Handle type="target" position={Position.Left} />
      <div className="step-top">
        <span className="pill" style={{ background: kind.bg, color: kind.color }}>{kind.label}</span>
        <span className="step-lane">{data.lane}</span>
        <span className="dot" title={status.label} style={{ background: status.dot }} />
      </div>
      <div className="step-title">{data.title}</div>
      {(data.fields.length > 0 || data.comments.length > 0 || data.mockup) && (
        <div className="step-meta">
          {data.fields.length > 0 && <span>{data.fields.length} field{data.fields.length === 1 ? '' : 's'}</span>}
          {pii && <span className="pii">personal info</span>}
          {data.comments.length > 0 && <span>{data.comments.length} comment{data.comments.length === 1 ? '' : 's'}</span>}
          {data.mockup && <span>mockup</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
