# S001 Phase 0 — cre-engineer subagent, CRE access check, CRE runtime spike, Sumsub sandbox spike

**Date:** 2026-09-10  
**Project:** Catenor One  
**Slice:** S001 — Trust Anchor Admission  
**Tool:** Claude Code (main session) + `cre-engineer` project subagent (loads the official `chainlink-cre-skill`)  
**Type:** Human prompt to Claude Code — verbatim text of the maintainer's instruction (formatting condensed)  
**Related plan:** `docs/hackathon/plans/2026-09-10-005-s001-phase0-cre-sumsub-spikes.md`

## Prompt (verbatim content)

> Continue Catenor One S001 from the approved PLAN.md / TASKS.md and the aligned source-of-truth.
>
> IMPORTANT: We are currently waiting for clarification from the Privy team before making the final decision on: EVM vs Solana dedicated Credential Assertion Key; final signing primitive; final crypto/signature profile.
>
> Therefore: DO NOT: run the Privy signing spike yet; change Ed25519 / eddsa-jcs-2022 assumptions yet; change the crypto profile; implement the assertion signer; redesign S001.
>
> Work only on Phase 0 items that are independent from the pending Privy decision.
>
> **1. CREATE THE CRE SPECIALIST SUBAGENT.** Create: `.claude/agents/cre-engineer.md`. It must use/load the installed: `chainlink-cre-skill`. Its scope: CRE CLI; current official CRE docs/skill; cre init and official scaffolding; QuickJS/WASM constraints; Confidential Workflows; handlerInTee; TeeRuntime; Vault DON secrets; HTTPClient inside the TEE; simulation; deployment; activation; deployed workflow invocation; execution inspection; debugging; CRE security boundaries. It MUST NOT redefine: Catenor Protocol semantics; Canonical Subject model; Trust Anchor semantics; authority model; delegation model; policy semantics; Subject Continuity semantics; S001 requirements. Before using it, show me the generated subagent file and validate that Claude Code recognizes it and can access chainlink-cre-skill. Do not start CRE implementation before that validation.
>
> **2. CONFIRM CRE ACCESS STATUS.** Check the current CRE CLI/account state. We already know: CRE CLI is installed; deploy access has previously appeared enabled; private deployment registry was available. Confirm the current state without exposing any credentials. Specifically distinguish: general Deploy Access from: Confidential Workflows Private Beta enrollment. If Confidential Workflows enrollment cannot be confirmed programmatically, report exactly what still requires confirmation from Chainlink. Do not treat normal deploy access as proof of Confidential Workflows enrollment.
>
> **3. RUN ONLY THE CRE RUNTIME SPIKE.** Use the cre-engineer subagent. Goal: validate the technical assumptions required by S001 before real implementation. Use current official Chainlink docs / chainlink-cre-skill. Do NOT manually build the real identity-confidential project yet. For the spike, validate as minimally as possible: handlerInTee works in simulation; TeeRuntime behavior; batched secret retrieval; HTTPClient from inside handlerInTee; runtime.now(); current QuickJS/WASM restrictions; current workflow HTTP request limits; current trigger behavior; whether the symmetric crypto needed for the SEALED INPUT design can run in the CRE TypeScript runtime. We specifically need to know whether we can safely implement: Catenor API → encrypted/sealed private context → public HTTP trigger containing ciphertext only → handlerInTee → decrypt inside TEE. Do not choose a fallback silently. If the crypto/runtime assumption fails: STOP and report the blocker for human review. Do not start production workflow code.
>
> **4. RUN THE SUMSUB SANDBOX SPIKE.** Use current official Sumsub documentation. Goal: verify the real provider semantics that S001 depends on. We need to understand with real Sumsub sandbox behavior: company applicant flow; representative/individual applicant flow; linking representative to company; externalUserId behavior; company applicant fields; representative fields; review status / GREEN / RED behavior; company checks; beneficiary/member/authority relation fields; whether testCompleted works for company applicants; which fields are actually strong enough to derive: ORGANIZATION_KYB_VERIFIED, ORGANIZATION_STATUS_VALID, ORGANIZATION_AML_CLEAR, AUTHORIZED_REPRESENTATIVE_VERIFIED, REPRESENTATIVE_AUTHORITY_CONFIRMED, EVIDENCE_FRESH. Use synthetic sandbox data only. Never log or commit API secrets. Record only sanitized field shapes / findings. If any assumption from PLAN.md about Sumsub fields is wrong: DO NOT silently adapt production semantics. Report the difference and the proposed PLAN correction for human review.
>
> **5. DO NOT RUN PRIVY SPIKE YET.** The Privy team is currently answering which primitive they recommend for the dedicated Credential Assertion Key. Until that answer is reviewed: DO NOT: create the assertion wallet; choose Solana or EVM; change crypto profile; implement key possession; modify D1/D3.
>
> **6. DOCUMENT THE PHASE-0 WORK.** Update the appropriate hackathon documentation for these actions/results: BUILD_LOG.md; PROVENANCE.md where new external tooling/reference usage is introduced; AI_USAGE.md if the cre-engineer subagent / official Chainlink skill is materially used. Also create the appropriate prompt/plan artifact for this Phase 0 work if one does not already exist. Do not fabricate results.
>
> **7. STOP CONDITION.** After: 1. creating/reviewing cre-engineer; 2. checking CRE access/enrollment status; 3. completing the CRE runtime spike; 4. completing the Sumsub sandbox spike; STOP. Report: CRE subagent status; CRE access status; CRE runtime assumptions CONFIRMED / FAILED / UNCONFIRMED; sealed-input feasibility; actual HTTP/runtime limits found; Sumsub assumptions CONFIRMED / FAILED / UNCONFIRMED; any PLAN/TASKS changes now required; any human action required; confirmation that the Privy/crypto decision was not touched; confirmation that no main S001 production implementation was started. Do not continue into the P0 Fast Lane until human approval.

## Derived sub-prompts

- The CRE runtime spike prompt delegated to `cre-engineer` (through a headless Claude Code session, because the running IDE session had not yet loaded the newly created agent directory) is preserved as the plan appendix in `docs/hackathon/plans/2026-09-10-005-s001-phase0-cre-sumsub-spikes.md`.
- A documentation-only Sumsub research sub-task was delegated to a general-purpose Claude Code subagent (prompt summary in the same plan).
