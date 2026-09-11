// Final demo — public, non-secret demo values (FINAL-DEMO §1). Addresses only: investor wallets are Privy EVM
// receiving accounts (owner = maintainer-held key; no runtime signer, no policy — provision-investor-wallets.mjs).
// The link between an investor's did:catenor and its wallet is a PRIVATE Account Binding created at demo time in the
// Catenor database; it is never published here.

/** Rehearsal ATS equity deployed LIVE on 2026-09-11 (tx 0x8265479f…5897) — artifacts/hedera/final-demo/. */
export const REHEARSAL_EQUITY = '0x7aeDA4b6B89dA392Efd88AD0Fcb075e12ab6a418';

/** Investor receiving wallets (Privy development app) and the proposed issuance, in whole units (0 decimals). */
export const DEMO_INVESTORS = {
  A: {
    label: 'Investor A',
    address: '0x8D726Ab3aD261f03C60D9073F2bf05C9899a7F78',
    issueUnits: 600n,
  },
  B: {
    label: 'Investor B',
    address: '0x72f94a15A815853B488BCf225ec3cb67eC5ba444',
    issueUnits: 400n,
  },
} as const;
