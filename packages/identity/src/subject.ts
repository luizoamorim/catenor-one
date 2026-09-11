import type { CatenorDid } from './did.js';

export const SUBJECT_TYPES = ['HUMAN', 'ORGANIZATION', 'AGENT'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const SUBJECT_LIFECYCLES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type SubjectLifecycle = (typeof SUBJECT_LIFECYCLES)[number];

/**
 * Canonical Subject — an internal record, not a protocol wire object (DATA-MODEL §6).
 * It carries no PII and no provider identifiers; those live in private application state.
 */
export interface Subject {
  readonly did: CatenorDid;
  readonly type: SubjectType;
  readonly lifecycle: SubjectLifecycle;
}

export function createSubject(did: CatenorDid, type: SubjectType): Subject {
  if (!(SUBJECT_TYPES as readonly string[]).includes(type)) {
    throw new TypeError(`unknown subject type: ${String(type)}`);
  }
  return { did, type, lifecycle: 'ACTIVE' };
}
