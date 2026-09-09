# ADR-0003 — DDD-lite + Clean Architecture Boundaries

**Status:** Accepted  
**Date:** 2026-09-09

## Decision
Use ubiquitous language, value objects, domain invariants, meaningful aggregates/services, and ports. Keep dependencies pointing inward. Domain packages remain framework/vendor independent.

Avoid ceremony that adds files without protecting domain rules.
