import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CATENOR_DID_PATTERN, generateCatenorDid, isCatenorDid, parseCatenorDid } from './did.js';
import { createSubject } from './subject.js';

// TEST-VECTORS §4–5 fixtures
const LEGAL_NAME = 'Organization A';
const COMPANY_APPLICANT_ID = 'sumsub_company_fixture_001';
const REPRESENTATIVE_APPLICANT_ID = 'sumsub_person_fixture_001';
const OPERATOR_EMAIL = 'bootstrap.owner@example.com';

describe('TV-S001-C01 — create opaque canonical Organization DID', () => {
  const did = generateCatenorDid(randomBytes(16));
  const subject = createSubject(did, 'ORGANIZATION');

  it('starts with did:catenor: and carries 128 random bits as 32 lowercase hex characters', () => {
    expect(did.startsWith('did:catenor:')).toBe(true);
    expect(did).toMatch(CATENOR_DID_PATTERN);
  });

  it('creates an ORGANIZATION subject', () => {
    expect(subject).toEqual({ did, type: 'ORGANIZATION', lifecycle: 'ACTIVE' });
  });

  it('does not contain the legal name, applicant IDs or operator email', () => {
    for (const forbidden of [
      LEGAL_NAME,
      COMPANY_APPLICANT_ID,
      REPRESENTATIVE_APPLICANT_ID,
      OPERATOR_EMAIL,
    ]) {
      expect(did).not.toContain(forbidden);
      expect(did.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('accepts only CSPRNG bytes as input — never identity data', () => {
    expect(() => generateCatenorDid(new TextEncoder().encode(LEGAL_NAME))).toThrow(TypeError);
    expect(() => generateCatenorDid(new Uint8Array(15))).toThrow(TypeError);
    expect(() => generateCatenorDid(new Uint8Array(17))).toThrow(TypeError);
  });
});

describe('TV-S001-C02 — same legal name does not determine DID', () => {
  it('two independent candidates named "Organization A" get different DIDs', () => {
    const did1 = generateCatenorDid(randomBytes(16));
    const did2 = generateCatenorDid(randomBytes(16));
    expect(did1).not.toBe(did2);
  });

  it('the generator has no name parameter: equal random input is the only way to equal output', () => {
    const bytes = randomBytes(16);
    expect(generateCatenorDid(bytes)).toBe(generateCatenorDid(Uint8Array.from(bytes)));
  });
});

describe('CatenorDid parsing', () => {
  it.each([
    'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b',
    'did:catenor:00000000000000000000000000000000',
  ])('accepts %s', (value) => {
    expect(parseCatenorDid(value)).toBe(value);
  });

  it.each([
    ['uppercase hex', 'did:catenor:8F0C92D7E5F04E40A41FAEE32E5E180B'],
    ['short', 'did:catenor:8f0c92d7'],
    ['other method', 'did:web:example.com'],
    ['name-derived', 'did:catenor:organization-a'],
    ['trailing fragment', 'did:catenor:8f0c92d7e5f04e40a41faee32e5e180b#k'],
  ])('rejects %s', (_label, value) => {
    expect(isCatenorDid(value)).toBe(false);
    expect(() => parseCatenorDid(value)).toThrow(TypeError);
  });
});
