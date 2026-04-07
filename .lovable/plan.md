

# Plano: Salvar Template do FlowEditor + Confirmar Contexto IA

## Situacao atual

1. **Templates ja existem** — tabela `imphq_wa_templates` com campos `name`, `content`, `category`, `project_id`. Sao gerenciados na pagina WhatsApp e ja aparecem no FlowEditor via "Usar Template".
2. **IA ja puxa contexto completo** — o `openflow-ai` busca Briefing, Expert, Produtos, Avatar (dores, desejos, problemas, voyerismos, gatilhos), Brand Kit, vendas, leads e custos antes de gerar. Isso ja funciona.
3. **Falta**: poder salvar o texto escrito numa acao do flow como template reutilizavel, sem precisar ir na pagina WhatsApp.

---

## Mudancas

### 1. Botao "Salvar como Template" no FlowEditor

No painel expandido de cada acao (email/whatsapp/telegram), quando houver texto no campo `template`, adicionar um botao "💾 Salvar Template" abaixo do Textarea.

Ao clicar:
- Insere na `imphq_wa_templates` com `name` = primeiras palavras do texto, `content` = texto completo, `project_id` = projeto da automacao, `category` = tipo da acao (email/whatsapp/telegram)
- Toast de confirmacao
- Template fica disponivel imediatamente no dropdown "Usar Template"

### 2. Passar `produto` no contexto da geracao IA

O `generateWithAI` no OpenFlow.tsx ja envia `project_id` e `trigger_tipo`. Adicionar tambem `produto` para que a IA gere copys especificas para aquele produto (o edge function ja recebe `produtos` do projeto mas nao sabe qual e o foco).

No `openflow-ai/index.ts`, no prompt do sistema, adicionar: "O produto em foco é: {produto}" quando informado.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/openflow/FlowEditor.tsx` | Botao "Salvar Template" no painel expandido + prop `projectId` |
| `src/pages/OpenFlow.tsx` | Passar `projectId` ao FlowEditor + enviar `produto` no `generateWithAI` |
| `supabase/functions/openflow-ai/index.ts` | Incluir `produto` no prompt quando informado |

## Ordem

1. FlowEditor (botao salvar template)
2. OpenFlow (passar projectId + produto na geracao)
3. Edge function (produto no prompt)

