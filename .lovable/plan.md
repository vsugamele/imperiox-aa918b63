

# Plano: Arsenal de Copy por Produto

## O que faltou do plano anterior

Tudo do plano anterior foi implementado: ofertas nos produtos, pipeline inline no briefing, checklist de integração, e pesquisa com Firecrawl. Nada pendente.

---

## Nova feature: Campos de Copy Persuasiva por Produto

Adicionar uma seção colapsável "Arsenal de Copy" dentro de cada produto no Briefing, com os 6 blocos de persuasão que você descreveu. Tudo salvo no JSONB do produto (sem migration).

### Estrutura por produto

Cada produto ganha um campo `copy_arsenal` no JSONB com estas seções:

| Bloco | Campo | Tipo |
|---|---|---|
| **Promessa** | `promessa` | textarea — "Desejo + tempo + dor + objeção principal" |
| **Inimigo Comum** | `inimigo_comum` | textarea — "A culpa é do sistema, não do lead" |
| **Efeito Colateral** | `efeito_colateral` | textarea — "Risco de continuar + nome do ciclo" |
| **Oportunidade Escancarada** | `oportunidade` | textarea — "Mecanismo único + prova social + caso real" |
| **Método Simplificado** | `metodo_simplificado` | textarea — "Mostrar que é mais simples do que imagina" |
| **Hora do Show** | `hora_do_show` | textarea — "3 pilares + conteúdo que prova a promessa" |

### UI

- Botão "✍️ Arsenal de Copy" dentro de cada produto, abre seção colapsável
- 6 cards organizados em grid 1-2 colunas, cada um com título, descrição curta do propósito e textarea
- Cada textarea salva no `produtos[i].copy_arsenal.{campo}`
- Visual compacto, labels com emoji e descrição do que preencher

### Arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Adicionar seção "Arsenal de Copy" colapsável dentro de cada produto, com os 6 campos de persuasão |

