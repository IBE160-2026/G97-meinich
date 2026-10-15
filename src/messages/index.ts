// The single source of user-facing copy (bokmål). Components never hold
// Norwegian text themselves; they ask for it by dotted id, and the id type
// is derived from the JSON keys so a misspelt id fails typecheck.
//
// A message may hold placeholders in braces, "{n} treff". t(id, vars)
// replaces each one with vars[name]; a placeholder without a value throws,
// so a message never reaches the page with "{n}" in it.
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
