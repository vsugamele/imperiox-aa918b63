

# Plano: Deletar Projeto + Logs OpenFlow + Referências com Mídia de Ads

## 1. Botão "Excluir Projeto" na página de Projetos
- Adicionar botão de exclusão (com confirmação via AlertDialog) na listagem de projetos (`Projetos.tsx`)
- Faz `DELETE FROM imphq_projects WHERE id = ?` — as tabelas dependentes devem ter `ON DELETE CASCADE` ou precisarão de limpeza manual
- Verificar se as foreign keys já têm CASCADE; se não, criar migration adicionando

## 2. Logs de execução do OpenFlow
- **Migration**: criar tabela `imphq_automacao_logs` com colunas: `id`, `automacao_id` (FK), `project_id`, `trigger_data` (jsonb), `acoes_executadas` (jsonb), `status` (text: success/error), `error_message`, `created_at`
- **Edge Function `openflow-executor`**: após executar cada ação, inserir um log na tabela
- **UI**: adicionar aba/painel "Logs" na página OpenFlow mostrando histórico de execuções com filtro por automação e status

## 3. Referências — incluir criativos de Ads Reports
- Verificar se `imphq_ads_reports` tem URLs de criativos (image_url, thumbnail_url)
- Se sim, incluir no `load()` de `Referencias.tsx` como fonte adicional com `source: "ads"`
- Se não, buscar da API do Facebook as thumbnails dos criativos na sync e salvar na tabela

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration (nova) | CASCADE nas FKs de projeto + tabela `imphq_automacao_logs` |
| `src/pages/Projetos.tsx` | Botão excluir projeto com AlertDialog |
| `supabase/functions/openflow-executor/index.ts` | Inserir logs após execução |
| `src/pages/OpenFlow.tsx` | Aba/painel de logs de execução |
| `src/pages/Referencias.tsx` | Incluir criativos de ads como fonte extra |

