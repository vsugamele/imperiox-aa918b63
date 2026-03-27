

# Plano: Melhorias em Integrações, IA no Arsenal/Branding/Gatilhos, e Links

## 5 frentes

---

### 1. Setup de Integração -- Links diretos para os sites

Cada card de integração no Briefing ganha um botão/link externo para o site da plataforma, facilitando acesso rápido para copiar IDs e tokens.

| Integração | Link |
|---|---|
| Clarity | `https://clarity.microsoft.com` |
| Google Analytics | `https://analytics.google.com` |
| Facebook Pixel | `https://business.facebook.com/events_manager2` |
| Resend | `https://resend.com/api-keys` |
| Webhook | Sem link externo (URL local) |
| UTMs | Sem link externo |

Adicionar um `<a>` com ícone `ExternalLink` ao lado do título de cada card. Quando os campos estão preenchidos, o link leva direto ao dashboard (ex: Clarity com o ID no path).

Tambem garantir que os valores dos campos de API (IDs, tokens) ficam visíveis por padrão (não mais `type="password"`) com um botão toggle para mostrar/ocultar os secrets.

---

### 2. Arsenal de Copy -- Botão "Gerar com IA"

Adicionar um botão "🤖 Gerar com IA" no `CopyArsenalSection` que:
- Chama a edge function `openflow-ai` (já existente e conectada ao Lovable AI Gateway)
- Envia como contexto: avatar, branding, concorrentes e produtos do projeto
- Pede para a IA preencher os 6 blocos de copy (Promessa, Inimigo Comum, Efeito Colateral, Oportunidade, Método Simplificado, Hora do Show)
- Preenche automaticamente os campos vazios com o resultado
- Loading state no botão durante a geração

O `CopyArsenalSection` precisa receber `projectId` como prop para buscar os dados do projeto.

---

### 3. Branding e Gatilhos -- Botão "Completar com IA"

**Branding** (`ProjetoBranding.tsx`):
- Botão "🤖 Completar com IA" no topo
- Chama `openflow-ai` com contexto do projeto (avatar, expert, produtos, concorrentes)
- Preenche campos vazios: arquétipo sugerido, posicionamento, manifesto, linguagem

**Gatilhos** (`GatilhosTab.tsx`):
- Botão "🤖 Gerar Gatilhos com IA" no card de Gatilhos Emocionais
- Analisa avatar (dores, desejos, problemas, voyerismos) + branding + concorrentes
- Gera gatilhos emocionais sugeridos e preenche o storyboard narrativo

Ambos usam a mesma edge function `openflow-ai` com um novo campo `action` no payload para diferenciar o tipo de geração.

---

### 4. Links do Projeto -- Botões rápidos de redes sociais + Mover para Briefing

A aba "Links" é redundante como aba separada. Solução:

- **Mover os links para dentro do Briefing** como uma seção colapsável "🔗 Links & Redes Sociais"
- Adicionar **botões rápidos** para redes comuns: YouTube, TikTok, Pinterest, Instagram, Facebook, Twitter/X, LinkedIn, Site, Blog
- Cada botão rápido cria um link pré-rotulado, o usuário só precisa colar a URL
- Manter o "Adicionar custom" para links genéricos
- **Remover a aba "Links"** do `ProjetoDetalhe.tsx`

---

### 5. Edge Function -- Novo action para geração de conteúdo

Expandir `openflow-ai` para aceitar um campo `action` no body:

| action | Contexto enviado | Output esperado |
|---|---|---|
| `generate_copy_arsenal` | avatar + branding + concorrentes + produtos | 6 blocos de copy preenchidos |
| `generate_branding` | avatar + expert + produtos + concorrentes | arquétipo, posicionamento, manifesto, linguagem |
| `generate_gatilhos` | avatar (dores, desejos, problemas) + branding | gatilhos emocionais + storyboard |
| (default/existente) | projeto completo | sequência de automação |

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoBriefing.tsx` | Links externos nos cards de integração, toggle de visibilidade de secrets, seção "Links & Redes Sociais" inline |
| `src/components/projeto/CopyArsenalSection.tsx` | Receber `projectId`, botão "Gerar com IA" |
| `src/components/projeto/ProjetoBranding.tsx` | Botão "Completar com IA" no topo |
| `src/components/projeto/avatar/GatilhosTab.tsx` | Botão "Gerar Gatilhos com IA" |
| `src/pages/ProjetoDetalhe.tsx` | Remover aba "Links", passar `projectId` ao CopyArsenalSection |
| `supabase/functions/openflow-ai/index.ts` | Novo campo `action` com prompts específicos para copy, branding e gatilhos |
| `src/components/projeto/ProjetoLinks.tsx` | Deletar (funcionalidade movida para Briefing) |

