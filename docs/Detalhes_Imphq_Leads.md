# Deep Dive: Ecossistema de CRM e Leads (`imphq_leads`)

A tabela principal de CRM no Imperio HQ é a **`imphq_leads`**. Sabendo que a gestão de contatos é crucial, o sistema não apenas armazena os dados do lead, mas constrói uma **Jornada do Cliente** completa conectando-o com eventos de rastreamento, cliques e vendas.

## Estrutura da tabela `imphq_leads`

Listagem das principais colunas e suas funções (inferidas a partir do código-fonte da aplicação):

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID | Identificador único do lead. |
| `project_id` | UUID | Relaciona o lead a um projeto (`imphq_projects`). Permite isolar os leads por produto ou nicho. |
| `nome` | String | Nome completo ou primeiro nome do lead. |
| `email` | String | E-mail de contato, usado como chave primária de identificação em vários cruzamentos (ex: cliques e rastreamento). |
| `phone` | String | Telefone/WhatsApp. Usado para a funcionalidade de "Contato Rápido" via `imphq_wa_conversations`. |
| `plataforma` | String | Origem inicial cadastrada (Manual, Meta, Google, TikTok, Hotmart, Kiwify, Ticto, Orgânico, Indicação). |
| `status` | String | Estágio do funil: `lead`, `cliente`, `vip`, `inativo`, `cancelado`, `chargeback`. Atualizado automaticamente pelo `webhook-pagamento` quando há reembolso ou contestação. |
| `score` | Integer | Pontuação de engajamento (*Lead Scoring*). Leads que abrem mais emails ou clicam mais sobem o score de 0 a 100. |
| `tags` | Array[String] | Etiquetas customizáveis (ex: "abandono_carrinho", "evento_x"). |
| `total_gasto` | Numeric | LTV (Lifetime Value). Soma em Reais `R$` do quanto aquele lead já converteu. |
| `data` | JSONB | Campo genérico que guarda payload e metadados. Um dado muito importante armazenado aqui é o `visitor_id` (cookie de navegação) e as `utms` da captura original. |
| `criado_em` | Data/Hora | Data em que o lead entrou na base. |

---

## A "Jornada do Cliente" (Timeline)

O diferencial da página de Leads (`/leads`) é a aba **Jornada**. Ela constrói uma linha do tempo unificando dados de **três tabelas auxiliares**, garantindo visibilidade total do funil:

### 1. Cliques (`imphq_clicks`)
Armazena a intenção de tráfego. Quando o e-mail do lead bate com o e-mail registrado na captura, o sistema puxa todos os links que esse lead clicou.  
* **Dados mapeados:** `utm_source`, `utm_campaign`, `page_url`.

### 2. Navegação e Interação (`imphq_events`)
Através do script de tracking (`imptrack.js`), o sistema assinala um `visitor_id` no navegador. Esse ID é atrelado ao Lead em `data -> visitor_id`.  
* **Eventos mapeados:** `PageView` (Página Vista), `LeadCapture` (Captura), `ViewContent` (Interação), `AddToCart` (Carrinho), `ButtonClick` (Ações genéricas).

### 3. Conversões (`imphq_vendas`)
Sempre que um webhook de plataforma (Hotmart, Kiwify) processa uma venda, ela cai nesta tabela vinculada pelo `lead_id` ou pelo `email`.  
* **Dados mapeados:** `produto`, `valor`, `status` (Aprovada, Pendente, Recusada), `plataforma`. O valor total de compras aprovadas aqui alimenta o campo `total_gasto` do Lead.

> [!NOTE]
> Essa arquitetura (Events → Clicks → Leads → Vendas) é o núcleo do **Tracking Próprio** do império. Ela substitui a dependência do pixel do Facebook ou Analytics, dando clareza exata de qual campanha e qual anúncio converteu.
