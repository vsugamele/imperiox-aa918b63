# Docs do Projeto: PDF + Visualizador

## Problema
Em `ProjetoDocs.tsx`:
- Importação usa `file.text()` e aceita só `.txt,.md,.doc,.docx` → PDF/DOCX não funcionam (lê binário como texto).
- Não existe botão "Visualizar" — só editar inline (textarea markdown).

## Mudanças

### 1. Upload de PDF (e binários)
- Adicionar `.pdf` no `accept` do input de import.
- Para PDF/DOCX: subir o arquivo no bucket `project-media` (já existe) em `docs/{projectId}/{uuid}.{ext}` e salvar em `imphq_docs` com:
  - `title` = nome do arquivo
  - `content` = marcador `[[file:{publicUrl}|{mimeType}]]` (mantém a tabela atual sem migration)
- Para `.txt/.md`: comportamento atual (lê como texto).

### 2. Botão Visualizar
- Novo ícone `Eye` em cada linha (antes de download/delete).
- Abre `Dialog` (max-w-4xl, h-[80vh]):
  - Se `content` começa com `[[file:` e mime = PDF → renderiza `<iframe src={url}>` em altura total.
  - Se mime = imagem → `<img>`.
  - Caso contrário → preview do markdown/texto (render simples com `whitespace-pre-wrap`).
- Não substitui o editor; clique no card continua abrindo edição (apenas para docs de texto). Para docs-arquivo, clique no card abre o visualizador.

### 3. Detalhes técnicos
- Helper `parseDocContent(content)` retorna `{ kind: "file"|"text", url?, mime? }`.
- No editor existente: se `kind === "file"`, esconder textarea e mostrar aviso "Documento de arquivo — use Visualizar/Download".
- Download de arquivo: trocar `Blob` por `fetch(url) → blob` quando for `kind=file` (preserva extensão original).

## Arquivos
- `src/components/projeto/ProjetoDocs.tsx` (editar): accept inclui pdf, branch upload binário, botão Eye, Dialog viewer, helper parse.
- Novo: `src/components/projeto/DocViewerDialog.tsx` (PDF iframe / imagem / texto).

## Não muda
- Schema de `imphq_docs` (sem migration).
- Bucket `project-media` (já público).
