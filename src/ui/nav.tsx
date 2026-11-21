/**
 * Small in-app navigator: five tabs, each with its own stack.
 * No URL routing, so the web build works on any host (Cloudflare, previews).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Tab = 'today' | 'train' | 'body' | 'buddy' | 'plan';
export interface Route {
  name: string;
  params?: Record<string, unknown>;
}

interface Nav {
  tab: Tab;
  route: Route;
  depth: number;
  setTab: (t: Tab) => void;
  push: (name: string, params?: Record<string, unknown>) => void;
  replace: (name: string, params?: Record<string, unknown>) => void;
  back: () => void;
  home: () => void;
}

const roots: Record<Tab, Route> = {
  today: { name: 'today' }, train: { name: 'train' }, body: { name: 'body' }, buddy: { name: 'buddy' }, plan: { name: 'plan' },
};

const Ctx = createContext<Nav | null>(null);
export const useNav = () => {
  const n = useContext(Ctx);
  if (!n) throw new Error('useNav outside NavProvider');
  return n;
};

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('today');
  const [stacks, setStacks] = useState<Record<Tab, Route[]>>({ today: [roots.today], train: [roots.train], body: [roots.body], buddy: [roots.buddy], plan: [roots.plan] });
  const stack = stacks[tab];

  const setTab = useCallback((t: Tab) => {
    setTabState((cur) => {
      if (cur === t) setStacks((s) => ({ ...s, [t]: [roots[t]] })); // tap again = back to top
      return t;
    });
  }, []);
  const push = useCallback((name: string, params?: Record<string, unknown>) => setStacks((s) => ({ ...s, [tab]: [...s[tab], { name, params }] })), [tab]);
  const replace = useCallback((name: string, params?: Record<string, unknown>) => setStacks((s) => ({ ...s, [tab]: [...s[tab].slice(0, -1), { name, params }] })), [tab]);
  const back = useCallback(() => setStacks((s) => ({ ...s, [tab]: s[tab].length > 1 ? s[tab].slice(0, -1) : s[tab] })), [tab]);
  const home = useCallback(() => setStacks((s) => ({ ...s, [tab]: [roots[tab]] })), [tab]);

  const value = useMemo(() => ({ tab, route: stack[stack.length - 1], depth: stack.length, setTab, push, replace, back, home }), [tab, stack, setTab, push, replace, back, home]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
