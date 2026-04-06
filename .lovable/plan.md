

# Plano: Melhorar Central de Conteudo IA

## Problemas encontrados

1. **Nenhum tipo de conteudo usa Skills** — a Central gera tudo com prompts inline hardcoded (linhas 54-61). Quando clica "Roteiro Webinario", ele **NAO** usa a skill `webinar-roteiro` que existe no catalogo.

2. **O backend nem recebe essas actions** — nao existe handler para `generate_semanal`, `generate_ads_imagem`, etc. no `openflow-ai`. O edge function provavelmente retorna erro ou cai no fallback generico.

3. **Sem seletor de modelo nem de Mente IA** — usa um unico call sem opcao de escolha.

4. **Sem streaming** — o usuario espera sem feedback visual ate a geracao completa terminar.

5. **Conteudos salvos ficam em `project.data.central_conteudos`** (JSON blob), nao em tabela separada — limita busca e organizacao.

---

## Mudancas

### 1. Conectar tipos de conteudo a Skills existentes

Mapear cada `ContentType` para um `skill_slug` quando a skill existir:

| Tipo | Skill existente | Action |
|---|---|---|
| semanal | — | `generate_content` (handler novo) |
| ads_imagem | `devastador` | `execute_skill` |
| ads_video | `devastador` | `execute_skill` |
| vsl | `lp-persuasiva` | `execute_skill` |
| webinar | `webinar-roteiro` | `execute_skill` |
| lp | `lp-persuasiva` | `execute_skill` |

Quando ha skill, enviar `action: "execute_skill"` + `skill_slug` + contexto do projeto. O prompt inline vira apenas `user_input` complementar. Quando nao ha skill (semanal), criar um handler simples no backend.

### 2. Adicionar seletor de modelo + Mente IA

Reutilizar a logica do `AIGenerateButton` (dialog com Select de modelo + Mente) diretamente no componente, ou substituir o botao "Gerar com IA" por um `AIGenerateButton` customizado.

Abordagem: adicionar um mini-dialog pre-geracao (igual ao AIGenerateButton) com:
- Select de modelo (MODELS do AIGenerateButton)
- Select de Mente IA (MENTES_DATA)
- Enviar `model`, `mente_id` no payload

### 3. Criar handler `generate_content` no backend

Para o tipo "semanal" que nao tem skill dedicada, adicionar um case no `openflow-ai`:
```
if (action === "generate_content") return await handleContent(body, projectContext, ...);
```

### 4. Melhorar UX

- Mostrar qual skill sera usada em cada card (badge "Skill: Webinar Roteiro")
- Adicionar indicador de progresso durante geracao
- Manter o preview de LP com iframe

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/projeto/ProjetoCentralConteudo.tsx` | Mapear tipos a skills, adicionar seletor modelo/mente, usar `execute_skill` para tipos com skill |
| `supabase/functions/openflow-ai/index.ts` | Adicionar handler `generate_content` para conteudo semanal |

## Ordem

1. Atualizar `ProjetoCentralConteudo.tsx` com skill mapping + seletores
2. Adicionar handler `generate_content` no backend
3. Deploy edge function

