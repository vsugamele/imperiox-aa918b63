

# Plano: Fix Upload Múltiplo + Passo a Passo Token CAPI

---

## 1. Bug: Upload múltiplo só salva 1 arquivo

**Causa raiz**: `FileUpload.tsx` chama `onUpload(url)` uma vez por arquivo no loop. No Expert, `addFoto` lê `fotos` do closure atual (stale). Ao subir 3 fotos, as 3 chamadas leem o MESMO array original, e cada PATCH sobrescreve o anterior. Resultado: só a última foto aparece.

Mesmo problema acontece em `ProjetoMidia.tsx` com `addImage`.

**Solução**: Adicionar prop `onUploadMultiple?: (urls: string[]) => void` no `FileUpload`. Quando `multiple=true` e `onUploadMultiple` existe, coletar todas as URLs e chamar uma única vez no final. Fallback para `onUpload` individual se `onUploadMultiple` não for fornecido.

**Arquivos**:
- `src/components/FileUpload.tsx` — adicionar `onUploadMultiple` prop, coletar URLs em array, chamar no final
- `src/components/projeto/ProjetoExpert.tsx` — trocar `onUpload` por `onUploadMultiple` que faz `setFotos([...fotos, ...newUrls])` de uma vez
- `src/components/projeto/ProjetoMidia.tsx` — mesma correção para `addImage` em batch

---

## 2. Passo a passo do Access Token CAPI salvo no sistema

Adicionar um Dialog "Como obter o Token CAPI" acessível no card de integração Facebook Pixel/CAPI dentro do Briefing (`ProjetoBriefing.tsx`). Conteúdo:

1. Acesse business.facebook.com → Configurações do Negócio → Usuários do Sistema
2. Crie um Usuário do Sistema (tipo Admin)
3. Clique em "Gerar Token" → selecione o App
4. Marque permissões: `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`
5. Gere e copie o token
6. Cole no campo "Access Token CAPI" do projeto

Botão "Como obter?" ao lado do campo `access_token` no card Facebook Pixel.

**Arquivo**: `src/components/projeto/ProjetoBriefing.tsx`

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/FileUpload.tsx` | Nova prop `onUploadMultiple`, batch de URLs |
| `src/components/projeto/ProjetoExpert.tsx` | Usar `onUploadMultiple` para adicionar todas as fotos de uma vez |
| `src/components/projeto/ProjetoMidia.tsx` | Usar `onUploadMultiple` para adicionar todas as imagens de uma vez |
| `src/components/projeto/ProjetoBriefing.tsx` | Dialog com passo a passo do token CAPI |

