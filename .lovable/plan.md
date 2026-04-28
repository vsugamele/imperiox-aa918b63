## Status atual (já implementado)

Boa notícia — quase tudo já está pronto no projeto:

- `OPENAI_API_KEY` já configurado nos secrets
- `creative-factory` já tem `generateImageOpenAI()`, mapeamento de tamanhos (1024x1024 / 1024x1536 / 1536x1024), tipo `ImageProvider` e roteamento via `briefing.image_provider`
- `CriativoNovo.tsx` já tem o `Select` com "Gemini Nano Banana" vs "OpenAI gpt-image-1" e envia `image_provider`

## O que falta para fechar a Opção B

### 1. Edição de asset (`edit_asset`) respeitar o provider

Hoje, quando você edita um criativo já gerado pelo OpenAI, o backend força edição via Gemini (`gemini-3.1-flash-image-preview`). Vou:

- Persistir o `provider` usado em cada asset (coluna nova `image_provider` em `imphq_creative_assets`, default `'lovable-gemini'`)
- Ler esse provider no `action: edit_asset` e rotear:
  - `lovable-gemini` → fluxo atual de edição multimodal (com referência da imagem original)
  - `openai-image` → chamar `https://api.openai.com/v1/images/edits` com a imagem original (baixada do storage) + máscara opcional + instrução
- Salvar o `image_provider` ao inserir cada asset gerado dentro de `processBatch`

### 2. Selo visual do motor no Criativo

Em `CriativoDetalhe.tsx`, mostrar um badge discreto ("Gemini" / "OpenAI gpt-image-1") ao lado de cada variação, pra você saber rapidamente qual motor gerou o quê — útil pra comparar qualidade lado a lado.

### 3. Toggle do provider TAMBÉM no momento de editar

No painel de edição do `CriativoDetalhe.tsx`, adicionar um pequeno seletor "Editar com: [Gemini] [OpenAI]" que sobrescreve o provider padrão do asset. Default = provider original do asset.

### 4. Tratamento de erro amigável

Se `OPENAI_API_KEY` faltar ou a OpenAI retornar erro (quota, billing, conteúdo bloqueado), retornar mensagem clara via toast: "OpenAI gpt-image-1 indisponível: {motivo}. Tente Gemini ou verifique sua chave."

## Detalhes técnicos

**Migration**:
```sql
ALTER TABLE public.imphq_creative_assets 
  ADD COLUMN IF NOT EXISTS image_provider TEXT DEFAULT 'lovable-gemini';
```

**Edge function `creative-factory`**:
- Nova função `generateImageOpenAIEdit(imageBytes, prompt, formato)` → `POST https://api.openai.com/v1/images/edits` com `model=gpt-image-1`, `image` (multipart), `prompt`
- `processBatch`: ao inserir asset, gravar `image_provider: provider`
- `edit_asset`: ler `asset.image_provider` (ou `body.image_provider` se enviado), baixar a imagem do storage quando precisar de bytes, e despachar pro motor correto

**Frontend (`CriativoDetalhe.tsx`)**:
- Badge `<Badge variant="outline">{asset.image_provider === 'openai-image' ? 'OpenAI' : 'Gemini'}</Badge>`
- Select compacto no dialog de edição

**Custos visíveis**: incluir uma nota no select do `CriativoNovo.tsx` esclarecendo que OpenAI cobra ~$0.04–0.19 por imagem direto na conta da OpenAI (fora do billing Lovable), pra evitar surpresa.

## Fora do escopo

- Não vou adicionar suporte a `gpt-image-2` (ainda não lançado pela OpenAI até abril/2026)
- Não vou alterar o `openflow-ai` nem o `creative-factory`'s headline generator (continuam Gemini)
- Não vou criar uma edge function separada `openai-image` — a lógica fica encapsulada dentro do `creative-factory` pra reaproveitar storage/auth/RLS