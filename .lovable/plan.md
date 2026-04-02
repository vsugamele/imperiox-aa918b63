

# Plano: Página de Privacidade + Guia Facebook Business Manager

---

## 1. Página de Política de Privacidade (`/privacy`)

Criar uma página pública (sem autenticação) com política de privacidade compatível com os requisitos do Facebook para aprovação de apps. Inclui:

- Coleta de dados (nome, email, dados de anúncios via Marketing API)
- Uso dos dados (sincronização de métricas, otimização de campanhas)
- Compartilhamento (não compartilha com terceiros)
- Retenção e exclusão de dados
- Contato do responsável
- Branding "Imperio HQ"

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Privacy.tsx` | Nova página pública com a política completa |
| `src/App.tsx` | Rota `/privacy` fora do ProtectedRoute (pública) |

---

## 2. Passo a passo para Facebook Business Manager + Token

Após implementar, vou incluir o guia completo no chat. Resumo:

### Criar o App no Facebook

1. Acesse [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Criar App**
2. Tipo: **Business** → Selecione sua Business Manager
3. Em **Configurações > Básico**: cole a URL da privacy page (`https://imperiox.lovable.app/privacy`) no campo **URL da Política de Privacidade**
4. Preencha os campos obrigatórios (ícone, domínio, email de contato)

### Adicionar o produto Marketing API

5. No painel do app → **Adicionar Produto** → **Marketing API**
6. Em **Configurações do App** → solicite as permissões: `ads_read`, `ads_management`, `business_management`

### Conectar sua BM e Ad Accounts

7. Vá em [business.facebook.com/settings](https://business.facebook.com/settings)
8. **Contas de Anúncios** → verifique que as contas que quer acessar estão na BM
9. **Apps** → adicione seu app à BM → dê permissão às contas de anúncios

### Gerar o Token no Graph API Explorer

10. Acesse [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/)
11. Selecione seu **App** no dropdown
12. Clique **Gerar Token de Acesso** → faça login e autorize
13. Adicione as permissões: `ads_read`, `ads_management`
14. Copie o token gerado
15. Cole no campo **Access Token (Marketing API)** dentro do projeto no Imperio HQ

### Token de Longa Duração (60 dias)

16. No Graph Explorer, troque o token curto por um de longa duração:
    ```
    GET /oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={TOKEN_CURTO}
    ```
17. Use o token retornado — dura 60 dias

---

## Resumo

| Arquivo | Mudança |
|---|---|
| `src/pages/Privacy.tsx` | Página pública de política de privacidade |
| `src/App.tsx` | Rota `/privacy` pública |

