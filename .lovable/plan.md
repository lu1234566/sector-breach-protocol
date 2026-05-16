# Plano de aplicação — assets escolhidos (alvo: Chromebook)

Aplicar os assets aprovados no Protocol DOC sem quebrar gameplay, com orçamento agressivo de performance para hardware fraco (Intel UHD, 4 GB RAM, GPU integrada).

## Orçamento de performance (regra dura)

| Recurso | Limite | Estratégia |
|---|---|---|
| Triângulos visíveis | ≤ 350k | Decimação + InstancedMesh + frustum culling |
| Draw calls | ≤ 120 | Instancing para paredes/props repetidos; merge de estáticos |
| Texturas (GPU) | ≤ 180 MB | Diff 1K WebP, normal+rough+metal empacotados em ORM 1K PNG |
| Bundle inicial | ≤ 8 MB | Boss e kits carregados sob demanda (lazy) |
| Boss | ≤ 80k tris, textura 2K | Carrega só na wave do boss |

## Etapas

### 1. Pipeline de conversão (fora do app)
Script Node em `scripts/assets/` que processa os ZIPs originais (em `assets-source/`, fora de `src/`) e cospe arquivos otimizados em `public/assets/`:

- **GLB/FBX**: FBX → GLB (gltf-pipeline), depois `gltf-transform`:
  - `weld` + `simplify` (ratio 0.3-0.5 para inimigos, 0.08 para o boss)
  - `dedup`, `prune`
  - `draco` compression (geometria)
  - `meshopt` compression (fallback)
- **Texturas Poly Haven** (.exr/.png 4K):
  - diff → WebP 1024, q=82
  - normal_gl → PNG 1024 (canal RGB)
  - rough + metal → empacotados num único ORM PNG 1024 (R=AO, G=Roughness, B=Metalness)
  - .exr é convertido com `sharp` (suporta via libvips) ou `oiiotool` se preciso
- **Kenney FBX**: convertidos em batch para GLB, sem textura (paint via shader neon).

Output final esperado:
```
public/assets/
  boss/dragon.glb               (~3-5 MB)
  enemies/eyedrone.glb, quad.glb, trilobite.glb
  pickups/health.glb, ammo.glb, keycard.glb
  props/barrel.glb, crate.glb, mine.glb, terminal.glb
  modules/wall-a.glb, wall-b.glb, floor-a.glb, corridor.glb, gate.glb
  textures/wall_blue_diff.webp + wall_blue_orm.png + wall_blue_normal.png
  textures/wall_concrete_*.{webp,png}
  textures/floor_concrete_*.{webp,png}
  textures/floor_rubber_*.{webp,png}
```

### 2. Sistema de loader (`src/game-app/assets/`)
- `loader.ts`: singleton `GLTFLoader` + `DRACOLoader` (CDN decoder) + `KTX2Loader` opcional.
- `assetRegistry.ts`: mapa `{ id → { url, preload: bool, tier: 'core'|'boss' }}`.
- `useAssets.ts`: hook React que dá Promise/Suspense para um id; cacheia globalmente.
- Boss é tier `boss`, só pré-carrega quando a wave do boss está a 2 ondas de distância (warmup).

### 3. Substituição visual (sem mudar lógica)

**Paredes (`World3D` / `World.tsx`)**:
- Mesmo MAP, mesma colisão.
- Cada célula sólida vira `InstancedMesh` do módulo `wall-a` ou `wall-b` (variação determinística por seed (x,z)).
- Material: PBR com `blue_metal` ou `concrete_wall`, emissive cyan baixo nas faixas (faixas seguem usando o procedural atual por cima — bordas neon ficam).

**Chão**:
- Plano único com `floor_concrete` (Arena Breach) ou `floor_rubber` (Hub). Repete via `texture.repeat`.
- Grid neon procedural fica como overlay shader (não alterado).

**Props decorativos** (Kenney Factory + Cyberpunk Kit):
- Spawn determinístico em pontos vazios do MAP (terminais, barricadas, painéis, hazard stripes, turrets-cosméticas).
- Tudo via InstancedMesh; cap em 60 props por arena.

**Inimigos** (Sci-Fi Essentials):
- Substituir mesh procedural por GLB respectivo no `EnemyMesh`:
  - drone → EyeDrone, quad → QuadShell, swarmer → Trilobite.
- Lógica (HP, IA, drop, dano) permanece intacta.
- Animação procedural já existente (bob, lookAt) aplicada nos objetos do GLB.

**Pickups**:
- Mesh atual substituído pelos GLBs (HealthPack, AmmoBox, KeyCard).
- Rotação/float idle preservados.

**Arma (P-99, M4-A1, KRM-262, DL-Q33)**:
- Opcional: pegar 4 silhuetas do Ultimate Gun Pack que combinem com neon. Manter `Weapon3D` atual como fallback se um GLB falhar.

### 4. Boss dragão

- **Pré-processamento** (offline): 1.27M → 80k tris (`gltf-transform simplify --ratio 0.06 --error 0.01`), textura 4K → 2K WebP.
- **Componente**: `<DragonBoss />` em `src/game-app/components/enemies/DragonBoss.tsx`.
- **Material**: PBR com a textura escamada + emissive mask cyan/magenta vibrando (uniform tempo).
- **Animação procedural** (sem rig):
  - Idle: bob vertical 0.05u, breathing scale 1±0.01.
  - Wing flap: vertex shader desloca vértices da asa (mask por região via UV.x bounds) com sen(t).
  - Cabeça: rotação Y/X do mesh inteiro rastreando player (suave, lerp 0.05).
  - Ataques: VFX externos (cone de fogo neon, shockwave) — mesh fica parado.
- **Fases (3)**: tiros plasma → asas/shockwave → cone de fogo. Hitboxes esféricas (cabeça crit 3x, torso 1x, asas 0.5x).
- **Trigger**: wave 15 (boss único da run). `BossHealthBar` já criada é reutilizada.
- **Lazy load**: só baixa o GLB quando a wave 13 começa.

### 5. Quality tiers (auto-detect)

`src/game-app/game/quality.ts`:
- Detecta GPU via `WebGLRenderer.getContext().getParameter(UNMASKED_RENDERER_WEBGL)`.
- 3 presets:
  - **Low** (default Chromebook/UHD): pixel ratio 1, shadows OFF, props 50%, bloom OFF, anisotropy 1.
  - **Medium**: pixel ratio 1, shadows soft, props 100%, bloom leve.
  - **High**: pixel ratio devicePixelRatio, shadows PCF, props 100%, bloom + SSAO leve.
- Botão no SettingsPanel para forçar manual.

### 6. Validação e fallback

- Cada loader tem try/catch → se GLB falhar, volta pro mesh procedural antigo (mantemos `World3DProcedural` como fallback).
- Testar com throttling de CPU 4x e GPU "low-end" no DevTools.
- Smoke test: rodar 1 partida completa, medir fps médio nas 3 arenas + boss.

## Arquivos novos / tocados

```
NOVO  scripts/assets/build.mjs                (pipeline conversão)
NOVO  src/game-app/assets/loader.ts
NOVO  src/game-app/assets/registry.ts
NOVO  src/game-app/assets/useAsset.ts
NOVO  src/game-app/components/enemies/DragonBoss.tsx
NOVO  src/game-app/game/quality.ts
EDIT  src/game-app/components/game/World.tsx           (InstancedMesh modular)
EDIT  src/game-app/components/game/GameScene.tsx       (quality preset, lazy boss)
EDIT  src/game-app/components/enemies/EnemyMesh.tsx    (usa GLB)
EDIT  src/game-app/components/pickups/PickupMesh.tsx   (usa GLB)
EDIT  src/game-app/components/hud/SettingsPanel.tsx    (quality picker)
EDIT  src/game-app/game/waves.ts                       (wave 15 = boss)
```

Dependências novas: `three/examples/jsm/loaders/{GLTFLoader,DRACOLoader,KTX2Loader}` (já em three), e ferramentas dev `@gltf-transform/cli` + `sharp` (só em `scripts/`, fora do bundle).

## Não vai mudar

ondas, IA de inimigo, tiros, dano, pickups (lógica), upgrades, dificuldade, persistência localStorage, HUD atual, pointer lock, settings (mouse sensitivity/invert).

## Ordem de execução sugerida

1. Pipeline de conversão + commit dos assets otimizados em `public/assets/`.
2. Loader + registry + quality preset.
3. Trocar paredes/chão (visual da arena).
4. Trocar inimigos e pickups.
5. Boss dragão (último, isolado).
6. QA: 1 run completa em modo Low; ajustar.
