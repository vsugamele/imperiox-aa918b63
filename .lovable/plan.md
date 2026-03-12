

# Plano: Guia de Webhook, Knowledge Base com Contexto IA, e Cron Jobs

## 1. Knowledge Base -- Reestruturar como na Imagem

A tabela `imphq_kb` ja existe com campos `section_key`, `title`, `content`, `order_idx`. Vamos transformar a pagina Docs em uma Knowledge Base completa no estilo da imagem (sidebar com secoes, editor markdown, contagem de palavras).

**Secoes pre-populadas** (seed na KB):
- A Empresa, Imperio OS -- Guia, Avatares Globais, Agentes & Squads, Frameworks de Copy, Frameworks de Lancamento, Frameworks de Trafego, SOPs Globais, Persona das IAs, Regras de Comunicacao, Objecoes & Respostas, Scripts de Venda, Historico de Aprendizados

**Interface**:
- Sidebar esquerda com lista de secoes (como na imagem)
- Editor principal com textarea markdown, botoes Resetar padrao / Salvar
- Icone + titulo + descricao + contagem de palavras no topo
- Auto-save com o hook existente `useAutoSave`
- Botao "Resetar padrao" carrega template padrao da secao

**Cada secao tera um template padrao** baseado no conteudo que o usuario enviou na mensagem (os textos completos de cada secao).

## 2. Contexto para IA -- Gerador Automatico

Criar uma funcao que monta o contexto completo para IA a partir dos dados do sistema:
- Puxa briefing do projeto selecionado
- Puxa avatar completo
- Puxa KB relevante (secoes selecionadas)
- Monta o bloco `[CONTEXTO DO SISTEMA]` formatado como o usuario enviou

**Na pagina Mentes IA**: Adicionar botao "Carregar Contexto" que monta o contexto automaticamente e injeta como system prompt antes da conversa. Select de projeto + checkboxes de secoes da KB.

**Na pagina Docs/KB**: Botao "Exportar Contexto" que gera o texto completo formatado para colar em qualquer IA externa.

## 3. Guia do Webhook -- Nova Secao em OpenFlow

Adicionar uma aba "Guia" no OpenFlow que explica visualmente:

```text
[Plataforma] → POST webhook URL → [Edge Function] → [Leads + Vendas + CAPI]
                                       ↓
                              Automacoes (Email/WA/TG)
```

- Passo a passo para Hotmart, Kiwify, Ticto
- URL copiavel por projeto
- Campos que sao extraidos automaticamente
- Como configurar na plataforma de pagamento
- Status dos webhooks recebidos (ja existe na pagina)

## 4. Cron Jobs -- Aba em Configuracoes

Adicionar aba "Cron Jobs" em `Configuracoes.tsx`:
- Interface para configurar tarefas agendadas
- Opcoes: Relatorio semanal, Limpeza de dados antigos, Verificacao de leads inativos
- Para cada cron, mostrar: nome, frequencia, ultimo run, status
- Integracao com `pg_cron` via SQL (instrucoes para o usuario ativar)
- Alternativa: botao manual "Executar agora" que chama edge function

## Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| `src/pages/Docs.tsx` | Reescrever como Knowledge Base com sidebar + editor |
| `src/pages/Mentes.tsx` | Adicionar gerador de contexto IA |
| `src/pages/OpenFlow.tsx` | Adicionar aba Guia do webhook |
| `src/pages/Configuracoes.tsx` | Adicionar aba Cron Jobs |
| `src/data/kbTemplates.ts` | Templates padrao para cada secao da KB |

Nenhuma migration necessaria -- usa tabela `imphq_kb` existente.

