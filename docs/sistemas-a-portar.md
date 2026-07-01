# Sistemas a Portar — Protocol DOC → Unreal Engine

> Fase 0 do plano de migração. Este documento é o inventário estruturado do jogo
> atual, extraído diretamente do código-fonte, para servir de base a uma
> reconstrução em Unreal Engine.
>
> **Status (Fase 1.5):** todos os sistemas listados abaixo já têm uma
> implementação C++ correspondente em `/game-unreal` (escrita sem a Unreal
> Engine instalada, ainda não compilada) — ver `game-unreal/EDITOR_TODO.md`
> para o que falta (build, Data Tables, assets de Editor).

## 0. Correção de premissa importante

O plano original assumia um FPS com **renderização por raycasting** (estilo
Wolfenstein). Isso **não corresponde ao estado atual do repositório**:

- O jogo (`src/game-app/`) é renderizado com **Three.js + React Three Fiber**
  (`@react-three/fiber`, `@react-three/drei`, `three@^0.184`) — ou seja, já é
  **3D real** (WebGL), com geometria mesclada por material (`BufferGeometry`
  merge), texturas, câmera com pitch/yaw livre e colisão por AABB simplificada
  em grid.
- O mapa é uma grid lógica (`number[][]`, células 0=chão/1=parede/2=porta/
  3=barril) igual a um raycaster clássico, mas a **apresentação** já é
  geometria 3D extrudada a partir dessa grid (`World.tsx` / `WorldLite.tsx`),
  não sprites projetados por raio.
- **Não existem controles touch/mobile** no código atual. O input é
  exclusivamente teclado + mouse com Pointer Lock API
  (`useInputSystem.ts`). Há um hook `useIsMobile()` (`src/hooks/use-mobile.tsx`)
  mas ele só ajusta breakpoints de UI responsiva — não implementa joystick
  virtual, botões de fogo ou qualquer input touch.
- **Não existe sistema de scorestreaks** (killstreaks estilo CoD Mobile —
  recompensas ativáveis por sequência de abates: UAV, ataque aéreo, etc.). O
  jogo tem, em vez disso, uma economia de **wave survival + objetivos por
  onda + créditos/upgrades permanentes** (ver `docs/scorestreaks.md`, que
  documenta o sistema real e a lacuna em relação ao plano original).

Consequência prática para a Fase 1+: como o jogo já é 3D real (não sprites
raycasted), uma fração do trabalho de blockout pode potencialmente reaproveitar
a **topologia dos mapas em grid** quase diretamente (célula → tile Unreal), e
eventuais assets 3D (`public/assets`, texturas em `public/textures`) podem ser
candidatos a reimportação, algo que não seria possível vindo de um raycaster
puro. Ainda assim, código React/Three.js não roda em Unreal — é remake de
lógica de jogo, não port de renderização.

Nome do produto: **Protocol DOC** (ver `docs/art-bible.md`). Referências a
"Nano Banana", "Tactical Wave Shooter" ou "DOC: Sector Breach" são nomes
retirados e não devem aparecer em nenhum documento novo.

---

## 1. Armas

Fonte: `src/game-app/game/constants.ts` (`WEAPONS`), `src/game-app/game/systems/combat.ts`.

| Arma (id)     | Nome  | Dano base | Cadência (ms/tiro) | Recarga (ms) | Carregador | Alcance (un.) | Auto | Mira (scope) | Recuo | Spread |
| ------------- | ----- | --------- | ------------------- | ------------- | ---------- | -------------- | ---- | ------------- | ----- | ------ |
| `pistol`      | P-99  | 20        | 250                 | 1200          | 12         | 600            | Não  | Não           | 5     | 0.05   |
| `rifle`       | M4-A1 | 15        | 100                 | 2000          | 30         | 800            | Sim  | Não           | 3     | 0.10   |
| `shotgun`     | KRM-262 | 60 (÷8 pellets) | 800            | 2500          | 6          | 300            | Não  | Não           | 20    | 0.50   |
| `sniper`      | DL-Q33 | 100      | 1500                | 3000          | 5          | 1500           | Não  | Sim           | 40    | 0.01   |

Regras de disparo (`combat.ts::createHandleShoot`):

- Cada tiro é um **raycast em steps de 8 unidades** ao longo do mapa (grid),
  parando em parede (`cell===1|2`) ou destruindo barril explosivo (`cell===3`).
- Shotgun dispara **8 pellets**, dano dividido igualmente; outras armas disparam 1 raio.
- Cone de acerto no inimigo mais próximo no caminho do raio: `hitCone = min(0.35, atan2(hitRadius, dist))`,
  `hitRadius` = 26 (comum) / 48 (boss). Requer linha de visão (`checkLineOfSight`).
- Sem penetração: cada pellet atinge no máximo 1 inimigo (o mais próximo dentro do cone).
- ADS (mira, tecla `C` ou botão direito do mouse) reduz spread em até 80% e reduz recuo em 60%;
  velocidade de movimento cai até 50% enquanto mira (`adsProgress` sobe/desce em rampa de 0.1/tick).
- Upgrades de arma (por arma, níveis independentes — `WeaponUpgrades`):
  - `damage`: +5%/nível no dano.
  - `stability`: -5%/nível no spread e recuo.
  - `reload`: -4%/nível no tempo de recarga (empilha com o upgrade global `quickReload`).
- Decalques de impacto em parede (máx. 16 simultâneos, cortados do mais antigo).
- Recarga bloqueia disparo (`isReloadingRef`); trocar de arma (teclas 1-4) cancela recarga em andamento.

## 2. Bots / IA

Ver `docs/bots-ia.md` para a máquina de estados completa. Resumo:

- 3 tipos regulares: `rusher` (melee, perseguição agressiva), `rifleman`
  (combate a média distância), `sniper` (mantém distância, dano alto). 1 boss:
  `titan` (multiplicador de HP/dano, aparece a cada 5ª onda).
- Estados implícitos por distância-alvo + linha de visão: **perseguir /
  manter distância / flanquear / bloqueado-navegar-por-grid**. Não há uma FSM
  nomeada explicitamente no código — o comportamento é data-driven por
  `targetDist`, `hasLineOfSight` e um grid de navegação (`navGridRef`, BFS/flow-field
  pré-computado por onda).
- Dificuldade (`DIFFICULTIES`) aplica multiplicadores globais de HP/dano/créditos.

## 3. Progressão / Economia (substitui "scorestreaks")

Ver `docs/scorestreaks.md`. Resumo: ondas com objetivos variados (eliminar,
hackear nó, defender núcleo, extrair), créditos ganhos por onda/abate/vitória,
upgrades permanentes (armor, munição, recarga, scavenger) e upgrades por arma,
tudo persistido em `localStorage`.

## 4. Controles

Ver `docs/controles-touch.md`. **Só existe input desktop** (teclado + mouse
com Pointer Lock). Documento cobre isso e propõe o que precisaria ser
adicionado na Unreal (Enhanced Input + touch) caso mobile continue sendo meta.

## 5. Estrutura lógica dos mapas

Fonte: `src/game-app/data/arenas.ts`. 3 arenas, cada uma uma grid `24×18`
células (`CELL_SIZE = 64`), com spawn do jogador, lista de spawn points de
inimigos e paleta de cor (`accent`):

1. **Containment Block** (cyan) — grid simétrica com alcovas, curtas linhas de
   visão, muita cobertura. 12 spawn points de inimigos.
2. **Reactor Ring** (magenta) — arena aberta central com "núcleo" (colunas em
   cruz no meio), boa para combate a média/longa distância. 11 spawn points.
3. **Server Causeway** (amber) — corredor longo com racks de servidor como
   cobertura lateral, sightlines longas (favorece sniper). 11 spawn points.

Códigos de célula: `0` chão, `1` parede (bloqueia line-of-sight e movimento),
`2` porta/cobertura baixa (bloqueia movimento até ser "aberta" ao ser tocada
ou atingida por bala — vira `0` permanentemente), `3` barril explosivo
(bloqueia movimento e LOS até ser destruído por qualquer tiro).

Zonas de objetivo (`objectives.ts`) são calculadas via BFS de células
alcançáveis a partir do spawn do jogador, para nunca cair fora da área
navegável (ex.: o centro geométrico do Reactor Ring fica dentro do núcleo
selado, então o objetivo "hackear" é ajustado para a célula alcançável mais
próxima do centro).

## 6. Referência de arquivos-fonte usados nesta extração

- `src/game-app/game/constants.ts` — armas, upgrades, dificuldades, ondas.
- `src/game-app/game/systems/combat.ts` — disparo, dano, recarga, drops.
- `src/game-app/game/systems/enemyAI.ts` — tick de IA dos bots.
- `src/game-app/game/systems/useWaveSystem.ts` — spawn de ondas e boss.
- `src/game-app/game/objectives.ts` — objetivos por onda.
- `src/game-app/game/systems/pickups.ts` — coleta de pickups.
- `src/game-app/game/systems/useInputSystem.ts` — input teclado/mouse.
- `src/game-app/game/settings.ts` — sensibilidade, inversão de eixo, volume.
- `src/game-app/data/arenas.ts` — layout lógico dos 3 mapas.
- `src/game-app/game/persistence.ts` — save/load em `localStorage`.
- `src/game-app/GameApp.tsx` — loop principal, movimento do jogador, economia de fim de run.
- `docs/art-bible.md` — identidade visual/nome do produto (pré-existente).
