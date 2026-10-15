'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BUILTIN, type Prototype } from '@/lib/prototypes';

// The mockups that exist right now (built-in plus imported). Starts with the built-ins so nothing flashes empty.
export function useMockups() {
  const [list, setList] = useState<Prototype[]>(BUILTIN);
  const [hidden, setHidden] = useState<{ id: string; title: string }[]>([]);
  const [ready, setReady] = useState(false);
  const reload = useCallback(async () => {
    const r = await api<{ mockups: Prototype[]; hidden: { id: string; title: string }[] }>('/api/mockups');
    setList(r.mockups);
    setHidden(r.hidden);
    setReady(true);
    return r.mockups;
  }, []);
  useEffect(() => { void reload().catch(() => undefined); }, [reload]);
  return { list, hidden, ready, reload };
}
