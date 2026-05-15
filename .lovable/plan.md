# Rodada 3+4 — Salto visual do gameplay + áudio real

Objetivo: tirar o jogo de "tech demo geométrica" e levá-lo a "arena neon com identidade", sem trocar mecânicas. Tudo respeita a [bíblia de arte](/dev-server/docs/art-bible.md) e os tokens em `src/styles.css`.

> Atualização importante sobre a rodada anterior: descobri que **posso sim gerar áudio** via API da ElevenLabs (SFX + música). Então o que ia virar "prompts pra você" agora vira arquivos reais. A única coisa que continua fora do meu alcance são modelos `.glb` riggados — e não precisamos deles, porque o caminho combinado é procedural.

---

## 1. Armas — peso, identidade, mãos

Refazer `Weapon3D.tsx` mantendo a API atual, mas trocando o visual:

- **Pistola, Rifle, Shotgun, Sniper** ganham silhuetas distintas montadas com geometria composta (cano, corpo, carregador, mira, grip) + materiais neon-arena (corpo escuro fosco, detalhes em cyan emissive, LEDs amarelos no carregador).
- **Mãos/braços** procedurais segurando a arma (dois braços simples com luva preta + acento cyan no antebraço). Resolve a sensação de "arma flutuante".
- **Animações por arma** (todas em código, sem rig externo):
  - idle sway atrelado ao movimento do mouse,
  - recoil específico (pistola seca, rifle crescente, shotgun forte com shake, sniper longo + zoom),
  - reload com translação/rotação do carregador,
  - swap (arma desce/sobe ao trocar).
- **Muzzle flash** vira um sprite radial com luz pontual cyan/magenta de 60ms.
- **Shotgun** passa a disparar **8 pellets reais** com spread em cone (já existe sistema de tracers — só multiplico por arma).
- **Sniper** ganha **scope overlay** 2D (vinheta + crosshair fino + leve respiração) ao segurar botão direito.

## 2. Inimigos — silhueta + telegraph

Refazer `Enemy3D.tsx` por classe, ainda procedural mas com silhueta única (regra da bíblia: precisa ser reconhecível só pela sombra):

| Classe   | Construção visual                                                               | Telegraph antes do ataque                |
| -------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| Rusher   | Corpo baixo inclinado, dois "braços-lâmina" magenta, trail de partículas        | Brilho magenta intensifica + zigue-zague |
| Rifleman | Torso boxy, ombros largos, capacete com visor cyan, "rifle" preso ao corpo      | Pré-flash cyan no cano                   |
| Sniper   | Corpo fino e alto, "antena" longa, visor amber                                   | **Laser amber** visível mira ~600ms      |
| Titan    | Massa larga e curvada, **núcleo magenta pulsante** no peito, blindagem segmentada | Núcleo flares antes de cada ataque       |

Cada um ganha:

- animação procedural de andar (passos via senoide nos pés),
- reação ao dano (flash branco + leve knockback),
- animação de morte (colapso + dissolve emissive cyan→preto em 400ms),
- partículas de impacto na cor da classe.

**Boss Titan** ganha **3 fases**:
1. Tiros pesados de núcleo,
2. Investida com onda de choque (área no chão com aviso magenta),
3. Convoca 2 Rushers ao baixar de 33% HP.

## 3. Mundo — desquadrar a arena

`World.tsx` continua usando grid lógico, mas o visual esconde o grid:

- **Módulos de parede** sci-fi compostos (painel central + vinco + faixa cyan emissive nas bordas) substituem cubos lisos.
- **Piso** ganha grid cyan sutil (`--arena-grid`), decals de hazard magenta nas zonas de spawn, e variação de brilho.
- **Props variados**: 3 tipos de barril (cilindro segmentado), 2 tipos de container, cabos, tubulações, sinalização amber. Distribuição com semente fixa por mapa pra ficar consistente.
- **Iluminação**: ambiente baixo, 2 luzes direcionais frias + spots magenta nas zonas centrais. Fog azul-escuro pra dar profundidade.
- **Skybox/back wall** com gradiente cyan→magenta→preto pintado em `<color>` + `<fog>` do R3F.
- **Spawn points manuais** por arena (substitui spawn aleatório em célula livre) — encontros mais legíveis.
- **Três variações de arena** prontas (Containment Block / Reactor Ring / Server Causeway), selecionáveis no menu de Strike. Mesma lógica de grid, paletas de props e layout diferentes.

## 4. VFX globais

- **Tracers** ficam mais finos com bloom-look (cilindro emissive + sprite no fim).
- **Hit spark**: 6 partículas radiais na cor do alvo + flash de 80ms.
- **Decal de tiro** nas paredes (plane com textura procedural, dura 5s e some).
- **Dano direcional**: vinheta vermelha do lado do impacto, 200ms.
- **Kill confirm**: pulse magenta no crosshair + tick sonoro (item 5).
- **Tela tremendo** com curva controlada (shake amplitude por arma).

## 5. Áudio real (ElevenLabs)

Substitui os osciladores do `SoundEngine.ts` por arquivos MP3 gerados sob demanda e cacheados.

Arquitetura:

- Server route `app/routes/api/public/sfx.ts` chama ElevenLabs Sound Effects.
- Server route `app/routes/api/public/music.ts` chama ElevenLabs Music.
- Script `scripts/generate-audio.ts` rodado uma vez gera **todos** os SFX da lista abaixo e salva em `public/audio/`. Em runtime o jogo só consome os arquivos estáticos (sem custo por partida).
- `SoundEngine.ts` vira uma fina camada de `HTMLAudioElement` pool com mixagem por categoria (sfx / music / ui) e fallback pros osciladores se um arquivo faltar.

SFX a gerar (15 arquivos):

`pistol_shot`, `rifle_shot`, `shotgun_shot`, `sniper_shot`, `reload_short`, `reload_long`, `enemy_hit`, `enemy_death`, `boss_roar`, `boss_phase`, `pickup_health`, `pickup_ammo`, `ui_click`, `ui_hover`, `wave_start`.

Música (3 faixas, ~60s loop cada):

`menu_theme` (sintetizador frio, BPM 90), `combat_loop` (drum'n'bass agressivo cyan/magenta, BPM 140), `boss_theme` (industrial pesado, BPM 120).

> Requer **Lovable Cloud habilitado** + secret `ELEVENLABS_API_KEY`. Eu peço a habilitação no início da execução; se você recusar, o áudio fica sem ser substituído e o resto da rodada continua.

## 6. HUD — só limpeza pontual

Sem refator pesado (isso é a rodada 2 que ficou pra depois). Só:

- Remover textos duplicados da barra superior (linha "Arena Live" fica, "Protocol Active" sai).
- Aplicar tokens neon (`text-neon-cyan`, `bg-arena-panel`) onde hoje tem `bg-slate-900/80` literal nos painéis principais.
- Indicador de dano direcional (citado no item 4) entra como overlay novo.

## 7. Detalhes técnicos

- Arquivos novos:
  - `src/game-app/components/game/WeaponHands.tsx`
  - `src/game-app/components/game/EnemyRusher.tsx` / `Rifleman.tsx` / `Sniper.tsx` / `Titan.tsx` (e `Enemy3D.tsx` vira só um switch)
  - `src/game-app/components/game/ArenaProps.tsx`
  - `src/game-app/data/arenas.ts` (3 layouts + spawn points)
  - `src/game-app/game/audio/AudioPool.ts`
  - `app/routes/api/public/sfx.ts`, `app/routes/api/public/music.ts`
  - `scripts/generate-audio.ts`
  - `public/audio/` (gerado)
- Arquivos editados:
  - `Weapon3D.tsx` (refeito)
  - `World.tsx` (props + iluminação + fog)
  - `GameApp.tsx` (limpeza pontual + integração de spawn points + scope overlay + dano direcional)
  - `SoundEngine.ts` (vira wrapper do AudioPool)
  - `styles.css` (sem mudanças, tokens já existem)
- **Sem** mexer em: progressão, upgrades, balance numérico, lógica de wave, persistência, controles mobile, refator de `GameApp.tsx`. Tudo isso fica pras próximas rodadas combinadas (refator técnico + objetivos por wave + mobile refinement).

## 8. O que NÃO entra nesta rodada (consciente)

- Quebrar o `GameApp.tsx` em sistemas (rodada 2 técnica).
- Tirar `// @ts-nocheck`.
- Converter PNGs grandes pra WebP em massa.
- Objetivos por wave além de "kill all".
- Tutorial.
- Aim assist e refino mobile.
- Modelos `.glb` externos.

## 9. Risco e mitigação

- **ElevenLabs sem API key** → áudio cai em fallback de oscilador (jogo continua jogável). Aviso no início.
- **Performance com mais geometria/luzes** → uso `instancedMesh` pra props repetidos e mantenho shadows desligadas. Se o FPS cair, primeira coisa a cortar é fog volumétrico e segundo nível de detalhe dos inimigos distantes.
- **`Weapon3D.tsx` é central, refazê-lo pode quebrar disparo** → mantenho a mesma API (`fire()`, `reload()`, `swap()`) e refaço só o componente visual; lógica de dano fica intocada.

## 10. Critério de "pronto"

Ao final da rodada, abrindo o jogo:
1. Menu mostra "PROTOCOL DOC" com mock-arena de fundo + música tema.
2. Iniciar Strike → escolho 1 das 3 arenas.
3. A arma na minha mão tem braços, recoil real, e cada uma soa diferente.
4. Cada inimigo é reconhecível pela silhueta e tem telegraph antes de atacar.
5. Boss tem 3 fases visíveis.
6. Tomar dano mostra de qual lado veio.
7. Tudo soa como um shooter, não como um sintetizador de teste.
