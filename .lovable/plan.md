## Problemas e correções

### 1. Inimigos invisíveis

**Causa provável:** após a compressão dos GLBs, o `EnemyMesh.tsx` está substituindo o material original por um `MeshStandardMaterial` novo sem o `map` correto (textura WebP da compressão pode estar em formato que o `source?.map` não devolve), e/ou o `scene.clone(true)` não clona materiais — ao trocar materiais, vários meshes podem ficar com referência inválida.

**Correção:**

- Em `src/game-app/components/game/EnemyMesh.tsx`:
  - Clonar materiais explicitamente (`o.material = o.material.clone()`) antes de modificar, em vez de criar `MeshStandardMaterial` do zero.
  - Em vez de substituir, **boostar** o material existente: subir `emissiveIntensity`, clarear cor se muito escura, manter o `map` original intacto (mesma abordagem que já funciona em `Weapon3D`).
  - Garantir `frustumCulled = false` em meshes pequenos para evitar culling agressivo.
  - Adicionar fallback visível (caixa neon) caso o `useGLTF` falhe — hoje o `Fallback` só aparece no Suspense, não em erro.

### 2. Rifle/assault apontando para o céu

**Causa:** em `WEAPON_MODELS.rifle` a rotação é `[-Math.PI/2, 0, 0]`, que está girando o cano para cima em vez de para frente. O eixo "comprido" do rifle não é Y como assumido.

**Correção:**

- Em `src/game-app/Weapon3D.tsx`, **auto-detectar a orientação** do GLB:
  - Computar a bbox **sem rotação**, pegar o eixo mais longo (X/Y/Z).
  - Gerar a rotação que alinha esse eixo a -Z automaticamente, em vez de depender de tabela manual por arma.
  - Isso resolve rifle, shotgun e sniper de uma vez (qualquer asset novo passa a alinhar sozinho).
- Manter `offset`/`targetLength`/`kickZ` por arma na config.

### 3. Pistola com braços gigantes

O `hideMeshes: /arm/i` está deixando passar — o asset tem os braços bem integrados e mesmo escondendo o mesh `arms_arms_0` o resultado fica ruim. Solução acordada: **trocar o asset**.

**Correção:**

- Aguardar o usuário enviar um novo `pistol.glb` sem braços embutidos.
- Quando chegar: comprimir com `gltf-transform` (mesmo pipeline: WebP 512, Draco, simplify 0.5), substituir `public/assets/weapons/pistol.glb`, remover `hideMeshes` da config.
- Como fallback imediato (antes do novo asset), apertar o filtro para esconder também `hand`, `glove`, `finger`, `forearm`, `wrist` — qualquer mesh que não seja o corpo da arma.

## Arquivos a editar

- `src/game-app/components/game/EnemyMesh.tsx` — preservar material original, fallback de erro.
- `src/game-app/Weapon3D.tsx` — auto-detecção do eixo do cano, regex de hide mais agressivo na pistola.
- `public/assets/weapons/pistol.glb` — substituir quando o usuário enviar o novo asset.

## Ordem de execução

1. Aplicar fix do `EnemyMesh` (inimigos voltam a aparecer).
2. Aplicar auto-orientação no `Weapon3D` (rifle/shotgun/sniper alinham).
3. Apertar filtro temporário da pistola.
4. Quando o novo asset da pistola chegar, comprimir e trocar.
