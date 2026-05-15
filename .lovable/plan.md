# Rodada 4 — Fechamento das pendências

Ordem fixa, cada etapa é entregável independente. Se travar numa, as anteriores já ficam de pé.

---

## Etapa 1 — Áudio real via ElevenLabs

Objetivo: substituir os osciladores pelos 17 arquivos do `public/audio/README.md`.

- Habilitar **Lovable Cloud** e cadastrar `ELEVENLABS_API_KEY` (eu peço no início).
- Server route `app/routes/api/public/generate-sfx.ts`: POST `{ name, prompt, duration }` → chama `https://api.elevenlabs.io/v1/sound-generation` → retorna MP3 binário. Protegida por header `x-gen-secret` (segredo separado) pra não virar endpoint aberto.
- Server route `app/routes/api/public/generate-music.ts`: idem para `/v1/music`.
- Script `scripts/generate-audio.ts` (rodado via `bun run`): itera sobre a lista do README, baixa cada faixa e grava em `public/audio/<name>.mp3`. Pula se já existir (idempotente). Loga progresso.
- Sem mudança em `SoundEngine.ts`: ele já tem o fallback MP3→osc; assim que os arquivos aparecerem em `public/audio/`, o jogo passa a usá-los automaticamente.
- Trigger de música: `playMusic('menu_theme')` no `MainMenu`, `'combat_loop'` ao iniciar Strike, `'boss_theme'` ao spawnar Titan.

Critério: tirar o som do navegador, abrir o menu e ouvir música. Atirar com cada arma soa diferente do oscilador.

---

## Etapa 2 — 3 arenas + seleção no menu

Objetivo: acabar com a sensação de "sempre o mesmo mapa quadrado".

- Novo arquivo `src/game-app/data/arenas.ts` exportando 3 layouts:
  - **Containment Block** (atual, retrabalhado) — corredor central + alcovas.
  - **Reactor Ring** — arena circular com núcleo magenta no centro, 4 colunas.
  - **Server Causeway** — corredor longo com racks de servidor laterais.
  - Cada arena: `{ id, name, mapData: number[][], spawnPoints: {x,y}[], playerSpawn: {x,y,angle}, propSeed: number, accent: 'cyan'|'magenta'|'amber' }`.
- `World.tsx` aceita `arena` como prop e usa `propSeed` pra distribuir barris/containers determinísticos.
- Substitui spawn aleatório em célula livre por `spawnPoints` da arena (round-robin embaralhado por wave).
- `MainMenu.tsx`: ao clicar Strike, abrir submenu de seleção de arena (3 cards usando o token `--arena-panel`, com nome + acento + miniatura procedural). Persiste última escolha em `persistence.ts`.
- `GameApp.tsx`: aceita arena selecionada; reseta player, mapData e spawn points ao iniciar.

Critério: 3 arenas jogáveis distintas, escolhíveis no menu.

---

## Etapa 3 — Objetivos por wave

Objetivo: tirar o "mata onda → mata onda" como única loop.

- Tipo `WaveObjective` em `game/types.ts`:
  - `eliminate` (atual — mata todos),
  - `defend` (proteger núcleo central por X segundos; núcleo tem HP, inimigos miram nele),
  - `hack` (player precisa ficar dentro de zona marcada por X segundos; barra de progresso pausa se sair),
  - `extract` (após matar X inimigos, ir até zona de extração antes do timer).
- Novo arquivo `src/game-app/game/objectives.ts`: definição de cada objetivo, lógica de tick, condição de vitória/derrota.
- `constants.ts`: tabela de waves passa a ter `objective: WaveObjective` (ex: wave 1 elim, wave 2 hack, wave 3 elim, wave 4 defend, wave 5 boss elim, wave 6 extract...).
- HUD: novo painel "OBJECTIVE" no topo central usando tokens neon (substitui a mensagem genérica de wave). Mostra tipo + progresso + timer.
- Boss wave continua `eliminate` (o boss já é o desafio).

Critério: jogando 6 waves seguidas, vejo 4 tipos diferentes de objetivo com HUD próprio.

---

## Etapa 4 — VFX pendentes da rodada 3

Objetivo: pequenos polimentos visíveis que ficaram de fora.

- **Bullet decals**: ao tracer bater em parede, spawnar plane com textura procedural circular emissive cyan, dura 5s e fade-out. Cap em 30 simultâneos (FIFO).
- **Dano direcional**: novo overlay `DamageVignette.tsx` em `GameApp.tsx`. Quando player toma dano, calcular ângulo do agressor vs `player.angle`, mostrar gradiente radial vermelho (`--neon-danger`) do lado correto, fade 200ms.
- **Scope do sniper**: ao apertar botão direito com sniper equipado, overlay 2D com vinheta preta, círculo central transparente, crosshair fino cyan + leve "respiração" (scale 1±0.005 a 0.5Hz). FOV da câmera vai de 75 → 35.

Critério: levar tiro mostra de onde veio, sniper tem mira de verdade, paredes ficam marcadas.

---

## Etapa 5 — Refator técnico de `GameApp.tsx`

Objetivo: tirar `// @ts-nocheck` e quebrar o monólito sem mudar gameplay.

- Quebrar em hooks dedicados em `src/game-app/game/systems/`:
  - `useInputSystem.ts` — teclado, mouse, mobile controls.
  - `useWaveSystem.ts` — spawn, progressão, objetivos.
  - `useEnemyAI.ts` — movimento e ataque dos inimigos.
  - `useCombatSystem.ts` — disparo, dano, hit detection.
  - `usePickupSystem.ts` — drop e coleta.
  - `useGameLoop.ts` — orquestra os ticks.
- `GameApp.tsx` vira só composição de hooks + render (~200 linhas vs ~2000 atual).
- Tipar tudo: remover `// @ts-nocheck` de `GameApp.tsx`, `GameScene.tsx`, `Enemy3D.tsx`, `World.tsx`, `Particles3D.tsx`, `Tracers3D.tsx`, `SoundEngine.ts`. Tipos vivem em `game/types.ts`.
- Sem mudança de comportamento — a rodada é puramente técnica. Validação: jogar 3 waves em cada arena e confirmar que nada quebrou.

Critério: `tsc --noEmit` passa sem `@ts-nocheck` nos arquivos do `game-app`.

---

## Detalhes técnicos

```text
Arquivos novos
├── app/routes/api/public/generate-sfx.ts
├── app/routes/api/public/generate-music.ts
├── scripts/generate-audio.ts
├── public/audio/*.mp3                       (gerados)
├── src/game-app/data/arenas.ts
├── src/game-app/game/objectives.ts
├── src/game-app/components/menu/ArenaSelect.tsx
├── src/game-app/components/hud/ObjectivePanel.tsx
├── src/game-app/components/hud/DamageVignette.tsx
├── src/game-app/components/hud/SniperScope.tsx
├── src/game-app/components/game/BulletDecals.tsx
└── src/game-app/game/systems/
    ├── useInputSystem.ts
    ├── useWaveSystem.ts
    ├── useEnemyAI.ts
    ├── useCombatSystem.ts
    ├── usePickupSystem.ts
    └── useGameLoop.ts

Arquivos editados
├── src/game-app/GameApp.tsx                 (composição + tirar @ts-nocheck)
├── src/game-app/components/menu/MainMenu.tsx (entry para ArenaSelect + música)
├── src/game-app/components/game/World.tsx    (aceita arena prop)
├── src/game-app/components/game/GameScene.tsx
├── src/game-app/game/constants.ts            (waves + objectives)
├── src/game-app/game/types.ts                (WaveObjective)
└── src/game-app/game/persistence.ts          (lastArena)
```

## Fora desta rodada

- Modelos `.glb` externos.
- Tutorial in-game.
- Aim assist e refino mobile.
- Conversão WebP em massa.
- Novas armas / inimigos / progressão.

## Riscos

- **ElevenLabs sem chave** → etapa 1 fica pendente, etapas 2-5 seguem normais (osciladores continuam tocando).
- **Refator etapa 5 é grande** → faço por sistema, commitando funcional a cada hook extraído. Se algo regredir, dá pra reverter sistema por sistema.
- **Performance com decals + 3 arenas + objetivos** → cap em 30 decals, `instancedMesh` em props repetidos, perfilo após etapa 4.

## Critério final

Abrir o jogo, escolher uma das 3 arenas, ouvir música tema, jogar 6 waves variadas (elim/hack/defend/boss/extract), tomar dano e ver de onde veio, atirar com sniper e ver scope, terminar a partida sem `@ts-nocheck` no console de build.
