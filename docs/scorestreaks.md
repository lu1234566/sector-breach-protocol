# Scorestreaks — nota de discrepância + economia real do jogo

## Discrepância com o plano original

O plano de migração assumia um sistema de **scorestreaks** estilo Call of
Duty Mobile: recompensas ativáveis manualmente ao atingir thresholds de
pontos/abates em sequência (ex.: UAV, ataque aéreo, artilharia), com efeitos
temporários e cooldowns próprios.

**Esse sistema não existe no código atual** (`src/game-app`). Não há
`streak`, killstreak counter, nem qualquer mecanismo de "recompensa
ativável por sequência de abates" em nenhum arquivo do jogo. O que existe é
um **loop de wave survival com objetivos por onda e progressão via créditos
permanentes**, documentado abaixo. Se scorestreaks forem um requisito de
design para a versão Unreal, é uma **mecânica nova a projetar do zero**, não
uma extração do jogo atual — deve constar como item novo em `docs/GDD.md`,
não como "port".

## 1. Estrutura de ondas (`waveRef`)

Fonte: `src/game-app/game/systems/useWaveSystem.ts`, `constants.ts`.

- Modo campanha: 6 ondas fixas. Onda 5 = boss (Titan). Onda 6 = extração final.
- Modo endless: ondas 1-5 seguem o mesmo roteiro da campanha; a partir da
  onda 6, entra em rotação infinita (`endlessObjective`): a cada 5ª onda
  (`wave % 5 === 0`) é sempre Titan; das outras, alterna entre
  hackear/defender/eliminar por `wave % 3`.
- Quantidade de inimigos por onda: `count = wave===1 ? 3 : min(3 + wave*2, 24)`
  (cap em 24 para manter jogável em ondas altas).
- Spawn gradual: 1 inimigo a cada 800ms até atingir `count`; se for onda de
  boss, agenda o Titan 4s depois do último spawn regular.

## 2. Objetivos por onda (`objectives.ts`)

| Onda (campanha) | Tipo (`kind`) | Descrição | Parâmetro |
| --- | --- | --- | --- |
| 1 | `eliminate` | Neutralizar hostis | — |
| 2 | `hack` | Hackear nó no centro da arena | Duração 12s (`HACK_DURATION`) |
| 3 | `eliminate` | Neutralizar hostis | — |
| 4 | `defend` | Defender núcleo | Duração 30s, HP do núcleo 500 (`CORE_HP`) |
| 5 | `eliminate` | Titan Protocol (boss) | — |
| 6 | `extract` | Extrair | Limite de tempo 25s, 5 abates mínimos antes de abrir a zona |

Zonas de objetivo (`hack`/`defend`) usam o **centro geométrico da arena**,
ajustado para a célula alcançável mais próxima via BFS (para nunca cair
dentro de geometria selada). Zona de extração usa o **canto oposto ao spawn
do jogador**, com o mesmo ajuste de alcançabilidade.

## 3. Economia de créditos (`GameApp.tsx::endRun`, `persistence.ts`)

- Créditos ganhos ao final da run:
  - Vitória: `floor((kills*15 + wave*100 + score/5 + 1500) * creditMult)`
  - Derrota: `floor((kills*10 + wave*50 + score/10) * creditMult)`
  - `creditMult` vem da dificuldade selecionada (0.9 a 2.4×).
- Pontuação (`score`) por abate: comum 100, rifleman 200, sniper 500, boss 5000.
- Drop de pickup ao abater inimigo: chance base 35% (+5%/nível de upgrade
  `scavenger`), 100% garantido em boss. Tipo aleatório 50/50 entre `health`
  (+25 HP, cap `100 + armorPlating*5`) e `ammo` (+60 reserva, cap
  `120 + ammoReserve*20`).
- Persistência em `localStorage` (`nano_credits`, `nano_upgrades`,
  `nano_weapon_upgrades`, `nano_stats`, `nano_difficulty`, `protocol_arena`)
  — sem backend, tudo client-side.

## 4. Upgrades permanentes (entre runs)

Fonte: `constants.ts::UPGRADES`.

| Upgrade | Efeito por nível | Custo por nível (créditos) | Nível máx. |
| --- | --- | --- | --- |
| `armorPlating` | +5 HP máximo | 100/200/350/500/750 | 5 |
| `ammoReserve` | +20 munição de reserva inicial | 100/200/350/500/750 | 5 |
| `quickReload` | -5% tempo de recarga (global, todas as armas) | 150/300/500/800/1200 | 5 |
| `scavenger` | +5% chance de drop de pickup | 150/300/500/800/1200 | 5 |

Upgrades **por arma** (independentes por `WeaponType`): `damage` (+5%/nível),
`stability` (-5% spread e recuo/nível), `reload` (-4% tempo de recarga
adicional/nível), custo em `WEAPON_UPGRADE_COSTS` (mesmos valores de
150-1200), máximo nível 5 (`MAX_WEAPON_LEVEL`).

## 5. Estatísticas persistentes (`LifetimeStats`)

`totalKills`, `totalDeaths`, `totalCredits`, `bestWave` (recorde campanha,
máx. 6), `bestEndlessWave` (recorde modo endless), `totalWins`, `totalGames`.

## 6. Recomendação para a Unreal

Se o objetivo é fidelidade ao jogo atual: portar este sistema de **ondas +
objetivos + economia de créditos/upgrades** como está, via Data Tables
(CSV/JSON) para as tabelas de upgrade e objetivos por onda. Se scorestreaks
(no sentido CoD Mobile) forem realmente desejados, tratar como **feature
nova**, projetada em `docs/GDD.md` a partir do zero, reaproveitando apenas o
sistema de créditos como possível moeda de desbloqueio.
