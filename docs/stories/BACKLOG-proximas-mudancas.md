# Backlog — mudanças anotadas para depois

Itens pedidos pelo Vinicius para fazer **depois** do que está em andamento. Cada um vira story quando entrar.

## Depois do LIVE1.1 (painel ao vivo)
1. **LIVE1.2–1.4** — leituras a cada 15 min e alertas, fontes (sync da Meta, tracker no checkout, webhooks), IA. Detalhe em `EPIC-LIVE1-painel-ao-vivo.md`.

## Achados do LIVE1.1 nos dados reais (para o LIVE1.3 — fontes)
- `imphq_ads_spend.checkouts_iniciados` chega sempre 0; o número real está em `init_checkout` (já tratado na leitura). Corrigir no sync para gravar nas duas ou padronizar.
- JP em julho: pixel com centenas de compras/dia e webhook com ~1 → o checkout não estava mandando as vendas ao Império. Conferir a integração do checkout do JP e reimportar o período se possível.
- Sync do JP via Zernio rodou até 19/08 com gasto zero (campanhas paradas?) e o sync direto da Meta parou em 06/06. Decidir uma fonte única de gasto.
- `InitiateCheckout` do tracker chega sem `project_id`.

## Mapa difícil de entender (03/10/2026)
> Em andamento: visão "Caminho" entregue na story MAP2.3 (03/10). Filtros e legenda fixa no canvas seguem para avaliar.
> "Ainda acho difícil no mapa entender os passos, resultados, métricas, caminho principal, alternativas."

O que o mapa precisa deixar óbvio, para qualquer pessoa, sem abrir cada etapa:
- **Passos:** ordem clara (1, 2, 3…) e em que fase cada um está (preparação, aquisição, conversão, medição).
- **Resultado de cada passo:** o que ele entrega (contrato "SAÍDA" / "PRONTO QUANDO") visível no card, não só no painel.
- **Métricas:** valor real × meta no próprio card (verde/amarelo/vermelho), usando a métrica do playbook (STR1.2 ainda não feito).
- **Caminho principal × alternativas:** destacar o fluxo que leva à venda (seta grossa, numerado) e mostrar desvios (recuperação, downsell, cemitério do P4) como ramos secundários.
- **Onde está travado:** etapa bloqueando o caminho principal em evidência (dono, prazo, o que falta).

Ideias para avaliar quando entrar (com o Vinicius, antes de construir):
- Visão "Caminho" (linear, de cima para baixo, só o principal) ao lado da visão "Mapa" (livre).
- Legenda fixa e filtros: só caminho principal / só pendências / só métricas fora da meta.
- Cada playbook marca suas etapas como principal ou alternativa (campo no passo do playbook) para o mapa saber desenhar.
- Card compacto padrão: nº do passo · nome · dono · status · métrica × meta · próximo resultado esperado.

## Segurança — deixada para o final (levantamento de 07/10/2026)
Repositório `vsugamele/imperiox-aa918b63` é **público**. Achados (sem imprimir chaves):
- 🔴 Chave **service_role** de produção em `scripts/inject_geelark_tools_map.mjs` e `scripts/inject_master_company_map.mjs` (acesso total ao banco).
- 🟠 Chave de API do **n8n** em `scratch/deploy_json.ps1` e `scratch/n8n_deploy_script.ps1`.
- 🟠 Chave da **Evolution** esteve no `OPERACAO.md` (hoje não está; segue no histórico do git).
- 🟢 Chave `anon` em 18 arquivos e no `.env` (pública por natureza).
- A `anon` antiga está em 70 de 86 crons, sites e tracker: trocar a service_role (novo segredo JWT ou chaves novas `sb_secret_`/`sb_publishable_`) derruba a `anon` antiga junto → troca planejada.

Plano proposto: (1) repositório privado (conferir deploy Vercel antes); (2) tirar segredos dos arquivos (scripts leem variável de ambiente, `scratch/` sai); (3) migrar para as chaves novas do Supabase com mapa de todos os usos e desligar as antigas; (4) Vinicius: revogar chave do n8n, trocar chave da Evolution, trocar senhas do SEC1.1.
