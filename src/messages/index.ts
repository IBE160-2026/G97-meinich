// The single source of user-facing copy (bokmål). Components never hold
// Norwegian text themselves; they ask for it by dotted id, and the id type
// is derived from the JSON keys so a misspelt id fails typecheck.
import nb from './nb.json';

export type MessageId = keyof typeof nb;

export function t(id: MessageId): string {
  return nb[id];
}
