# Bots / IA — Protocol DOC

Fonte primária: `src/game-app/game/systems/enemyAI.ts` (tick por frame),
`src/game-app/GameApp.tsx` (spawn), `src/game-app/game/constants.ts` (`DIFFICULTIES`).

## 1. Tipos de inimigo

| Tipo (`type`) | Papel | HP base (onda 1, dificuldade normal) | Velocidade base | Dano por tiro (base) | Cadência de tiro | Distância-alvo (`targetDist`) | Alcance de disparo | Melee? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `rusher` | Avanço agressivo, ataque corpo-a-corpo | 60 | 3.5 | 14 | 1100 ms | 80 | 110 (só ataca em contato) | Sim — sem tracer, som de "hit" |
| `rifleman` | Combate a média distância | 100 | 2.0 | 12 | 900 ms | 320 | 1200 | Não |
| `sniper` | Mantém distância, dano alto | 80 | 1.5 | 35 | 3000 ms | 600 | 1200 | Não |
| `titan` (boss) | Boss de onda, todos os multiplicadores | HP-base-rifleman × 20 | 0.7× velocidade normal | dano-base × 2.5 | 600 ms (fixo, não usa tabela acima) | usa lógica de `rifleman` para tipo interno | 1200 | Não |

HP e velocidade escalam por onda: `hpBuff = 1 + (wave-1)*0.15`,
`speedBuff = min(1 + (wave-1)*0.04, 1.6)` (cap para não ultrapassar o jogador
em waves altas de modo endless).

Dificuldade (`DIFFICULTIES`) multiplica HP e dano globalmente:

| Dificuldade | HP mult | Dano mult | Créditos mult |
| --- | --- | --- | --- |
| Recruit | 0.75 | 0.75 | 0.90 |
| Normal | 1.00 | 1.00 | 1.15 |
| Veteran | 1.25 | 1.15 | 1.60 |
| Nightmare | 1.60 | 1.40 | 2.40 |

## 2. Máquina de estados (implícita, data-driven)

O código não nomeia estados explicitamente, mas o comportamento por frame
segue esta árvore de decisão (`tickEnemyAI`, executado para cada inimigo vivo
a cada tick):

```
1. Calcular distância e ângulo até o jogador.
2. Calcular linha de visão (LOS) via raycast em grid (checkLineOfSightInfo).

3. SE tem LOS:
   a. Comparar distância atual com targetDist do tipo:
      - dist > targetDist + 16  → avançar em direção ao jogador
      - dist < targetDist - 32  → recuar (afastar-se)
      - caso contrário          → manter distância (holding)
   b. SE dist < 150 → adicionar componente de "strafe" (flanqueio lateral,
      perpendicular à linha de tiro, 70% da velocidade).
   c. Detecção de "preso" (stuck): se tentou mover mas deslocou <0.1 unidade
      por >60 frames, força um movimento perpendicular de fuga; reset aos
      120 frames.
   d. Verificar se pode atirar:
      - Não pode atirar durante "grace period" inicial da partida
        (INITIAL_GRACE_PERIOD).
      - Cooldown por inimigo: now - lastShot > fireRate (varia por tipo,
        buff de 1.5x na onda 1 para dar respiro ao jogador).
      - Cooldown global na onda 1: inimigos não atiram em conjunto
        (<1000ms entre tiros de QUALQUER inimigo) — suaviza a onda de entrada.
      - Alcance: dist < 110 (melee) ou dist < 1200 (à distância).
      - Re-checa LOS no momento exato do tiro (pode ter mudado desde o passo 2).
   e. SE todas as condições batem → dispara: aplica dano ao jogador (com
      damage-reduction global se DEBUG_SAFE_MODE), cria tracer visual (exceto
      melee), toca som, screen shake proporcional ao dano, indicador de dano
      direcional na HUD.

4. SE NÃO tem LOS (bloqueado por parede):
   a. Usa um grid de navegação pré-computado por onda (`navGridRef`, valores
      de distância tipo flow-field/BFS a partir do jogador) para escolher a
      célula vizinha (8-direções) com menor distância registrada.
   b. Move-se em direção ao centro dessa célula.
   c. Fallback: se não há navGrid disponível na posição atual, move-se
      diretamente na direção do jogador (ignorando paredes até colidir).

5. Resolução de colisão de movimento: tenta mover em X e Y separadamente
   contra a grid do mapa; portas (cell===2) abrem permanentemente ao serem
   tocadas por um inimigo (viram cell===0).

6. Passo de separação (soft push) pós-movimento: todos os pares de inimigos
   vivos são testados por sobreposição (raio 24, ou 44 se boss); se
   sobrepostos, empurra ambos para fora proporcionalmente, respeitando
   células livres.
```

## 3. Parâmetros de dificuldade / tuning por onda

- `WAVE_1_DAMAGE_MULT`: reduz dano recebido na primeira onda (tutorial suave).
- `INITIAL_GRACE_PERIOD`: nenhum inimigo atira nos primeiros instantes da run.
- Todo inimigo tem `nextShotAt` (spawn + delay aleatório até 2s) e um mínimo de
  1500-3000ms pós-spawn antes do primeiro tiro (`canShoot`), evitando "spawn
  kill" instantâneo.
- Onda de boss: a cada 5ª onda (`wave % BOSS_WAVE === 0`, `BOSS_WAVE = 5`),
  spawna 1 `titan` após spawnar os inimigos regulares da onda, com um delay
  de 4s e retry se o jogo estiver pausado/em tela de deploy.

## 4. Recomendações para a Unreal (Fase 2/3)

- O comportamento acima mapeia bem para uma **Behavior Tree** com 3 estados
  reais (`Approach`, `Hold/Kite`, `Navigate-to-LOS`) + um serviço de
  cooldown de tiro + um EQS query para achar pontos de flanqueio.
- O flow-field de navegação (`navGridRef`) pode ser recriado com o
  **NavMesh** nativo da Unreal (`AIController::MoveToLocation`) em vez de um
  grid manual — simplifica bastante o port.
- Preservar a lógica de "grace period" + cooldown global na onda 1 como
  parâmetros de `BTService`/`GameMode`, não hardcoded na IA.
