# ADR-0006 — Official Sponsor Integration Agents / Skills

**Status:** Accepted  
**Date:** 2026-09-09

## Decision
Use current official Chainlink CRE, Privy, and Arc/Circle agent/skill/documentation tooling when available before implementing sponsor-specific adapters.

```text
Domain defines port
→ official sponsor tooling guides implementation
→ adapter implements port
```

Sponsor tooling cannot redefine Catenor domain semantics. Meaningful use must be documented in AI usage/provenance/build logs, and judge-verifiable artifacts must be preserved.
