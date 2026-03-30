

# Diagnóstico: O que precisamos melhorar no Imperio HQ

Após analisar todos os módulos, identifiquei melhorias organizadas por prioridade.

---

## PRIORIDADE ALTA — Problemas que afetam uso diário

### 1. Dashboard precisa de mais inteligência
- Hoje mostra KPIs básicos (projetos, tarefas, leads, custo mensal) mas falta:
  - Gráfico de tendência de leads nos últimos 30 dias
  - Funil de conversão consolidado (Lead → Pix → Compra)
  - Alertas inteligentes ("3 leads geraram pix hoje e não compraram", "Campanha X com CTR abaixo de 1%")
  - Widget de receita vs custo por período
  - Resumo de automações executadas

### 2. Notificações em tempo real (global)
- Não existe sistema de notificações na plataforma
- O sino de notificações não aparece na sidebar/header
- Deveria notificar: nova venda, lead gerou pix, tarefa atrasada, automação executada, novo lead capturado
- Push via browser notification API + badge na sidebar

### 3. Chat ainda com limitações
- Não mostra nome do usuário nas mensagens (só user_id)
- Falta busca de mensagens
- Não tem reações/emojis
- Não suporta anexos/imagens

### 4. Busca Global (GlobalSearch) precisa ser mais útil
- Deveria buscar em: projetos, leads, tarefas, docs, mensagens do chat
- Atalho Cmd+K para abrir

---

## PRIORIDADE MÉDIA — Funcionalidades incompletas

### 5. Funis precisa conectar com dados reais
- O editor visual de funis é bom, mas visitantes e conversões são preenchidos manualmente
- Deveria puxar dados de `imphq_events` (PageView, AddToCart) automaticamente por URL/etapa
- Calcular taxa de conversão entre etapas em tempo real

### 6. WhatsApp precisa de mais automação
- Hoje tem envio em massa e chat básico
- Falta: templates de mensagem salvos, agendamento de envios, respostas automáticas baseadas em keywords
- Integrar com OpenFlow (trigger "mensagem_recebida")

### 7. Mentes IA — contexto do projeto não é carregado automaticamente
- Quando o usuário abre uma Mente IA, deveria poder selecionar o projeto e carregar o contexto completo (briefing, avatar, concorrentes) automaticamente no prompt
- Hoje o usuário precisa copiar/colar manualmente

### 8. OpenFlow — falta execução real das automações
- As automações são criadas visualmente mas não executam automaticamente
- Precisaria de um "motor" que observa triggers (novo_lead, pix_gerado) e executa os steps
- Pelo menos mostrar um log de execuções simuladas

### 9. Financas — faltam gráficos comparativos
- Não tem gráfico de Receita vs Custo ao longo do tempo
- Falta comparativo mês a mês
- Projeção de receita baseada em tendência

---

## PRIORIDADE BAIXA — Polish e UX

### 10. Mobile/Responsivo
- A sidebar em mobile pode ter problemas
- Tabelas grandes (Leads, Finanças) não são responsivas
- Modais podem estourar em telas pequenas

### 11. Onboarding para novos usuários
- Não tem wizard de primeiro acesso
- Poderia ter um tour guiado mostrando os módulos principais
- Checklist de setup inicial (criar projeto → preencher briefing → configurar integrações)

### 12. Cofre de senhas — criptografia
- As senhas no Cofre são armazenadas no Supabase mas não há criptografia client-side
- Deveria ter criptografia AES antes de salvar

### 13. Docs/KB — editor mais rico
- O editor de documentos é básico (textarea)
- Poderia ter Markdown com preview ou editor WYSIWYG
- Falta organização por pastas/categorias

### 14. Equipe — permissões por módulo
- Hoje todos os membros veem tudo
- Falta sistema de permissões (admin, editor, viewer) por módulo

### 15. Referências — organização
- Falta categorização (por projeto, por tipo: landing page, email, criativo)
- Falta anotações nas referências

---

## Sugestão de próximos passos (por impacto)

| # | Melhoria | Impacto | Esforço |
|---|---|---|---|
| 1 | Dashboard inteligente com alertas e gráficos | Alto | Médio |
| 2 | Sistema de notificações global | Alto | Médio |
| 3 | Chat — nome do usuário + busca | Médio | Baixo |
| 4 | Funis conectados com dados reais | Alto | Alto |
| 5 | Mentes IA com contexto automático | Alto | Médio |
| 6 | Mobile/responsivo | Médio | Médio |
| 7 | Onboarding/wizard | Médio | Médio |

Qual dessas frentes você quer atacar primeiro?

