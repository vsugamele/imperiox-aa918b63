

# Plano: Calendario Geral + Email Resend por Projeto + Melhorias CRM

## 3 frentes

---

### 1. Calendario Geral (cross-projeto)

Hoje os eventos existem apenas dentro de cada projeto (`ProjetoCalendario`). Falta uma visao consolidada.

**Decisao**: Colocar na pagina **Tarefas** como nova aba "Calendario", ao lado de "Rotinas do Dia" e "Tarefas". Faz sentido porque Tarefas ja e o hub de organizacao diaria.

| Componente | Descricao |
|---|---|
| Nova aba "Calendario" em `Tarefas.tsx` | Carrega todos os eventos de `imphq_calendar_events` (todos os projetos) com join em `imphq_projects(name, icon, color)` |
| Calendario mensal | Reutiliza `Calendar` com modifiers para dias com evento |
| Lista de eventos do dia selecionado | Cards agrupados por projeto, com badge colorido do projeto e tipo do evento |
| Filtros | Por projeto (dropdown) e por tipo de evento (badges toggle) |
| Criar evento rapido | Botao "+ Evento" abre dialog, com seletor de projeto incluso |

Nao precisa de migration -- usa a tabela `imphq_calendar_events` existente.

---

### 2. Resend API por Projeto (Email Config)

Cada projeto precisa de sua propria API key do Resend + dominio + templates de email. Isso sera gerenciado no JSONB `data` do projeto (sem migration).

**Estrutura no `data` do projeto:**
```json
{
  "email_config": {
    "resend_api_key": "re_xxx...",
    "from_email": "contato@projeto.com",
    "from_name": "JP Freitas",
    "reply_to": "suporte@projeto.com",
    "templates": [
      { "id": "uuid", "name": "Boas-vindas", "subject": "Bem-vindo!", "html_body": "<h1>..." }
    ]
  }
}
```

**UI**: Nova aba "✉️ Emails" no `ProjetoDetalhe.tsx`:
- Card de configuracao: campos para API Key Resend (masked), From Email, From Name, Reply-To
- Secao de templates: lista de templates com nome, assunto, editor HTML simples (textarea)
- CRUD de templates (add, edit, delete)
- Botao "Enviar teste" que chama uma edge function `send-project-email` passando project_id + template_id + email destino
- Edge function busca a config do projeto no banco e usa a Resend API com a key daquele projeto

| Arquivo | Acao |
|---|---|
| `src/components/projeto/ProjetoEmails.tsx` | **Novo**: UI de config Resend + templates |
| `src/pages/ProjetoDetalhe.tsx` | Adicionar aba "Emails" |
| `supabase/functions/send-project-email/index.ts` | **Novo**: envia email via Resend usando config do projeto |

---

### 3. Melhorias no CRM (Leads)

Analisando o CRM atual, identifico estas oportunidades:

| Melhoria | Descricao |
|---|---|
| **Lead Score automatico** | Calcular score baseado em acoes: tem email (+10), tem compra (+30), tem UTM (+5), multiplas compras (+20). Exibir como barra de progresso no card do lead |
| **Coluna "Produto"** | Adicionar coluna na tabela de leads mostrando o(s) produto(s) comprado(s) -- join com `imphq_vendas` |
| **Coluna "Metodo Pgto"** | Mostrar Pix/Cartao/Boleto inline na tabela |
| **Filtro "Pendentes"** | Botao rapido que filtra `carrinho_abandonado` + `pix_gerado` + `aguardando_pagamento` de uma vez |
| **Tags rapidas** | Na tabela, mostrar as primeiras 2 tags como mini-badges |
| **Notas no lead** | Na ficha do lead (dialog de edicao), adicionar campo de notas/observacoes (textarea salvo em `data.notas`) |
| **UTMs visiveis** | Mostrar utm_source/utm_medium como badges na ficha do lead, quando existirem |

---

## Arquivos alterados

| Arquivo | Acao |
|---|---|
| `src/pages/Tarefas.tsx` | Nova aba "Calendario" com visao geral cross-projeto |
| `src/components/projeto/ProjetoEmails.tsx` | **Novo**: config Resend + templates por projeto |
| `src/pages/ProjetoDetalhe.tsx` | Adicionar aba "Emails" |
| `supabase/functions/send-project-email/index.ts` | **Novo**: edge function para envio de email via Resend |
| `src/pages/Leads.tsx` | Colunas produto/pgto, lead score, filtro pendentes, tags inline, notas, UTMs |

