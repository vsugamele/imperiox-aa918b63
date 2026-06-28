# Montar Funil Automático

Adicionar um botão no Hub de Funis que monta o canvas completo automaticamente a partir de tudo que já existe vinculado ao projeto: produtos do briefing, fluxos do OpenFlow, campanhas de WhatsApp, sequências de e-mail, páginas/sites, anúncios ativos e webhooks de pagamento.

## Onde aparece

- Botão **"⚡ Montar Funil Automático"** no header do `/funis` (ao lado de Templates e Snapshots).
- Modal de preview antes de aplicar: lista o que foi detectado e deixa o usuário desmarcar o que não quer.
- Cria um **snapshot** antes de sobrescrever (rollback garantido via Snapshots existentes).

## O que o sistema coleta por projeto

| Fonte | Tabela | Vira nó de... |
|---|---|---|
| Produtos | `imphq_projects.briefing.produtos` | Oferta (principal, orderbump, upsell, downsell) |
| Fluxos OpenFlow | `imphq_flows` (project_id) | Automação WhatsApp |
| Campanhas WA | `imphq_wa_campaigns` | Broadcast / Sequência |
| Sequências de e-mail | `imphq_nurture_sequences` | Nurture |
| Sites/Páginas | `imphq_project_sites` + `imphq_sites` | Landing / VSL / Checkout |
| Anúncios | `imphq_ads_spend` (campanhas ativas) | Tráfego pago |
| Webhooks | `imphq_webhooks` ativos | Gatilho de venda |
| Capture forms | `imphq_capture_forms` | Captura de lead |

## Layout gerado (auto-organização)

Usa as faixas Y já estabelecidas (Aquisição 80 / Conversão 400 / Maximização 720 / Retenção 1040):

```text
[Ads]   [IG]   [Webinar]        ← y=80   Aquisição
   \     |      /
    [LP] [Captura]               ← y=240
       \   /
      [Checkout]→[OB]→[UP]→[DOWN] ← y=400 Conversão
           |
       [Webhook venda]
           |
   [WA boas-vindas] [Email seq]   ← y=720 Maximização
           |
       [Comunidade/Aluno]         ← y=1040 Retenção
```

Conexões curvas são geradas automaticamente seguindo a ordem lógica (tráfego → LP → checkout → pós-venda → retenção).

## Pré-vinculação

Ao criar cada nó, já aplica o que `LinkProductDialog` / `LinkFlowDialog` fariam manualmente:
- Nó de oferta → vinculado ao produto correspondente (preço + badge).
- Nó de automação → vinculado ao fluxo OpenFlow real (badge de execuções 24h).
- Nó de página → vinculado ao site (screenshot + auditoria).

## Técnico

- **Edge Function nova `funnel-autobuild`**: recebe `project_id`, varre as tabelas acima, monta JSON `{nodes, edges}` no formato do canvas atual, salva snapshot do estado anterior em `imphq_funnel_snapshots`, e devolve o blueprint.
- **Frontend**:
  - `src/components/funis/AutoBuildButton.tsx` (header).
  - `src/components/funis/AutoBuildPreviewDialog.tsx` (preview com checkboxes do que detectou).
  - Hook `useFunnelAutoBuild.ts` chamando a edge function.
  - Aplica no canvas via setter já existente do React Flow.
- **Sem mudanças de schema** — reutiliza tabelas existentes.

## Comportamento se já existe funil

- Detecta nós atuais e oferece 2 modos no modal:
  1. **Mesclar**: adiciona só o que falta, mantém o que já está posicionado.
  2. **Reconstruir**: snapshot + substitui tudo.
