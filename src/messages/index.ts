// The single source of user-facing copy (bokmål). Components never hold
// Norwegian text themselves; they ask for it by dotted id, and the id type
// is derived from the JSON keys so a misspelt id fails typecheck.
//
// A message may hold placeholders in braces, "{n} treff". t(id, vars)
// replaces each one with vars[name]; a placeholder without a value throws,
// so a message never reaches the page with "{n}" in it.
import type { ReactNode } from 'react';
import nb from './nb.json';

export type MessageId = keyof typeof nb;

export type MessageVars = Readonly<Record<string, string>>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function t(id: MessageId, vars: MessageVars = {}): string {
  return nb[id].replace(PLACEHOLDER, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`message ${id} needs a value for {${name}}`);
    return value;
  });
}

/**
 * The message as a list of text and the nodes in `parts`, one per
 * placeholder, for copy with a link inside it. Each node needs its own `key`.
 * A placeholder without a part throws, as in t().
 */
export function tParts(id: MessageId, parts: Readonly<Record<string, ReactNode>>): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of nb[id].matchAll(PLACEHOLDER)) {
    const name = match[1] as string;
    const part = parts[name];
    if (part === undefined) throw new Error(`message ${id} needs a part for {${name}}`);
    if (match.index > last) out.push(nb[id].slice(last, match.index));
    out.push(part);
    last = match.index + match[0].length;
  }
  if (last < nb[id].length) out.push(nb[id].slice(last));
  return out;
}
