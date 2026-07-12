## Excluir linha (edge) do Mapa

Hoje as conexões já podem ser removidas (tecla Delete após selecionar), mas não há indicação visual — o usuário não descobre.

### Mudança
`src/components/funis/CompanyMapCanvas.tsx`:

1. **Clique na linha → menu de contexto** com opção "Excluir conexão" (reaproveitar o `ctxMenu` já existente usado nas anotações).
2. **Hover na linha** → destaque (stroke mais grosso + cor mais viva) para deixar claro que é clicável.
3. **Botão "×" flutuante** no ponto médio da edge selecionada, usando `EdgeLabelRenderer` do React Flow, que exclui direto no Supabase (`imphq_company_map_edges`).
4. Manter atalho **Delete/Backspace** já funcional.

Sem mudanças de schema, sem novos componentes de página.