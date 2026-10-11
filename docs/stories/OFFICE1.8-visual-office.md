# OFFICE1.8 — Escritório visual no Império

Direção aprovada: opção 3, mapa no computador, navegação por empresa e sala no celular. Liderança: @dev (frontend), sem mudanças de banco ou comandos.

## Critérios
- [x] Reutilizar arte procedural do Habblaud com licença e atribuição.
- [x] Mostrar alas de Império e Consultoria com salas e agentes reais.
- [x] Celular permite escolher empresa e sala sem reduzir o mapa inteiro.
- [x] Selecionar personagem abre comandos e pendências existentes, mantendo os bloqueios de segurança.
- [x] Atualizações posicionam agentes conforme empresa/sala recebida; sem atividade simulada.
- [x] Navegação por teclado, estados vazios/offline, nomes legíveis e movimento reduzido.
- [ ] Validar tipos, lint, testes pertinentes, build e página publicada; registrar limites.

## Direção visual
Arte original do Habblaud: escritório claro com madeira, pisos, plantas e personagens pixelados. Moldura e comandos do Império em #0A0B0D / #1B1E23, acento #D6FF4B. Rótulos em fonte existente do Império, sem texto desenhado no canvas. Computador: duas alas lado a lado e painel do agente selecionado. Celular: empresa → sala → personagem → comando. A cena é o elemento visual principal; estatísticas apenas de agentes e pendências reais.

## File List
- src/components/office/*
- src/vendor/habblaud/*
- src/pages/Escritorio.tsx
- src/test/office-visual.test.tsx
- public/licenses/habblaud.txt
- docs/stories/OFFICE1.8-visual-office.md

## Evidências
- 4 testes do painel passando: empresa, sessão selecionada, offline, sessão substituída e movimentação por atualização do snapshot.
- 7 testes do conector continuam passando; lint específico (incluindo arte vendorizada) sem erros ou avisos.
- Prévia em 390x844, snapshot real: Império com 6 agentes em Tecnologia, Consultoria com Fernanda em Boletins. Seleção validada e nenhuma rolagem horizontal (390/390).
- Prévia preservada fora do workspace em ~/.habblaud/imperio/previews/office1.8, não publicada. Capturas imperio-office-visual-mobile.png e imperio-office-visual-desktop.png em C:/Users/vsuga/habblaud.
- Backend, autenticação e conector não alterados. Não repetimos envio real de instruções ou decisões nesta mudança visual.
