

# Plano: CRM Avançado — Gráficos, Pix Hoje, Ações Rápidas e Conexão com OpenFlow

## Situação atual

- A página de Leads tem KPI cards, filtros por projeto/produto/estágio, tabela com dados ricos e timeline de jornada.
- OpenFlow tem automações com triggers (carrinho_abandonado, compra_aprovada, lead_novo, reembolso) mas NÃO está conectado à tela de Leads — não dá para disparar uma automação a partir de um lead ou ver se alguma automação já rodou para ele.
- Não existem gráficos no CRM. Tudo é numérico.
- Não existe visão "Pix gerado hoje" com ações rápidas (enviar email, WhatsApp, disparar automação).

---

## O que implementar (4 blocos)

### 1. Gráficos no CRM

Adicionar uma nova aba **"📊 Analytics"** na página de Leads (ao lado da listagem atual) com:

- **Leads por projeto** — gráfico de barras horizontal mostrando quantidade por projeto (usando dados já carregados)
- **Leads por mês** — gráfico de linha com evolução mensal baseado em `criado_em`
- **Funil de conversão** — gráfico de barras empilhado mostrando lead → carrinho → pix → cliente
- **Receita por projeto** — barras mostrando `total_gasto` agregado por projeto

Usar Recharts (já está no projeto via shadcn charts).

### 2. Painel "Pix Hoje" com ações rápidas

Adicionar um card expandido quando o filtro de estágio é "pix_gerado" ou criar uma **seção fixa** no topo quando existem leads com pix pendente de hoje:

- Listar leads que geraram pix **hoje** (filtro por `criado_em` ou `data.ultimo_evento_data` no dia atual)
- Cada lead mostra: nome, email, telefone, produto, valor, hora que gerou o pix
- **Botões de ação rápida** para cada lead:
  - 📧 **Enviar Email** — abre dialog com templates do projeto (conecta com `send-project-email`)
  - 💬 **WhatsApp** — abre dialog para enviar mensagem via `whatsapp-api`
  - ⚡ **Disparar Automação** — dropdown com automações do OpenFlow que podem ser executadas manualmente
- Indicador visual de quais ações já foram executadas (checa `imphq_activity_log` ou registra no JSONB do lead)

### 3. Conexão Leads ↔ OpenFlow

- No detalhe do lead (dialog de edição), adicionar aba **"⚡ Automações"** mostrando:
  - Quais automações rodaram para este lead (buscar em `imphq_activity_log` pelo `lead_id`)
  - Botão "Disparar automação" — seleciona uma automação e executa as ações para este lead específico
- No OpenFlow, nos cards de automação, mostrar **contador de leads impactados** (quantos passaram por aquela automação)

### 4. Produtos dentro dos projetos

Na sidebar de leads, os produtos que aparecem hoje são globais. Ajustar para:
- Quando um projeto está selecionado, mostrar apenas os produtos daquele projeto
- O produto no filtro lateral fica agrupado abaixo do projeto selecionado
- Contagem de leads por produto

---

## Detalhes técnicos

### Migration necessária
Adicionar coluna `lead_id` na `imphq_activity_log` (se não existir) para registrar ações executadas em leads específicos:
```sql
ALTER TABLE imphq_activity_log ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES imphq_leads(id) ON DELETE SET NULL;
```

### Recharts
Já disponível via `@/components/ui/chart`. Usar `BarChart`, `LineChart`, `ResponsiveContainer`.

### Disparo manual de automação
Criar uma função client-side que percorre as ações da automação e executa cada uma:
- `email` → chama `send-project-email`
- `whatsapp` → chama `whatsapp-api?action=send_message`
- `aguardar` → pula (não faz sentido em manual)

Cada execução registra em `imphq_activity_log` com `action: "automacao_executada"`, `entity_type: "lead"`, `entity_id: lead_id`.

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar `lead_id` na `imphq_activity_log` |
| `src/pages/Leads.tsx` | Adicionar aba Analytics com gráficos, seção Pix Hoje com ações rápidas, aba Automações no detalhe, produtos filtrados por projeto |

