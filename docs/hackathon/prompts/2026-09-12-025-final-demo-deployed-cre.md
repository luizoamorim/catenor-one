# Catenor One — final demo on the deployed CRE workflow (conversational session)

**Date:** 2026-09-12  
**Project:** Catenor One  
**Scope:** run the final clean-room demo stage by stage, with every confidential operation on the **deployed**
Chainlink Confidential Workflow; record every stage publicly with screenshots; fix the runner between stages; prepare
the video material  
**Tool:** Claude Code (main session)  
**Type:** **Prompt summary.** The session was a conversation between the maintainer and Claude Code rather than a
single written prompt. What follows summarizes the maintainer's instructions; it is not a transcript.

## Maintainer instructions (summary)

- **Run every confidential operation on the deployed workflow, the Trust Anchor admission included.** The first
  instance's admission had run on simulation, so the maintainer restarted on a new Privy app.
- **Record what is created at every stage, and why,** and keep every execution's output.
- **Before the context compaction,** write the full operating script so the session can resume from it.
- **Keep the demo state in the Railway Postgres,** not a local Docker database.
- **Check the ETHGlobal video rules first;** then use screenshots instead of screen recordings and assemble the video
  afterwards.
- **Isolate the gateway failure** with a minimal non-TEE control workflow.
- **Close with Phase M:** the documents, the evidence and the video script.

## Summary of the flow

1. **Setup.** The maintainer created the new Privy app, reset the local state (`02`) and started instance
   `c1-202609121659` (`01`) on the Railway Postgres.
2. **Stage 10:** the Privy S001 signer infrastructure.
3. **CRE deploy #1:** relay configuration, relay check, Vault secrets, deploy (Active).
4. **Stage 11 admission.** Three attempts failed at the gateway. A control workflow found the cause (the gateway URL).
   Attempt 4 was ADMITTED on the deployed workflow.
5. **CRE deploy #2:** the Trust Anchor's issuer key pinned; updated in place.
6. **Stages 20–31:** Sponsor, authorization, SPV and offering.
7. **Stages 40–44:** investors (Sumsub sandbox Lisa and Bart); 2 credentials and the offering eligibility on the
   deployed workflow.
8. **Stages 50–63 on Hedera testnet:** Privy treasury funding, tokenization (one runner fix, no redeploy), issuance
   600/400, the dividend.
9. **Stages 70–72:** Agent, relationship and delegation, with three DENY paths.
10. **Stages 80–83:** Bart sanctioned → confidential distribution on the deployed workflow (A PAY 6, B HOLD 4) → the
    Agent pays A 6 HBAR; B gets no transaction and no signature request.
11. **Stages 90–99:** verification; all 24 stages `ok`.

**Standing constraints:**

- secrets are never read, printed or committed;
- every `--live` action is run and confirmed by the maintainer;
- testnet only;
- honest labels (DEPLOYED, SANDBOX, MOCK);
- screenshots are redacted for investor DIDs and applicant IDs;
- local commits with `-s`, pushed only on request.

Record: `artifacts/final-demo/RUN-LOG.md`; `docs/hackathon/BUILD_LOG.md` (2026-09-12, final demo entry).
