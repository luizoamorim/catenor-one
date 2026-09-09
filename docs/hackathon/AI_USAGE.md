# AI Usage — ETHOnline 2026

> Catenor One uses AI-assisted development as part of a human-directed, spec-driven engineering workflow.

**Status:** Living document  
**Last updated:** 2026-09-09

## Principles

AI is used to accelerate:
- protocol discussion and review;
- software architecture;
- specification drafting;
- implementation planning;
- coding;
- tests;
- security review;
- documentation;
- visual/design exploration.

The human maintainer remains responsible for:
- protocol decisions;
- project scope;
- architecture approval;
- acceptance criteria;
- review of generated code;
- merge decisions;
- submission claims.

AI-generated output is never treated as automatically correct.

## ChatGPT

Used for:
- Catenor Protocol architecture discussion;
- DID / VC / VP explanations;
- Subject Continuity design;
- authority, Capability, Delegation, and Trust Anchor Admission design;
- privacy and key-purpose-separation design;
- Catenor Protocol Draft v0.1 documentation;
- Catenor One project architecture;
- vertical-slice / spec-driven workflow design;
- security and negative-path reasoning;
- website/documentation UX direction;
- naming research;
- branding exploration and generated visual assets;
- provenance and hackathon documentation.

Human direction included:
- selecting Catenor Protocol;
- selecting `did:catenor`;
- accepting/rejecting architecture proposals;
- correcting privacy/account-binding assumptions;
- defining the separation between protocol and reference implementation;
- selecting Catenor One;
- selecting the brand direction;
- approving slices and implementation direction.

## Claude Code

Used/planned for:
- repository inspection;
- planning from approved specs;
- coding;
- integration work;
- tests;
- refactoring;
- build/lint/typecheck fixes;
- docs-site implementation;
- consistency checks.

Claude Code must:
- follow `CLAUDE.md`;
- follow the pinned protocol baseline;
- not silently redefine protocol semantics;
- not finalize open protocol decisions without approval;
- preserve AI/provenance artifacts;
- validate before claiming work complete.

## AI-generated visual assets

AI image generation has been used to explore Catenor branding and social/visual assets.

Selected assets are human-reviewed.

Generated visual concepts do not define protocol semantics.

When an AI-generated asset is committed, record it in `PROVENANCE.md`.

## Spec-driven AI workflow

```text
Human intent
    ↓
Slice SPEC
    ↓
AI-assisted PLAN
    ↓
Human approval
    ↓
AI-assisted implementation
    ↓
Acceptance tests
    ↓
Human review
    ↓
Commit
```

Prompts and plans live under:

```text
docs/hackathon/prompts/
docs/hackathon/plans/
slices/<slice>/
```

## Not delegated to AI

AI does not independently decide:
- protocol governance;
- legal conclusions;
- hackathon eligibility claims;
- final authority/compliance policy;
- acceptable vulnerabilities;
- production security assumptions;
- submission facts.

## Logging policy

For substantial AI-assisted work, record:

```text
date
AI tool
goal
prompt or prompt summary
plan/spec used
files/areas affected
human review notes
commit SHA when available
```

Do not fabricate missing transcripts.

If exact prompt text is unavailable, label it `Prompt summary`.
