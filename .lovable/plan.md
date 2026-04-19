
O usuário enviou um arquivo `.skill` com 60+ templates de roteiros virais para Reels. Pelo contexto do projeto (Império HQ tem `imphq_skills`, `ProjetoCentralConteudo`, `ContentGenerator`, e área de Mídia/Reels), o melhor uso é transformar isso em uma **Skill de IA nativa** + **biblioteca de templates** disponível no Gerador de Conteúdo.

## Plano

**1. Salvar o arquivo como skill markdown**
- Copiar `user-uploads://roteiros-virais-reels_2.skill` → `src/data/skills/roteiros-virais-reels.md`
- Adicionar entrada em `src/data/skillsData.ts` (id: `roteiros-virais-reels`, categoria: "Copy & Persuasão", ícone 🎬)

**2. Registrar skill no banco (`imphq_skills`)**
- Migration insert com slug `roteiros-virais-reels` para que Edge Functions a reconheçam

**3. Integrar no Gerador de Conteúdo (ContentGenerator)**
- Adicionar tipo de conteúdo "Roteiro Viral de Reels" 
- Dropdown com as 63 estruturas (Dica Direta / Esquema / Passo a Passo / React / Antes-Depois / Provocação)
- IA preenche os `[colchetes]` com contexto do projeto (avatar + branding + produto)

**4. Criar componente `RoteirosViraisLibrary.tsx`**
- Acessível em `ProjetoCentralConteudo` aba "Roteiros Virais"
- Lista categorizada com busca, exibe estrutura + exemplos + métricas
- Botão "Gerar com IA" → chama `openflow-ai` com a skill + estrutura escolhida

## Arquivos
- `src/data/skills/roteiros-virais-reels.md` (novo)
- `src/data/skillsData.ts` (entrada nova)
- `src/components/projeto/RoteirosViraisLibrary.tsx` (novo)
- `src/components/projeto/ProjetoCentralConteudo.tsx` (nova aba)
- `src/components/dashboard/ContentGenerator.tsx` (novo tipo)
- Migration: insert em `imphq_skills`

## Ordem
1. Salvar markdown + atualizar skillsData
2. Migration (insert na tabela)
3. Componente da biblioteca + aba
4. Integração no ContentGenerator
