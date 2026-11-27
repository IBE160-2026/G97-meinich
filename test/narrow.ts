// Narrowing for tests (Epic 3 retro action 8, issue #89): a test that needs
// one variant of a union throws when it gets another, so the assertions after
// it always run. `if (v.kind === 'x') expect(…)` would pass without testing
// when v is another kind; lint bans an expect inside a condition.

/** `value` as its `kind` variant; throws, naming both kinds, on any other. */
export function narrow<T extends { readonly kind: string }, K extends T['kind']>(
  value: T,
  kind: K,
  label = '',
): Extract<T, { readonly kind: K }> {
  if (value.kind !== kind) throw new Error(`${label === '' ? '' : `${label}: `}expected kind ${kind}, got ${value.kind}`);
  return value as Extract<T, { readonly kind: K }>;
}
