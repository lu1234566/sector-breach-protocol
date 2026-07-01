# GDD — Protocol DOC (Unreal Engine remake) — rascunho v0.1

> Rascunho da Fase 0. Consolida `docs/sistemas-a-portar.md`,
> `docs/bots-ia.md`, `docs/scorestreaks.md`, `docs/controles-touch.md` e
> `docs/art-bible.md` num documento de design único, já pensando no jogo
> como um FPS 3D real na Unreal (câmera, colisão e iluminação reais — não
> sprites raycasted). Este é um documento vivo: atualizar a cada mudança de
> regra de jogo.

## 1. Identidade e escopo

- **Nome**: Protocol DOC. Tagline: "Arena Combat Protocol".
- **Gênero**: FPS arcade de sobrevivência por ondas (wave survival), 3 arenas
  fechadas, progressão por créditos/upgrades entre runs.
- **Referências**: Doom (2016) energia de HUD, Tron Legacy linguagem de luz,
  Call of Duty Mobile ritmo arcade (ver `docs/art-bible.md`).
- **Importante**: a versão web atual já é 3D real (Three.js/WebGL), não um
  raycaster. A migração para Unreal é uma reconstrução de engine (React/Three
  → C++/Unreal), não uma tradução de renderização 2.5D → 3D. Ver
  `docs/sistemas-a-portar.md` §0 para o detalhe completo dessa correção de
  premissa.

## 2. Core loop

1. Jogador entra numa arena (Deploy Screen → seleção de dificuldade/arena).
2. Sobrevive a ondas sequenciais, cada uma com um objetivo (eliminar, hackear,
   defender, extrair — ver §5).
3. Ao fim da run (vitória ou morte), ganha créditos com base em abates, onda
   alcançada e pontuação.
4. Entre runs, gasta créditos em upgrades permanentes (globais e por arma).
5. Modo campanha (6 ondas fixas, culminando em extração) ou modo endless
   (rotação infinita de objetivos após a onda 5).

## 3. Personagem do jogador

- Movimento: WASD, 4 unidades/tick base, 6 com sprint (`Shift`).
- Câmera: yaw livre, pitch atualmente limitado a ±25° no jogo web (revisitar
  esse limite na Unreal — pitch livre é trivial num engine 3D real e pode
  melhorar o combate vertical).
- ADS (mirar): reduz spread/recuo, reduz velocidade de movimento em até 50%,
  câmera menos sensível durante a mira.
- Vida: 100 HP base (+5 por nível de `armorPlating`, máx. nível 5 → 125 HP).
- Colisão: no jogo web é AABB simplificado contra grid; na Unreal, usar
  cápsula de colisão padrão do `Character` + `NavMesh` para os bots.

## 4. Armas

Ver `docs/sistemas-a-portar.md` §1 para a tabela completa (dano, cadência,
recarga, alcance, spread, recuo) das 4 armas: P-99 (pistol), M4-A1 (rifle),
KRM-262 (shotgun), DL-Q33 (sniper). Reaproveitar os valores como Data Table
de armas na Unreal. Mudanças esperadas ao migrar:

- Substituir o raycast em grid por **line trace real** da Unreal
  (`UWorld::LineTraceSingleByChannel`), preservando a mesma lógica de cone de
  acerto e ausência de penetração.
- Iluminação e partículas de impacto (Niagara) substituem os decals/partículas
  2D atuais.

## 5. Bots e IA

Ver `docs/bots-ia.md`. 3 tipos regulares (rusher/rifleman/sniper) + 1 boss
(titan a cada 5ª onda). Migrar a árvore de decisão documentada para uma
**Behavior Tree + Blackboard**, substituindo o grid de navegação manual por
`NavMesh`/EQS nativos da Unreal.

## 6. Ondas, objetivos e economia

Ver `docs/scorestreaks.md` (nota: sistema real é wave/objetivo/créditos, não
scorestreaks estilo CoD Mobile — ver discrepância documentada lá). Portar como
Data Table de objetivos por onda + tabela de upgrades (globais e por arma).

## 7. Mapas

3 arenas lógicas em grid (`docs/sistemas-a-portar.md` §5): Containment Block
(cyan, cobertura densa), Reactor Ring (magenta, arena aberta com núcleo
central), Server Causeway (amber, corredor longo). Na Unreal:

- A topologia (grid de células) pode servir de **blockout inicial**
  (célula → módulo/tile), acelerando o greybox.
- Objetivos precisam continuar validando alcançabilidade (usar `NavMesh`
  reachability em vez do BFS manual sobre a grid).
- Geometria final deve seguir a linguagem visual do `docs/art-bible.md`
  (piso com grid cyan, faixas de perigo magenta, luzes de emergência âmbar,
  módulos hexagonais/trapezoidais — nunca cubos simples).

## 8. Controles

Ver `docs/controles-touch.md`. Esquema atual é **desktop only** (teclado +
mouse). Não há controles touch para portar — se mobile for meta da versão
Unreal, desenhar esquema novo com Enhanced Input (Fase 3).

## 9. Iluminação e câmera (mudanças específicas de ir para 3D real)

- O jogo web já usa iluminação Three.js (luzes emissivas, cor por arena);
  reconstruir como iluminação dinâmica real da Unreal (Lumen/luzes
  dinâmicas), respeitando a paleta de `docs/art-bible.md` (cyan dominante
  ~60%, magenta ~20%, âmbar ~15%, vermelho de dano ~5%, reativo).
- Colisão de câmera com geometria: usar `SpringArm`/câmera FPS nativa da
  Unreal em vez de lógica de colisão manual.

## 10. Fora de escopo desta Fase 0

- Nenhum arquivo de projeto Unreal (`.uproject`, `.uasset`) é criado nesta
  etapa — apenas documentação (conforme instrução explícita do plano).
- Scorestreaks estilo CoD Mobile, se desejados, entram como design novo, não
  como item extraído (não existiam no jogo original).
- Esquema de controles touch, se desejado, entra como design novo pela mesma
  razão.

## 11. Próximos passos (Fase 1+)

1. Validar infraestrutura remota com GPU (Vagon/AirGPU/Shadow — ver plano
   original §1).
2. Criar projeto Unreal a partir do template First Person.
3. Prototipar o core loop mínimo: personagem FPS, 1 arma funcional, 1 bot
   com Behavior Tree básica, 1 mapa de blockout (ver plano original, Fase 2).
