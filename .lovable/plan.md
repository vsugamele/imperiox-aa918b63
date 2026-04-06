

# Plano: Salvar Respostas de Formulario + Identificar Origem + Analise IA

## Problemas Identificados

1. **Respostas nao aparecem**: O `capture-lead` so salva em `imphq_lead_responses` campos que NAO sao "standard" (email, name, phone, etc). Se o formulario so tem esses campos, nada e salvo como resposta — so o lead em si.

2. **Formulario de origem nao fica claro**: O lead salva `plataforma: "formulario"` mas nao guarda qual formulario especifico. O `form_id` so e usado para lookup temporario, nao fica persistido no lead.

3. **Sem analise IA**: Nao existe botao para interpretar os dados brutos do lead.

---

## Mudanca 1: Persistir `form_id` e `form_name` no lead

No `capture-lead/index.ts`, ao processar o formulario, salvar no `data` do lead:

```typescript
// No insert/update do lead, adicionar ao data:
data: {
  ...existingData,
  form_id: body.form_id,
  form_name: formConfig?.nome || formConfig?.name,
  captura_form_step: step,
}
```

Isso permite mostrar "Veio do formulario X" no painel do lead.

## Mudanca 2: Salvar campos standard tambem como respostas

Atualmente a lista `standardKeys` exclui email, name, phone. Mudar para salvar TODOS os campos do body como respostas (exceto apenas `form_id`, `redirect_url`, `page_url` e UTMs), garantindo que as respostas do formulario aparecem na aba Qualificacao mesmo que sejam campos basicos.

## Mudanca 3: Mostrar origem do formulario no painel do lead

Na aba Qualificacao do `Leads.tsx`, antes das respostas, exibir uma secao "Origem da Captura" mostrando:
- Nome do formulario (de `data.form_name`)
- Step/etapa (de `data.captura_form_step`)
- Data da captura
- Badge visual identificando o form

## Mudanca 4: Botao "Analisar com IA" na aba Qualificacao

Adicionar um `AIGenerateButton` na aba Qualificacao que envia todas as respostas do lead + historico de interacoes para a IA gerar:
- Perfil comportamental do lead
- Nivel de consciencia sugerido
- Objecoes provaveis
- Recomendacao de abordagem

O resultado preenche automaticamente os campos manuais (dor, nivel consciencia, etc).

## Mudanca 5: KPIs de comportamento por projeto (futuro, preparacao)

No `data` do lead, ja acumulamos `interacoes` e `capturado_em`. Com a venda registrada, podemos calcular:
- **Tempo ate compra**: diferenca entre `capturado_em` e primeira venda
- Isso sera exibido inline no painel do lead como badge informativo

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/capture-lead/index.ts` | Persistir `form_id`/`form_name` no lead.data + salvar campos standard como respostas |
| `src/pages/Leads.tsx` | Secao "Origem da Captura" + AIGenerateButton na Qualificacao + badge "Tempo ate compra" |

## Ordem

1. Atualizar `capture-lead` (persistir form_id + salvar todos campos)
2. Deploy edge function
3. Atualizar UI do painel de Qualificacao (origem + IA + tempo)

