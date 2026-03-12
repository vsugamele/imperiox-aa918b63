

# Plano: Adicionar upload de arquivo HTML no importador de Avatar

Adicionar um botao de upload de arquivo `.html` ao lado do textarea existente. O usuario pode escolher entre colar o HTML manualmente ou fazer upload do arquivo direto do computador.

## Implementacao

| Arquivo | Acao |
|---|---|
| `src/components/projeto/avatar/AvatarImporter.tsx` | Adicionar input file hidden + botao de upload + handler `FileReader` |

### Detalhes

- Adicionar um `<input type="file" accept=".html,.htm" />` oculto com ref
- Adicionar botao "📁 Carregar Arquivo" ao lado do botao "Analisar HTML" no footer (ou acima do textarea como zona de drop)
- No handler: usar `FileReader.readAsText(file)` para ler o conteudo e setar no state `html`
- Auto-disparar o parse apos o upload (chamar `handleParse` automaticamente)
- Manter o textarea para quem preferir colar manualmente
- Adicionar uma area visual acima do textarea tipo dropzone com icone de arquivo, indicando que pode arrastar ou clicar

Layout proposto:
```text
┌─────────────────────────────────────┐
│  📁 Arraste um arquivo .html aqui   │
│     ou clique para selecionar       │
├─────────────────────────────────────┤
│  [textarea para colar HTML]         │
│                                     │
├─────────────────────────────────────┤
│  [Analisar HTML]  [Importar Dados]  │
└─────────────────────────────────────┘
```

