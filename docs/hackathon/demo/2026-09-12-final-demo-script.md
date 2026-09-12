# Roteiro da demo final — Catenor One com CRE implantado de ponta a ponta

**Data:** 2026-09-12 · **Para:** o maintainer (executa) e o Claude Code (revisa, registra, monta o vídeo) · **Idioma:**
português, porque é o roteiro de operação desta sessão.

> Cole este arquivo de volta na conversa depois do `/compact`. Ele contém todo o contexto necessário para continuar.

---

## 0. Estado atual (antes de começar)

| Item | Estado |
|---|---|
| **Railway** | `https://catenor-one-production.up.railway.app`: commit `bc19c10`, startup INERT, Postgres migrado (5/5), `creRelay: ENABLED` com o `CATENOR_INTERNAL_API_TOKEN` sealed. Auto deploy **desligado**. Os commits locais depois de `bc19c10` só mudam scripts e docs, então **não precisa redeploy** |
| **Banco** | o runner grava no **Postgres da Railway** (`RAILWAY_DATABASE_PUBLIC_URL` no `apps/api/.env`, o `DATABASE_PUBLIC_URL` do serviço Postgres). O `02` nunca mexe nele; o `01` recusa um banco com dados de outra instância |
| **Privy** | app **novo** `catenor-one-ethonline-2026`, vazio (prints do antes da stage 10 já salvos). O `apps/api/.env` deve ter o `PRIVY_APP_ID` e o `PRIVY_APP_SECRET` **deste** app |
| **Sumsub** | sandbox com o app token antigo (decisão do maintainer). O level `id-only` já existe. Os nomes fictícios são **Lisa Simpson** (Investor A, fica verde) e **Bart Simpson** (Investor B, vira vermelho) |
| **`workflows/.env`** | `SUMSUB_APP_TOKEN_VAR`, `SUMSUB_SECRET_KEY_VAR` e `CATENOR_INTERNAL_API_TOKEN_VAR`. O último é **o mesmo valor da Railway**: **não apagar** essa linha |
| **CRE** | **nunca implantado**. CLI logado. Target `production-settings` (registro privado), workflow `identity-confidential-production` |
| **Instância local** | a `c1-202609121438` ainda está ativa, mas foi **abortada** (a admissão rodou em simulação). Os artefatos dela estão em `artifacts/final-demo/aborted-c1-202609121438/` |
| **Código** | pronto: relay Railway, espaçamento de 61 s entre disparos DEPLOYED, `cre/check-relay.sh`, nomes Simpsons. Os testes passam |
| **Git** | 9 commits locais sem push (`8d344ae` … `74f440d`). Push só quando o maintainer pedir |

**Objetivo:** todas as operações confidenciais no Confidential Workflow **implantado**:

- a admissão do Trust Anchor (stage 11);
- a elegibilidade dos investidores (42);
- a oferta (44);
- a distribuição PAY/HOLD (82).

A tese: **posse ≠ elegibilidade atual.** Lisa recebe 6 HBAR; Bart mantém as 400 unidades, mas o pagamento dele fica
retido (HOLD 4 HBAR).

---

## 1. Regras (valem o tempo todo)

- **Segredos:**
  - Nunca abrir, selecionar ou colar valores de `.env` com o chat aberto: a seleção do editor vai para o chat, e já
    vazou um token uma vez.
  - O Claude **não lê** `.env` nem `~/.catenor-one`.
  - Nunca gravar nem printar: o App secret do Privy, os tokens do Sumsub, as variáveis da Railway e os secrets do CRE.
- **Ações externas:**
  - Cada ação `--live` (CRE ou Hedera) é executada **pelo maintainer**, uma de cada vez.
  - Rodar primeiro **sem** `--live` para ver o que vai acontecer.
  - Se algo falhar, **parar**, sem repetir no escuro.
- **Hedera:** somente testnet; mainnet nunca.
- **Rótulos honestos:** simulação é SIMULATION, deployed é DEPLOYED, sandbox é SANDBOX, mock é MOCK.
- **Commits do Claude:** `git commit -s`, sem Co-Authored-By, sem push.

---

## 2. Gravação de tela (para o vídeo final)

**Regras da ETHGlobal para o ETHOnline 2026** (página de detalhes do evento, lida em 2026-09-12):

- **Prazo:** domingo, 2026-09-13, 12:00 EDT (16:00 UTC).
- **Duração:** entre **2 e 4 minutos**; fora disso o upload é rejeitado automaticamente.
- **Resolução:** no mínimo 720p.
- **Proibido:**
  - acelerar o vídeo;
  - música com texto na tela descrevendo o projeto;
  - gravar pelo celular;
  - voz sintética ou narração por IA.
- **Recomendado:**
  - falar com clareza e sem pressa;
  - introdução de no máximo 20 s;
  - **pular as esperas** (cortes são permitidos);
  - slides com no máximo 4 tópicos.
- **Consequências para nós:**
  - a narração é **a voz do maintainer**, gravada por cima do corte final;
  - as esperas saem por **corte**, nunca por aceleração;
  - as gravações de cada stage são evidência bruta, e o tamanho delas não importa.
- **O que cada prêmio exige ver:**
  - **Chainlink:** um handler de TEE processando um input sensível, com evidência do deploy ou da execução.
  - **Privy B2B:** uma wallet Privy, um fluxo B2B e um controle Privy (policies, signers, quorums), explicando como o
    Privy viabiliza o produto.
  - **Hedera Tokenization:** ATS no testnet com emissão, configuração e ao menos uma operação de ciclo de vida
    (distribuição).

- **Pasta, fora do git:** `mkdir -p ~/Movies/catenor-one-final-demo/raw`. No ⌘⇧5 → Opções → Outro local → essa pasta.
  Ative "Mostrar cliques do mouse" e deixe o microfone desligado.
- **Área:** ⌘⇧5 → "Gravar parte selecionada", pegando o navegador e o terminal. **Não** gravar o VS Code com `.env`
  aberto nem este chat.
- **Um clipe por passo:**
  1. o painel **antes** (Privy, Sumsub, HashScan ou CRE);
  2. o comando no terminal, até terminar;
  3. o painel **depois**.
- Ao terminar cada clipe, dizer ao Claude **"gravei o <passo>"**.
- **Disco:** só ~5,7 GB livres. Liberar antes com `docker builder prune`: uns 21 GB de cache, sem efeito na demo.
- **O que o Claude faz com cada clipe:**
  - extrai quadros e revisa se aparece algum segredo;
  - corta os tempos mortos e acelera as esperas (os 61 s do CRE, as confirmações do Hedera);
  - gera cartelas por stage e legendas "o que foi criado e por quê" como imagens (o `ffmpeg` local não tem
    `drawtext`; usa Pillow num ambiente temporário);
  - padroniza em 1080p e exporta um MP4;
  - copia os quadros de antes e depois para `artifacts/final-demo/screenshots/`.
- **Duas versões do vídeo:** uma **curta para os juízes** (confirmar o limite de duração da ETHGlobal) e uma **longa
  de evidência**. A narração fica opcional, gravada por cima no final.

---

## 3. Sequência

Legenda: 🎥 = gravar · ⏸ = parar e mandar a saída ao Claude antes de seguir · 💸 = gasta HBAR testnet.

### Fase A — Preparação local (sem gravar)

| # | Comando | Esperado |
|---|---|---|
| A1 | `docker exec catenor-one-demo-postgres pg_dump -U postgres catenor > .catenor-demo/backup-c1-202609121438.sql && chmod 600 .catenor-demo/backup-c1-202609121438.sql` | backup local da instância abortada (opcional) |
| A2 | `docker builder prune` | libera disco para as gravações |
| A3 | conferir que o `apps/api/.env` tem as credenciais do app **`catenor-one-ethonline-2026`** | — |
| A4 | `scripts/demo/02-reset-local-demo.sh --yes` | Postgres local removido, state movido para `.bak-*`, owner keys antigas mantidas |
| A5 ⏸ | `scripts/demo/01-setup-env.sh` | as quatro credenciais PRESENT; **`CATENOR_INTERNAL_API_TOKEN_VAR: PRESENT`** (não GENERATED); instância **nova** `c1-2026091…`; `database: RAILWAY PostgreSQL … 0 Catenor rows; 5 migrations` |

### Fase B — Trust Domain

| # | Comando | Esperado |
|---|---|---|
| B1 🎥⏸ | antes: Privy Wallets / Keys and quorums / Policies (vazios; os prints já existem) → `scripts/demo/10-create-trust-domain.sh` → depois: as mesmas três telas e o JSON das duas policies | 1 wallet Solana (bootstrap), `P_BOOTSTRAP` + `P_ASSERT`, 2 quorums, 2 owner keys; **Bootstrap Configuration hash** |

### Fase C — Deploy #1 do CRE (para a admissão)

| # | Comando | Esperado |
|---|---|---|
| C1 🎥 | `scripts/demo/cre/configure.sh --relay-url=https://catenor-one-production.up.railway.app` | chave de trigger gerada (endereço em `authorizedKeys`); callback = Railway; `.deploy/config.json` em DEPLOYED, sem `credentialRules` (normal nesta fase) |
| C2 🎥⏸ | `scripts/demo/cre/check-relay.sh` | **`callback 202 RELAYED` → `pull 200` → re-autenticado → OK**. Se der `MISMATCH`, o token da Railway é diferente do `workflows/.env`: **parar** |
| C3 🎥⏸ | `scripts/demo/cre/secrets.sh` (dry) → `scripts/demo/cre/secrets.sh --live` | autenticação no navegador; 3 secrets no Vault DON (`SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `CATENOR_INTERNAL_API_TOKEN`); nenhum valor impresso |
| C4 🎥⏸ | `scripts/demo/cre/deploy.sh` (dry) → `scripts/demo/cre/deploy.sh --live` | workflow registrado (PAUSED) → **workflow ID** (64 hex). **Risco:** é o primeiro deploy de Confidential Workflow nesta conta. Se falhar por falta de habilitação, **parar** |
| C5 🎥 | `scripts/demo/cre/activate.sh --live` | workflow ativo |
| C6 🎥⏸ | `scripts/demo/cre/configure.sh --workflow-id=<id> --use-deployed` e depois `scripts/demo/cre/status.sh` | `demoCreMode: DEPLOYED`; status mostra o workflow ativo |

### Fase D — Admissão no CRE implantado

| # | Comando | Esperado |
|---|---|---|
| D1 🎥⏸ | antes: Privy Wallets + Sumsub Individuals (hoje) → `scripts/demo/11-admit-root-trust-anchor.sh` → depois: Privy Wallets (+1 assertion wallet do TA), Keys and quorums (`…-assertion` Signer for 1), Sumsub (representante Approved), CRE UI (execução) | `confidential verification: mode **DEPLOYED**`, `EVIDENCE_RECEIVED` (resultado via relay Railway), ALLOW → ACTIVE → `TRUST_ANCHOR_VALID: true` |

### Fase E — Deploy #2 do CRE (acrescenta a chave do Trust Anchor)

| # | Comando | Esperado |
|---|---|---|
| E1 🎥 | `scripts/demo/cre/configure.sh` | a config agora tem `credentialRules` (issuer rules: "Trust Anchor key pinned") |
| E2 🎥⏸ | `scripts/demo/cre/deploy.sh --live` → `scripts/demo/cre/activate.sh --live` | novo workflow ID. **Desconhecido:** se o CLI atualiza no lugar ou pede pause/delete antes. Inspecionar com o Claude |
| E3 ⏸ | `scripts/demo/cre/configure.sh --workflow-id=<novo id>` → `scripts/demo/cre/status.sh` | o state aponta para o workflow novo, ainda DEPLOYED |

### Fase F — Sponsor, SPV e oferta (Privy, sem gastar)

| # | Comando | Esperado |
|---|---|---|
| F1 🎥 | `scripts/demo/20-create-sponsor.sh` | DID do Sponsor + assertion key própria (+1 wallet Solana) |
| F2 🎥 | `scripts/demo/21-trust-anchor-authorize-sponsor.sh` | relacionamento + 5 capabilities ALLOW; a mesma capability em outro recurso: DENY |
| F3 🎥 | `scripts/demo/30-create-spv.sh` | DID do SPV + wallet EVM + policy de execução criados **depois** do ALLOW (0 HBAR) |
| F4 🎥⏸ | `scripts/demo/31-create-offering-policy.sh` | oferta assinada pelo Sponsor: 1.000 unidades, `policy:offering-eligibility:v1` fixada por hash |

### Fase G — Investidores (Lisa e Bart ficam verdes; CRE implantado)

| # | Comando | Esperado |
|---|---|---|
| G1 🎥 | `scripts/demo/40-create-investor-a.sh` | Lisa Simpson: DID, wallet de recebimento, binding privado, holder key, Sumsub GREEN |
| G2 🎥 | `scripts/demo/41-create-investor-b.sh` | Bart Simpson: idem |
| G3 🎥⏸ | `scripts/demo/42-create-investor-credentials.sh` | **2 execuções DEPLOYED** (espera automática de ~61 s entre elas) → 2 VCs emitidas pelo Trust Anchor |
| G4 🎥 | `scripts/demo/43-create-investor-presentations.sh` | VPs com 7/7 checks; replay com outro challenge falha |
| G5 🎥⏸ | `scripts/demo/44-check-offering-eligibility.sh` → **pausa:** Sumsub com Lisa e Bart **Approved** | CRE DEPLOYED `OFFERING_ELIGIBILITY`: Lisa ALLOW 600 · Bart ALLOW 400 |

### Fase H — Hedera ATS 💸 (cada broadcast é autorizado pelo maintainer)

| # | Comando | Esperado |
|---|---|---|
| H1 ⏸ | `scripts/demo/50-fund-testnet-wallets.sh` | leitura: endereços e valores sugeridos. SPV 25 HBAR, Lisa 1, Bart 1 (a do Agent vem depois da stage 70) |
| H2 🎥 | faucet `portal.hedera.com/faucet` → `scripts/demo/50-fund-testnet-wallets.sh --wait` | wallets financiadas |
| H3 🎥⏸💸 | `scripts/demo/60-tokenize-spv.sh` (dry) → `--live` + confirmação digitada | `deployEquity` pela wallet Privy do SPV → endereço do equity (HashScan) |
| H4 🎥⏸💸 | `scripts/demo/61-investor-a-invest.sh --live` · `scripts/demo/62-investor-b-invest.sh --live` | `issueByPartition` 600 (Lisa) / 400 (Bart) |
| H5 🎥⏸💸 | `scripts/demo/63-create-dividend.sh --live` | `grantRole` + `setDividend`: direitos Lisa 6 / Bart 4 |

### Fase I — Agente de distribuição

| # | Comando | Esperado |
|---|---|---|
| I1 🎥 | `scripts/demo/70-create-distribution-agent.sh` | DID + wallet do Agent (policy: chain 296, só para Lisa/Bart, ≤ 20 HBAR); pedido **DENIED** (sem capability) |
| I2 🎥 | `scripts/demo/71-sponsor-establish-agent-relationship.sh` | relacionamento AGENT_OF: **ainda DENIED** (relacionamento ≠ capability) |
| I3 🎥⏸ | `scripts/demo/72-sponsor-delegate-distribution-capability.sh` | `EXECUTE_DISTRIBUTION` delegada → cadeia VALID; delegar TOKENIZE_ASSET é recusado |
| I4 🎥💸 | faucet → Agent 12 HBAR → `scripts/demo/50-fund-testnet-wallets.sh --wait` | Agent financiado |

### Fase J — Bart sancionado

| # | Comando | Esperado |
|---|---|---|
| J1 🎥⏸ | `scripts/demo/80-invalidate-investor-b.sh` → **pausa:** Sumsub: Lisa **Approved**, Bart **Rejected (Sanctions)** | Bart continua com 400 unidades e com a VC ACTIVE (assinatura válida ≠ elegível hoje) |

### Fase K — Distribuição confidencial e pagamento

| # | Comando | Esperado |
|---|---|---|
| K1 🎥 | `scripts/demo/81-trigger-revenue.sh` | evento de receita de 10 HBAR |
| K2 🎥⏸ | `scripts/demo/82-run-confidential-distribution.sh` | CRE DEPLOYED `CONFIDENTIAL_DISTRIBUTION` no TEE: **Lisa PAY 6 · Bart HOLD 4** |
| K3 🎥⏸💸 | `scripts/demo/83-execute-approved-distribution.sh` (dry) → `--live` + confirmação | 1 transferência: 6 HBAR para a Lisa (HashScan); **Bart: nenhuma transação, 0 pedidos de assinatura** |

### Fase L — Verificação (somente leitura)

| # | Comando | Esperado |
|---|---|---|
| L1 🎥 | `scripts/demo/90-show-cre-execution.sh` · `91-verify-hedera.sh` · `92-verify-privy.sh` · `93-verify-catenor-audit.sh` · `99-verify-complete-demo.sh` | execuções CRE DEPLOYED, txs Hedera, controles do Privy, cadeia de auditoria válida, demo completa |

### Fase M — Fechamento (Claude)

- **Registros:**
  - `artifacts/final-demo/RUN-LOG.md` completo, com as refs públicas de cada stage;
  - galeria `artifacts/final-demo/screenshots/`;
  - `artifacts/chainlink/final-demo/` com a evidência do workflow implantado.
- **Docs:** BUILD_LOG, PROVENANCE (se necessário), FINAL-DEMO e SUBMISSION_CHECKLIST.
- **Vídeo:** as versões curta e longa em `~/Movies/catenor-one-final-demo/`.
- **Git:** commits locais; push quando o maintainer pedir. O deploy da Railway só se o código do API mudar.

---

## 4. O que o Claude faz a cada ⏸

1. Lê a saída do comando e o registro sanitizado em `.catenor-demo/runs/` (nunca `.env`).
2. Confere o resultado com o "Esperado". Se divergir, diagnostica **antes** do próximo passo.
3. Atualiza o `artifacts/final-demo/RUN-LOG.md`, com refs públicas apenas: sem DID de investidor, ID de applicant,
   VC/VP ou chave.
4. Revisa os clipes e prints recebidos (quadros ou imagens), procurando segredos. Salva os quadros na galeria, com a
   legenda "o que é e por quê".
5. Faz um commit local (`-s`).

## 5. Riscos conhecidos

- **C4, habilitação do Confidential Workflows:** nunca foi testada com deploy real.
- **E2, redeploy:** o comportamento do CLI é desconhecido (atualizar no lugar ou pausar e apagar antes).
- **Limite de disparos:** 1 por 60 s. O runner espera sozinho; não rodar duas stages confidenciais em paralelo.
- **Relay:** não fazer redeploy da Railway durante uma execução CRE (o resultado ainda não buscado se perde).
- **Faucet:** o limite diário do faucet Hedera pode atrasar a fase H.
- **Disco:** gravações grandes. Liberar espaço antes (A2).
