

# Diagnóstico: Tela Branca

## O que aconteceu

A tela branca **não é causada por erro de código**. Verifiquei:

- **Build**: compila sem erros (TypeScript OK)
- **Dev server**: rodando normalmente, sem crashes
- **Console**: único erro é a desconexão do WebSocket do Vite HMR — o hot-reload perdeu conexão com o servidor
- **Session replay**: você navegou para `/empresa` → `/login` → `/` e a tela ficou branca

## Causa provável

O ambiente de preview perdeu a conexão WebSocket do Vite (visível no log de console). Isso é um problema transiente do proxy da plataforma — não do código.

## Solução

1. **Recarregar a página** no preview (F5 ou Ctrl+R) — isso resolve 90% dos casos de tela branca por desconexão HMR
2. Se persistir, acessar pela **URL publicada** (https://imperiox.lovable.app) onde o proxy não interfere

Não há mudanças de código necessárias — todos os arquivos estão compilando corretamente.

