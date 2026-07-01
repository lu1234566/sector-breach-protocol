# EDITOR_TODO — o que só dá para fazer com a Unreal Editor aberta

Este projeto (`game-unreal/`) foi escrito inteiramente em C++/CSV/`.ini` numa
máquina sem GPU e sem a Unreal Engine instalada — **nunca foi aberto na
Editor nem compilado contra a Engine real**. Este documento lista, em ordem
de dependência, tudo que só é possível fazer numa máquina com Unreal Engine
5.5 + GPU (Fase 1+ do plano de migração).

## 0. Primeira abertura / primeira build (bloqueante para tudo abaixo)

1. Abrir `ProtocolDOC.uproject` na Unreal Editor 5.5. Ela vai gerar os
   arquivos de projeto do Visual Studio/Rider automaticamente.
2. Compilar o módulo `ProtocolDOC` (Development Editor). **Esperar erros de
   API** — todo arquivo `.h`/`.cpp` novo tem um comentário no topo avisando
   disso. Pontos de maior risco, em ordem de suspeita:
   - `UEnhancedInputComponent::BindAction` com argumentos extra vinculados
     (`DOCCharacter.cpp::SetupPlayerInputComponent`, troca de arma 1-4) —
     confirmar a assinatura exata do template `Vars...` na 5.5.
   - `TargetRules` (`BuildSettingsVersion`, `EngineIncludeOrderVersion`) em
     `ProtocolDOC.Target.cs`/`ProtocolDOCEditor.Target.cs` — nomes de enum
     mudam ocasionalmente entre versões de engine.
   - `AAIController::MoveToLocation` assinatura exata (ordem/nomes dos
     parâmetros) em `DOCEnemyAIController.cpp`.
   - Includes de `DrawDebugHelpers.h`, `TimerManager.h` etc. — confirmar que
     nenhum header extra é necessário.
3. Depois que compilar limpo, seguir para as seções abaixo.

## 1. Data Tables (bloqueante para qualquer teste de gameplay)

Os balanceamentos já estão prontos como CSV em `Data/CSV/` com os valores
exatos extraídos do jogo web (ver `docs/sistemas-a-portar.md`,
`docs/bots-ia.md`, `docs/scorestreaks.md`). Para cada CSV, criar o Data
Table correspondente na Editor (botão direito em `Content/` → Miscellaneous
→ Data Table → escolher a struct):

| CSV | Struct | Nome sugerido do asset |
| --- | --- | --- |
| `Data/CSV/Weapons.csv` | `FDOCWeaponData` | `DT_Weapons` |
| `Data/CSV/EnemyTypes.csv` | `FDOCEnemyData` | `DT_EnemyTypes` |
| `Data/CSV/Difficulties.csv` | `FDOCDifficultyData` | `DT_Difficulties` |
| `Data/CSV/WaveObjectives.csv` | `FDOCWaveObjectiveData` | `DT_WaveObjectives` |
| `Data/CSV/Upgrades.csv` | `FDOCUpgradeData` | `DT_Upgrades` |
| `Data/CSV/WeaponUpgradeConfig.csv` | `FDOCWeaponUpgradeConfigData` | `DT_WeaponUpgradeConfig` |

Depois de criados, atribuir cada Data Table ao campo correspondente nos
Blueprints/defaults de `UDOCWeaponComponent`, `ADOCEnemyCharacter`,
`UDOCWaveManagerComponent`, `UDOCObjectiveComponent` e
`UDOCEconomySubsystem`.

Ao reimportar um CSV depois de editar um valor de balanceamento, lembrar de
atualizar o CSV-fonte em `Data/CSV/` também (fonte da verdade) e o documento
correspondente em `docs/` (regra do AGENTS.md).

## 2. Enhanced Input assets

`ADOCCharacter` referencia (`Player/DOCCharacter.h`) os seguintes ponteiros
que precisam apontar para assets criados na Editor, em `Content/Input/`:

- 1x Input Mapping Context (`IMC_Default`)
- Input Actions: `IA_Move` (Axis2D), `IA_Look` (Axis2D), `IA_Sprint`
  (bool), `IA_Fire` (bool), `IA_Aim` (bool), `IA_Reload` (bool),
  `IA_SwitchWeapon1..4` (bool), `IA_Pause` (bool)
- Mapear `IA_Move` em WASD, `IA_Look` em Mouse XY, etc. — esquema completo
  em `docs/controles-touch.md`.
- Atribuir os assets nos campos `EditDefaultsOnly` do character (Blueprint
  derivado de `ADOCCharacter`, ou default do próprio C++ class via Class
  Defaults).
- Controles touch/mobile: **não existem ainda** nem no jogo web nem aqui —
  é design novo, ver `docs/controles-touch.md` #3, a fazer só depois do
  esquema desktop estar validado.

## 3. Level blockout

Nenhum `.umap` foi criado (binário, fora de escopo sem Editor). Para cada
uma das 3 arenas documentadas em `docs/sistemas-a-portar.md` #5:

1. Criar o nível (`Containment Block`, `Reactor Ring`, `Server Causeway`).
2. Fazer o blockout usando a topologia lógica da grid como referência
   (célula de parede = bloco, célula de chão = piso, célula 2 = porta/
   cobertura baixa, célula 3 = barril) — a malha final não precisa ser 1:1
   com o grid, é só o ponto de partida.
3. Adicionar um `NavMeshBoundsVolume` cobrindo a área navegável (necessário
   para `AAIController::MoveToLocation` em `DOCEnemyAIController`).
4. Posicionar marcadores de spawn de inimigo (qualquer `AActor` — um
   `TargetPoint` serve) com a tag `DOCEnemySpawnPoint` (configurável em
   `UDOCWaveManagerComponent::EnemySpawnPointTag`), replicando os
   `spawnPoints` de `arenas.ts`.
5. Posicionar um ator marcado com a tag correspondente para cada zona de
   objetivo usada nesse mapa: `ObjectiveZone_Hack`, `ObjectiveZone_Defend`,
   `ObjectiveZone_Extract` (ver `Data/CSV/WaveObjectives.csv`, coluna
   `ZoneTag`). **Nota:** isso substitui o cálculo por BFS de
   `objectives.ts` (que só faz sentido sobre uma grid lógica) — a posição
   dessas zonas agora é uma decisão de level design manual, não calculada
   em runtime. Ver `docs/GDD.md` #7 e o comentário no topo de
   `GameMode/DOCObjectiveComponent.h`.
6. Definir `GameDefaultMap`/mapa de start em `Config/DefaultEngine.ini`
   (`[/Script/Engine.Engine]`, campos deixados em branco de propósito).
7. Configurar `ADOCGameMode` (ou uma subclasse Blueprint) como GameMode
   padrão do nível/projeto, com `EnemyCharacterClass` e as 6 Data Tables
   atribuídas.

## 4. Meshes, materiais, texturas, animações, som

Nada disso existe ainda (não é possível criar `.uasset` sem Editor).
Seguir a identidade visual travada em `docs/art-bible.md`:

- Malhas placeholder (formas primitivas) para personagem, armas e
  inimigos (silhuetas descritas em `docs/art-bible.md` #5) até haver arte
  final.
- Materiais seguindo a paleta de tokens (`--neon-cyan` etc., seção 2 do art
  bible) seguindo a mesma proporção de uso (~60% cyan, ~20% magenta, ~15%
  âmbar, ~5% vermelho reativo).
- Anim Blueprint mínimo para o personagem (idle/walk/sprint/ADS) e para os
  inimigos (idle/move/attack/death), acionado a partir dos estados já
  expostos em `ADOCCharacter`/`ADOCEnemyCharacter`/`ADOCEnemyAIController`
  (`CurrentState`, `bIsAiming`, `bIsDead` etc.).
- Efeitos de impacto/tiro/morte via Niagara (substituem os decais/partículas
  2D do jogo web) e Sound Cues para tiro/recarga/passos/dano — nenhum áudio
  existe ainda no projeto Unreal.
- Anim Notify para o disparo real de linha de visão do melee (rusher) e
  para sincronizar o SFX de tiro com a cadência de cada arma.

## 5. HUD (Widget Blueprint)

Nenhum widget existe. Precisa de pelo menos:

- HUD em jogo: HP, munição (mag/reserva), onda atual, objetivo ativo +
  progresso/timer (ler de `UDOCObjectiveComponent::Runtime`), créditos
  ganhos na run.
- Deploy Screen: seleção de dificuldade/modo (campanha vs endless) e arena,
  chamando `ADOCGameMode::StartRun`.
- Tela de upgrades (loja): ler `UDOCEconomySubsystem::GetUpgradeLevel` /
  `GetWeaponUpgradeLevel`, chamar `TryPurchaseUpgrade` /
  `TryPurchaseWeaponUpgrade`.
- Tela de fim de run: bind em `ADOCGameMode::OnRunEnded`, mostrar créditos
  finais (chamando `UDOCEconomySubsystem::ApplyRunEndCredits` a partir
  desse evento) e estatísticas de vida (`LifetimeStats` via
  `UDOCSaveGame`).
- Indicador de dano direcional, killfeed, hit marker — presentes no jogo
  web (`docs/sistemas-a-portar.md`), sem equivalente C++ ainda: são
  puramente apresentação, ficam melhor como Widget Blueprint reagindo a
  delegates já expostos (`ADOCEnemyCharacter::OnDeath`,
  `UDOCWaveManagerComponent::OnEnemyKilled`, etc.) do que uma nova classe
  C++.

## 6. Pendências de gameplay deixadas como simplificação explícita

Marcadas com comentários "NOTE"/"Simplificação" no código-fonte — revisar
depois que houver nível real para testar:

- `DOCObjectiveComponent.cpp`: progresso do objetivo `Hack` só avança com o
  jogador dentro da zona; `Defend` sobrevive o timer sem dano real ao
  núcleo (`ApplyCoreDamage` existe mas nada chama ainda — precisa de
  inimigos mirando no ator do núcleo, o que por sua vez precisa desse ator
  existir no nível).
- `DOCEnemyAIController.cpp`: linha de visão é checada uma vez por tick e
  reaproveitada tanto para movimento quanto para decidir se atira (o jogo
  web faz 2 checagens separadas no mesmo tick).
- Portas (`cell===2`) e barris explosivos (`cell===3`) do jogo web não têm
  equivalente aqui — dependiam da grid lógica sendo também a geometria
  renderizada. Precisa de atores dedicados (porta que abre ao contato,
  barril destrutível) se essa mecânica for mantida no remake.
- `ADOCCharacter` não tem delegate de morte ainda; `ADOCGameMode::Tick`
  faz polling de `CurrentHP` como solução temporária.
- Pickups (health/ammo) não têm ator próprio — `UDOCEconomySubsystem::GetPickupDropChance()`
  calcula a chance mas nada spawna ou coleta um pickup ainda.
- Nomes de linha de Data Table (`"Pistol"`, `"Rifle"` etc.) estão
  duplicados como uma função helper em 3 arquivos `.cpp` diferentes
  (`DOCWeaponComponent`, `DOCWaveManagerComponent`/`DOCEnemyCharacter`,
  `DOCEconomySubsystem`) — considerar consolidar num único header utilitário
  depois que o projeto compilar, para não editar 3 lugares a cada mudança.

## 7. Testes de gameplay

Só depois de tudo acima:

1. Play-in-Editor num blockout com pelo menos 1 arena completa.
2. Validar sensação de movimento/ADS/sensibilidade contra
   `docs/controles-touch.md` (os valores foram convertidos de "unidades por
   tick a 60Hz" do jogo web para uu/s — conferir se a escala 1 unidade
   antiga = 1 uu ficou boa ou precisa de um fator de conversão diferente,
   ver notas em `Data/CSV/EnemyTypes.csv` e `DOCCharacter.h`).
3. Validar as 4 armas contra `docs/sistemas-a-portar.md` #1 (dano, cadência,
   recarga, alcance, spread, especialmente o shotgun com 8 pellets).
4. Validar a progressão de onda completa (1 a 6, campanha) e pelo menos uma
   rotação endless (ondas 7-10).
5. Validar a loja de upgrades (custo, nível máximo, efeito aplicado).
