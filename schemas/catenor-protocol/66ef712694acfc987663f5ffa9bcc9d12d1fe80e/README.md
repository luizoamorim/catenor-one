# Catenor Protocol schemas — vendored at the pinned baseline

Source: https://github.com/luizoamorim/catenor (Catenor Protocol, Apache-2.0)
Commit: `66ef712694acfc987663f5ffa9bcc9d12d1fe80e` (docs/PROTOCOL-BASELINE.md)
Copied with: `git show 66ef712694acfc987663f5ffa9bcc9d12d1fe80e:schemas/<name>.schema.json` — byte-for-byte, unmodified.

These files are protocol specification artifacts, used by Catenor One tests to check that protocol-shaped
objects (Policy, Decision, AuditEvent) conform to the pinned protocol. Do not edit them here; update the
baseline pin instead (docs/PROTOCOL-BASELINE.md "Updating the baseline").

Maintainer approval (2026-09-11, required by CLAUDE.md for importing protocol material): **approved**, on the
condition that the files remain unmodified copies of the pinned commit with their hashes and provenance
recorded. `test-vectors/src/protocol-schemas.test.ts` fails if any file's SHA-256 differs from the table below.

| File | SHA-256 |
|---|---|
| `audit-event.schema.json` | `9d49b65c0e258a3a7be14dc57c05e72a7141f14f3bab92f50aa6e472a5dce77a` |
| `decision.schema.json` | `a27344279781e36ba619bb38ff266d6c3fc79b9639f0c2c508bf53a8d9253805` |
| `policy.schema.json` | `59334599fbb721b0ebb925c2f9b186ebcc3863044411ad20623ab7cde671b536` |
