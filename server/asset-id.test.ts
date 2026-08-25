import { describe, expect, it } from 'vitest';
import { resolveImmutableAssetId } from './db';

describe('immutable Asset ID resolution', () => {
  it('generates an SP-prefixed ID when no prior ID exists', () => {
    const id = resolveImmutableAssetId(null, null);
    expect(id).toMatch(/^SP-[A-F0-9]{12}$/);
  });

  it('ignores a client-supplied Asset ID on first write', () => {
    const id = resolveImmutableAssetId(undefined, 'CLIENT-CONTROLLED');
    expect(id).toMatch(/^SP-[A-F0-9]{12}$/);
    expect(id).not.toBe('CLIENT-CONTROLLED');
  });

  it('preserves an existing Asset ID on later writes', () => {
    expect(resolveImmutableAssetId('SP-0123456789AB', 'CLIENT-CONTROLLED')).toBe('SP-0123456789AB');
  });
});
