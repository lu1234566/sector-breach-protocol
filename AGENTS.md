# AGENTS.md — Regras para agentes de IA neste repositório

Este repositório está em transição: o jogo atual (`src/game-app/`) é um FPS
3D web (Three.js/React Three Fiber) chamado **Protocol DOC**, servindo de
base de design para uma reconstrução em **Unreal Engine** (ver
`docs/GDD.md` e `docs/sistemas-a-portar.md`).

## Regras gerais

1. **Não alterar assets binários** (`.uasset`, `.umap`, e equivalentes web
   como texturas/áudio/modelos já publicados) sem autorização explícita do
   usuário — eles não são revisáveis em diff de texto.
2. **Priorizar C++, `.ini`, Data Tables (CSV/JSON) e Markdown.** Evitar
   depender de Blueprint puro em sistemas críticos de gameplay, já que
   agentes de código não conseguem editar grafos visuais.
3. **Explicar toda mudança relevante de regra de jogo antes de aplicar.**
4. **Commits pequenos, um sistema por commit** (ex.: "arma: cadência de
   tiro", "bot: estado de patrulha").
5. Manter `docs/GDD.md` e `docs/sistemas-a-portar.md` atualizados a cada
   mudança de regra de jogo (dano, IA, economia, controles, mapas).
6. **Não quebrar a versão do engine/framework definida no projeto**
   (versão da Unreal quando o projeto Unreal existir; versões de
   React/Three.js/Vite no jogo web atual).
7. **Git LFS obrigatório** para qualquer asset novo acima de 10MB.
8. Ao documentar sistemas do jogo atual, **extrair do código-fonte real**,
   nunca assumir comportamento — se a extração revelar uma discrepância com
   um plano/premissa anterior (ex.: "o jogo é raycasting", "existem
   scorestreaks", "existem controles touch" — nenhuma dessas é verdadeira
   no estado atual do repo), documentar a discrepância explicitamente em vez
   de forçar os documentos a bater com a premissa errada.

## Onde as coisas vivem

- `src/game-app/` — jogo web atual (fonte da verdade para regras de jogo a
  extrair).
- `docs/` — GDD, inventário de sistemas a portar, art bible.
- Estrutura futura `/game-unreal` (`Source`, `Content`, `Config`) só deve ser
  criada quando o projeto Unreal em si for iniciado (Fase 1+ do plano de
  migração) — não antes.

CLAUDE.md e CODEX.md apontam para este arquivo; não duplicar regras — se
precisar de uma regra específica de uma ferramenta, adicionar lá, mas as
regras de projeto vivem aqui.
