---
name: softhouse
description: Bíblia do sistema SoftHouse (Gestão Patrimonial / Family Office). Regras, arquitetura, APIs, migrações, bugs corrigidos e como o Luiz quer o sistema. CONSULTAR SEMPRE antes de alterar qualquer coisa neste projeto.
when_to_use: Antes de QUALQUER modificação, correção ou nova feature no SoftHouse (pasta casa-macia). Ler antes de mexer em código, banco, RLS, deploy ou storage.
---

# 📖 SoftHouse — A Bíblia do Sistema

> Este arquivo é a fonte da verdade do projeto. **Ler ANTES de qualquer alteração.**
> Sempre que corrigir um bug, mudar arquitetura, adicionar API ou o Luiz disser como quer algo → **registrar aqui**.

## ⚖️ REGRAS DE OURO (inegociáveis)

1. **Consultar esta bíblia antes de mexer em QUALQUER coisa.** Se o que vou fazer contradiz algo aqui, parar e avisar o Luiz.
2. **Listar o plano antes e só executar depois do "ok" do Luiz.** Ele revisa antes.
3. **Ao detectar um erro, algo estranho ou diferente do esperado → PERGUNTAR ao Luiz antes de executar.** Nunca sair corrigindo por conta própria sem avisar.
4. **Eu (Claude) faço o deploy.** O Luiz não faz deploy manual.
5. **Explicar tudo em português simples** — o Luiz é leigo em programação.
6. **Nunca apagar dados.** Migrações só mexem em regras/estrutura, nunca `DELETE`/`DROP TABLE`/`TRUNCATE` sem autorização explícita.
7. **Registrar aqui**: como o Luiz quer cada coisa, bugs encontrados, como foram corrigidos, planos, APIs e estrutura.

## 🧭 O que é o SoftHouse

Sistema web de **gestão de Family Office / patrimônio**. (O `README.md` é o template padrão do Next.js — ignorar; o produto real é o SoftHouse.)
Modelo multi-portfólio: um usuário pode ter o **próprio portfólio** e ser **colaborador** de outros (family offices), alternando entre eles.

**Stack:** Next.js 14.2.35 (App Router) + TypeScript + Tailwind · Supabase (@supabase/ssr + service role) · @anthropic-ai/sdk (IA) · Leaflet (mapas) · Recharts · @react-pdf/renderer · Resend · @hello-pangea/dnd (kanban) · react-hook-form + zod.
`next.config.mjs`: `typescript.ignoreBuildErrors = true` e `eslint.ignoreDuringBuilds = true` (erros de tipo NÃO quebram o build; erros de sintaxe sim).

## 🚀 DEPLOY (endereço correto — crítico!)

- **Site real do Luiz:** `https://softhouse-nine.vercel.app` — fica na **conta pessoal da Vercel dele** (`medeirosgabrielsmb-7190s-projects`).
- Faz **deploy automático** a cada `git push origin main` no repo `lvgab23/softhouse`.
- ⚠️ **NÃO é** o `casa-macia.vercel.app` (projeto paralelo na conta CheckPlaca, à qual a CLI local está logada). Deploy manual via `vercel --prod` vai pro lugar ERRADO.
- **Como deployar:** `git push origin main` (auto-deploy). Se o auto-deploy "pular" um commit (acontece no free tier), forçar com `git commit --allow-empty -m "redeploy" && git push`.
- **Como conferir se chegou no site do Luiz:** GitHub deployments API do repo — o `target_url` do último status deve conter `medeirosgabrielsmb` com `state: success`:
  ```bash
  TOKEN=$(git remote get-url origin | sed -E 's|https://[^:]+:([^@]+)@.*|\1|')
  DEP=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/lvgab23/softhouse/deployments?per_page=1" | grep -oE '"id": [0-9]+' | head -1 | grep -oE '[0-9]+')
  curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/lvgab23/softhouse/deployments/$DEP/statuses" | grep -E '"state"|"target_url"'
  ```
- **Não há `.env.local` local** nem `DATABASE_URL` acessível. Credenciais só na Vercel. Para migrações SQL: dar o SQL pro Luiz colar no **SQL Editor do Supabase** (ele sabe fazer) — role `postgres`.

## 🔐 ARQUITETURA MULTI-TENANT (o coração — cuidado ao mexer!)

Cada usuário tem um **portfólio ativo** guardado no banco. A trava (RLS) de todas as tabelas filtra por ele automaticamente.

**Peças no banco (migração 013):**
- Tabela `user_active_portfolio(user_id, active_owner_id)` — portfólio ativo de cada usuário.
- `current_owner()` → retorna o portfólio ativo do usuário logado (default: ele mesmo). SECURITY DEFINER.
- `is_member_of(target)` → true se o usuário é dono OU colaborador ativo daquele portfólio.
- `set_active_portfolio(target)` → RPC que valida acesso e troca o portfólio ativo.
- Trigger `trg_set_active_owner` (BEFORE INSERT) → força `user_id = current_owner()` em toda inserção de usuário logado (service role/cron não são afetados, pois `auth.uid()` é NULL).
- **RLS de todas as tabelas com `user_id`**: `USING (user_id = current_owner()) WITH CHECK (user_id = current_owner())`. Exceções: `colaboradores` e `user_active_portfolio` (regras próprias).
- Tabelas-filhas (kanban_*, usinas_*, diarios_resultados, solar_geracoes, kanban_attachments) escopadas pelo `user_id` do **pai** = `current_owner()` (migrações 013 e 014).
- `profiles`: policy `members_view_profile` deixa o colaborador ler nome/email do dono.

**No código:**
- `src/lib/portfolio-context.tsx`: portfólio ativo vem do banco (`user_active_portfolio`); `switchPortfolio` chama a RPC `set_active_portfolio` ANTES de recarregar.
- **Leituras diretas do browser** (client) já são escopadas pela RLS. Não precisa filtrar por user no código.
- **Rotas de API** (server) usam `createClient()` (SSR, respeita RLS) → **NÃO filtrar por `user.id`**; deixar a RLS escopar. Filtrar por `user.id` quebra o modo colaborador (foi o bug do compliance/diários).
- **Gravação:** o trigger já força o portfólio certo. Ainda assim, preferir `activeOwnerId` explícito nas páginas.
- ⚠️ **NUNCA** voltar a usar `auth.uid() = user_id` nas policies nem `.eq('user_id', user.id)` nas rotas — isso reintroduz o bug de "dados sumindo" no modo colaborador.

## 🗂️ Módulos (rotas em src/app)

Dashboard/Evolução/Histórico · Cadastros (imóveis, bens-móveis, fornecedores, categorias) · Financeiro (DRE, conciliação, contas-bancárias, lançamentos, movimentações, recebimentos, transferências) · Investimentos · Negócios (empresas, sócios, compliance) · Projetos (usinas-solares, aportes, etc.) · Compliance (motor com ~20 engines em `src/lib/compliance/engines/`) · Diários Oficiais · Colaboradores + seletor de portfólio · Mapa · Inventário · Manutenções · Kanban / Kanban-ADM.

## 🔌 APIs e integrações

- **Supabase**: banco + auth + storage. Clientes em `src/lib/supabase/` (`client.ts` browser, `server.ts` SSR + `createAdminClient` service role).
- **Anthropic** (`@anthropic-ai/sdk`): análise de compliance com IA (`/api/compliance/analisar/[id]`, modelo `claude-haiku-4-5-20251001`).
- **Compliance engines**: Receita/CNPJ, CVM, Bacen, DataJud, Escavador, IBAMA, PEP, PGFN, SAJ, sanções internacionais, TJMG/TJRJ/TJRS, transparência, mídia.
- **Diários Oficiais**: Querido Diário, DOU, DataJud (`/api/diarios-oficiais/*`).
- **Usinas solares**: APIs elekeeper e solarz.
- **Resend**: e-mails.
- **Storage (Kanban anexos)**: bucket privado `kanban-attachments`; leitura pela portaria `/api/kanban/anexo/[id]`.

## 🐛 Bugs corrigidos (histórico)

### 2026-06-05 — Multi-tenant não isolava dados (colaborador)
- **Sintoma:** ao abrir o portfólio de um colaborador, dados sumiam e gravação dava erro.
- **Causa:** RLS `auth.uid() = user_id` bloqueava acesso entre contas; páginas gravavam `user_id: user.id`.
- **Correção:** migração 013 (arquitetura multi-tenant acima). Deploy commit 4507a24. **✅ confirmado pelo Luiz.**

### 2026-06-05 — Bug de sintaxe em Financeiro/Lançamentos
- **Sintoma:** erro na página. **Causa:** consulta corrompida `.eq ? .from(...)`. **Correção:** query limpa.

### 2026-06-05 — Compliance e Diários vazios no modo colaborador
- **Causa:** rotas de API filtravam `.eq('user_id', user.id)` (usuário logado) em vez de confiar na RLS.
- **Correção:** removido o filtro manual das rotas de `/api/compliance/*` e `/api/diarios-oficiais/*`. Migração 014 (tabelas-filhas). Commits 2aa18ac/288e805. **✅ compliance confirmado pelo Luiz.**

### 2026-06-05 — Anexos do Kanban: "Bucket not found"
- **Sintoma:** ao abrir anexo, `{"statusCode":"404","error":"Bucket not found"}`.
- **Causa:** o bucket `kanban-attachments` nunca foi criado; e o código abria por `getPublicUrl` (bucket privado não serve por URL pública).
- **Decisão do Luiz:** modelo **Trello** — link fixo (não temporário) mas só quem tem acesso ao quadro/portfólio abre.
- **Correção:** migração 015 cria o bucket **privado**; nova portaria `/api/kanban/anexo/[id]` confere acesso (RLS) e entrega o arquivo via service role; `KanbanCardDetail.tsx` abre arquivos por `fileUrl()` (a portaria). Commit cd0ef71.
- **Obs:** anexos enviados ANTES da correção não foram realmente salvos (upload falhava sem bucket) → precisam ser reenviados.

## 🧱 Migrações do banco (supabase/migrations)

Aplicar via SQL Editor do Supabase (role postgres). Estado:
- 001–012: schema base, kanban, compliance, usinas, etc. (já aplicadas).
- **013** `multitenant_rls.sql` — ✅ aplicada 2026-06-05.
- **014** `multitenant_rls_filhas.sql` — ✅ aplicada 2026-06-05.
- **015** `kanban_bucket.sql` — ⚠️ criar o bucket privado (rodar quando for testar anexos do Kanban).
- **016** `kanban_boards.sql` — ⚠️ EM TESTE (branch `feature/kanban-quadros`). Quadros personalizados do Kanban (estilo Trello): tabela `kanban_boards` (nome, cor, colunas jsonb) + coluna `board_id` em `kanban_cards` + CHECK de `board_type` inclui 'custom'/'adm'. Rodar só quando for testar a feature.

## 🆕 Feature EM TESTE — Múltiplos quadros no Kanban (estilo Trello)

**Branch:** `feature/kanban-quadros` (deploy de PREVIEW na Vercel — NÃO é produção). Só vai pra `main`/produção depois do Luiz validar.
**Decisões do Luiz:** só cor/ícone (sem foto de capa); Pipeline atual fica **fixado e separado** (intacto); colunas **personalizáveis por quadro**. Mexer **só no `/kanban`** (abaixo de Evolução) — NÃO tocar nos kanbans de módulo (negócios, bens, financeiro, projetos, investimentos).
**Como funciona:** `/kanban` vira a tela "Seus quadros" (grade): Pipeline fixado no topo + quadros criados pelo usuário + botão "Novo quadro". Cada quadro tem Editar e Excluir. Clicar abre o quadro.
**Arquivos:** `src/app/kanban/page.tsx` (seletor de quadros); `src/components/kanban/KanbanFullBoard.tsx` ganhou prop opcional `board` (modo `custom`): colunas vêm de `kanban_boards.columns` (salvas no banco), cards por `board_id`, sem auto-sync. O modo legado (boardType) continua idêntico para os outros kanbans.
**Multi-tenant:** `kanban_boards` escopada por `current_owner()` + trigger (igual ao resto).

## ⚠️ Pontos críticos — NÃO mexer sem cuidado/ok

- Policies RLS e as funções `current_owner`/`is_member_of`/`set_active_portfolio` — mexeu errado, quebra o isolamento entre portfólios.
- Trigger `trg_set_active_owner` — remove e as gravações vão pro portfólio errado.
- `portfolio-context.tsx` — é o que sincroniza cliente ↔ banco. Alterar com cuidado.
- Rotas de API — não reintroduzir filtro por `user.id`.
- Deploy — sempre no `softhouse-nine` (auto-deploy via push).

## 📌 Pendências / backlog

- Testar Diários Oficiais no modo colaborador.
- Testar anexos do Kanban após rodar a migração 015 + reenviar o contrato.
- Deleção de anexo de arquivo hoje só o autor do upload remove o arquivo físico (outros removem só o registro) — melhorar via portaria se incomodar.
- Objetivo/visão do produto e roadmap: capturar com o Luiz.
