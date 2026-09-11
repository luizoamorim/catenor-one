import { createHash } from 'node:crypto';
import { loadVector } from '@catenor-one/test-vectors';
import { describe, expect, it } from 'vitest';
import {
  commit,
  commitBytes,
  commitmentBytes,
  isCommitment,
  parseCommitment,
  type Commitment,
} from './commitment.js';

const nodeSha256 = (text: string) => `0x${createHash('sha256').update(text, 'utf8').digest('hex')}`;

describe('commit', () => {
  it('is 0x + lowercase hex SHA-256 of the JCS bytes (independent check with node:crypto)', () => {
    const v = loadVector<{ primitives: { inputJson: string; expectedCanonical: string } }>(
      's001',
      'rfc8785-jcs',
    );
    expect(commit(JSON.parse(v.primitives.inputJson))).toBe(
      nodeSha256(v.primitives.expectedCanonical),
    );
    expect(commit({})).toBe(nodeSha256('{}'));
  });

  it('does not depend on property insertion order', () => {
    expect(commit({ b: 1, a: [true, { d: null, c: 'x' }] })).toBe(
      commit({ a: [true, { c: 'x', d: null }], b: 1 }),
    );
  });

  it('changes when any value changes', () => {
    expect(commit({ a: 1 })).not.toBe(commit({ a: 2 }));
  });

  it('produces a value accepted by isCommitment', () => {
    expect(isCommitment(commit({ a: 1 }))).toBe(true);
    expect(isCommitment(commitBytes(new Uint8Array([1, 2, 3])))).toBe(true);
  });
});

describe('Commitment', () => {
  it.each([
    ['missing 0x', 'a'.repeat(64)],
    ['uppercase hex', `0x${'A'.repeat(64)}`],
    ['too short', `0x${'a'.repeat(63)}`],
    ['too long', `0x${'a'.repeat(65)}`],
    ['placeholder fixture', '0xpolicyhash_demo_v1'],
  ])('rejects %s', (_label, value) => {
    expect(isCommitment(value)).toBe(false);
    expect(() => parseCommitment(value)).toThrow(TypeError);
  });

  it('round-trips to its 32 raw bytes', () => {
    const c = commit({ a: 1 });
    const bytes = commitmentBytes(c);
    expect(bytes).toHaveLength(32);
    expect(commitBytes(new Uint8Array(0))).toBe(nodeSha256(''));
    expect(`0x${Buffer.from(bytes).toString('hex')}` as Commitment).toBe(c);
  });
});
