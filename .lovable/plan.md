

# Plano: Corrigir funcionalidades quebradas e adicionar upload de arquivos

## Problemas identificados

1. **Mídia** — Só aceita URL, não tem upload real de arquivos
2. **Projeto (nome/ícone/categoria)** — Header do ProjetoDetalhe não é editável inline
3. **Expert (foto)** — Campo "URL Foto" é texto, sem upload
4. **Docs** — Insert falha porque `imphq_docs.id` é TEXT (não UUID auto-gerado), precisa gerar ID manualmente
5. **Equipe** — Página é read-only, sem CRUD

## Solução

### 1. Storage bucket para mídia do projeto
- Criar bucket `project-media` (público) via migration SQL
- RLS: authenticated pode INSERT/DELETE, público pode SELECT

### 2. Componente reutilizável de upload (`FileUpload.tsx`)
- Input type="file" com accept="image/*"
- Upload para `project-media/{projectId}/{category}/{filename}`
- Retorna URL pública após upload
- Usado em: ProjetoMidia, ProjetoExpert

### 3. ProjetoMidia — Upload real
- Adicionar botão "Upload" ao lado do campo URL existente
- Usar `FileUpload` para subir imagem ao bucket
- Salvar URL pública no JSONB `data.midia`

### 4. ProjetoDetalhe header editável
- Nome do projeto: click to edit (input inline)
- Ícone: input de emoji editável
- Categoria: input editável
- Auto-save via `useAutoSave` nos campos `name`, `icon`, `category`

### 5. ProjetoExpert — Upload de foto
- Substituir campo "URL Foto" por upload + preview
- Upload para `project-media/{projectId}/expert/foto`
- Salvar URL no JSONB `data.expert.foto`

### 6. ProjetoDocs — Fix insert
- A tabela `imphq_docs` tem `id` tipo TEXT (não auto-generated UUID)
- Gerar `crypto.randomUUID()` no client antes do insert
- Corrigir o insert para incluir ID gerado

### 7. Equipe — CRUD completo
- Adicionar botão "+ Membro" com dialog (nome, email, role, department)
- Edição inline na tabela (click para editar)
- Botão deletar por membro
- Toggle de status ativo/inativo
- A tabela `imphq_team_members` já tem: id, user_id, name, email, role, avatar_url, department, is_active

## Arquivos a criar/editar
- **Criar**: `src/components/FileUpload.tsx`
- **Editar**: `ProjetoMidia.tsx` (adicionar upload)
- **Editar**: `ProjetoExpert.tsx` (upload de foto)
- **Editar**: `ProjetoDetalhe.tsx` (header editável)
- **Editar**: `ProjetoDocs.tsx` (fix ID generation)
- **Editar**: `Equipe.tsx` (CRUD completo)
- **Migration SQL**: criar bucket `project-media` + políticas

