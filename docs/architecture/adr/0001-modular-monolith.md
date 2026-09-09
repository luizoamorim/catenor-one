# ADR-0001 — Modular Monolith

**Status:** Accepted  
**Date:** 2026-09-09

## Decision
Use one NestJS backend deployable with explicit internal domain/module boundaries. Do not begin with microservices.

## Why
Faster development/deployment, simpler transactions and debugging, less distributed-systems overhead, while preserving future extraction options.
