Objetivo: remover o item redundante "Mapa da Empresa" da sidebar, já que a funcionalidade já está disponível como aba dentro de Funis. Todos os links antigos para `/mapa-empresa` devem continuar funcionando, levando o usuário para a aba correspondente em `/funis`.

Escopo de mudanças:

1. `src/components/AppSidebar.tsx` — Remover o item "Mapa da Empresa" do grupo "Vender".
2. `src/App.tsx` — Trocar a rota `/mapa-empresa` de renderizar o componente `MapaEmpresa` para redirecionar para `/funis?view=mapa`.
3. `src/pages/Funis.tsx` — Ler o query param `view` e definir `viewMode === "mapa"` quando `view=mapa` estiver presente.
4. `src/components/AppLayout.tsx` — Remover ou atualizar o registro de título/breadcrumb do path `mapa-empresa` (evitar referência órfã).
5. `src/pages/MapaEmpresa.tsx` — Avaliar se ainda é necessária; remover o arquivo se não for mais usado após o redirecionamento, para não deixar código morto.

Estrutura da sidebar após a mudança:

```text
Vender
  - Projetos
  - Campanhas
  - Funis          (contém: Hub, Funis, Ecossistema, Mapa da Empresa, Jornada)
  - Sites
  - OpenFlow
```

Comportamento de redirecionamento:

```text
/mapa-empresa  →  /funis?view=mapa  →  Funis abre na aba "Mapa da Empresa"
```

Checklist técnico:
- [ ] Não quebrar nenhum link interno ou favorito salvo com `/mapa-empresa`.
- [ ] Preservar título e breadcrumb corretos quando o usuário chegar em `/funis?view=mapa`.
- [ ] Remover imports/componentes não utilizados do `App.tsx` caso `MapaEmpresa` seja deletado.
- [ ] Validação rápida: acessar `/mapa-empresa` e confirmar que redireciona para `/funis?view=mapa` com a aba Mapa ativa.