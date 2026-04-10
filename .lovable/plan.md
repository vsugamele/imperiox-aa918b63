

# Plano: Adicionar SectionInfo (ℹ️) em Todas as Páginas

## Situação atual
- O componente `SectionInfo` existe e funciona (popover com título, descrição e dica de uso)
- Os textos de ajuda já estão definidos em `sectionHelpTexts.ts` para todas as seções
- Só está implementado em **Configurações** — todas as outras páginas estão sem

## Mudanças

Adicionar `<SectionInfo {...sectionHelpTexts.xxx} />` ao lado do título principal de cada página e sub-seção:

| Página / Componente | Help Key |
|---|---|
| `Dashboard.tsx` | `dashboard` |
| `KanbanPage.tsx` | `kanban` |
| `Leads.tsx` | `leads` |
| `Financas.tsx` | `financas` |
| `Mentes.tsx` | `mentes` |
| `Skills.tsx` | `skills` |
| `OpenFlow.tsx` | `openflow` |
| `Docs.tsx` | `docs` |
| `WhatsAppPage.tsx` | `whatsapp` |
| `Tracker.tsx` | `tracker` |
| `Equipe.tsx` | `equipe` |
| `Referencias.tsx` | `referencias` |
| `Cofre.tsx` | `cofre` |
| `ProjetoDetalhe.tsx` (sub-seções) | `projeto_briefing`, `projeto_avatar`, `projeto_expert`, etc. |
| `CampaignManager.tsx` | Adicionar nova entry `campanhas_whatsapp` ao `sectionHelpTexts.ts` |

Também adicionar textos de ajuda novos para seções que ainda não têm (Campanhas WhatsApp, Templates, Hub).

## Arquivos afetados
- `src/data/sectionHelpTexts.ts` — adicionar entries novas (campanhas, templates, hub)
- ~15 páginas em `src/pages/` — importar `SectionInfo` + `sectionHelpTexts` e adicionar ao lado do título
- `src/components/whatsapp/CampaignManager.tsx` — adicionar info na seção de campanhas

## Resultado
Todas as seções do sistema terão o ícone ℹ️ com explicação contextual, facilitando onboarding e uso.

