

# Plano: Expandir tipos de elementos no Canvas de Funis

## Situação atual

O canvas de funis tem apenas 6 tipos de elementos: `criativo`, `pagina`, `vsl`, `checkout`, `upsell`, `outro`. Todos compartilham o mesmo layout de card com campos de métricas (visitas/conversões). Falta variedade visual para representar canais, mídias e elementos de texto.

## O que será feito

### 1. Expandir o catálogo de tipos de etapa

Adicionar novos tipos com cores e ícones distintos:

| Tipo | Label | Emoji | Cor |
|---|---|---|---|
| face_ads | Facebook Ads | 📢 | indigo |
| instagram | Instagram | 📸 | pink |
| tiktok | TikTok | 🎵 | cyan |
| linkedin | LinkedIn | 💼 | blue |
| blog | Blog/Artigo | 📝 | teal |
| video | Vídeo | 🎬 | purple |
| imagem | Imagem | 🖼️ | orange |
| email | Email | ✉️ | sky |
| whatsapp | WhatsApp | 💬 | emerald |
| caixa | Caixa (genérica) | 📦 | slate |
| texto | Caixa de Texto | 💭 | neutral |

### 2. Adaptar o card por tipo

- Tipos de **canal/mídia** (face_ads, instagram, tiktok, linkedin, blog): mostram o card padrão com métricas
- Tipo **texto**: card simplificado com área de texto maior (sem métricas de visitas/conversões), funciona como anotação/label no canvas
- Tipo **caixa**: card genérico para agrupar ou marcar seções

### 3. Toolbar de inserção rápida

Substituir o botão "Etapa" por uma barra ou dropdown com os tipos disponíveis agrupados:
- **Páginas**: Página, VSL, Checkout, Upsell
- **Canais**: Facebook Ads, Instagram, TikTok, LinkedIn, Blog
- **Mídia**: Vídeo, Imagem, Criativo
- **Comunicação**: Email, WhatsApp
- **Outros**: Caixa, Texto

Ao clicar num tipo, já cria o card com o tipo pré-selecionado no centro da viewport.

### 4. Melhorias gerais no canvas

- **Auto-save**: salvar automaticamente ao soltar card (drag end) em vez de só no botão "Salvar"
- **Minimap**: indicador visual pequeno no canto mostrando posição no canvas
- **Connector labels**: mostrar taxa de conversão entre etapas conectadas no meio do conector

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/Funis.tsx` | Expandir `TIPO_STYLES`, toolbar de inserção, card adaptativo por tipo, auto-save no drag, melhorias visuais |

