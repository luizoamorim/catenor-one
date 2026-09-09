# ADR-0004 — Public / Private State Separation

**Status:** Accepted  
**Date:** 2026-09-09

## Decision
Separate public/resolvable DID state from private identity mappings/evidence/Account Bindings and from secure private-key material.

A public external account does not make its correlation to a `did:catenor` public by default.

Draft v0.1 does not require an onchain DID registry.
