# Controles — nota de discrepância + esquema atual (desktop)

## Discrepância com o plano original

O plano de migração assumia um esquema de **controles touch para mobile**
(botões virtuais, joystick, sensibilidade/deadzone de toque) já existente no
jogo atual, a ser extraído e portado.

**Esse esquema não existe no código atual.** Busca por `touch`,
`ontouchstart`, `Joystick`, `deadzone` em `src/game-app` não retorna nenhum
resultado relevante de gameplay. O único hook relacionado a mobile é
`src/hooks/use-mobile.tsx` (`useIsMobile`), que apenas expõe um booleano de
breakpoint (`< 768px`) para ajustar **layout responsivo da UI** (menus, HUD)
— não implementa nenhum input de toque para jogar.

O jogo atual roda **exclusivamente com teclado + mouse**, usando a Pointer
Lock API do navegador. Se controles touch forem um requisito para a versão
Unreal (ex.: visando mobile/Android via Unreal), é um **esquema a ser
projetado do zero** na Fase 3, não uma extração — ver seção 3.

## 1. Esquema de input atual (desktop)

Fonte: `src/game-app/game/systems/useInputSystem.ts`, `GameApp.tsx` (loop de
movimento), `src/game-app/game/settings.ts`.

| Ação | Input |
| --- | --- |
| Mover (frente/trás/strafe) | `W` `A` `S` `D` |
| Correr (sprint) | `Shift` (segurar) |
| Olhar (yaw/pitch) | Movimento do mouse (requer Pointer Lock ativo) |
| Atirar | Botão esquerdo do mouse (segurar, se arma for automática) |
| Mirar (ADS) | Botão direito do mouse OU tecla `C` (segurar) |
| Recarregar | `R` |
| Trocar de arma | `1` `2` `3` `4` (pistol/rifle/shotgun/sniper) |
| Pausar | `Esc` |
| Ativar Pointer Lock | Clique dentro da área de jogo (se não estiver travado) |

## 2. Parâmetros de câmera e movimento

- Sensibilidade do mouse: `mouseSensX` / `mouseSensY`, multiplicadores
  independentes (default 1.0, clamp 0.1–5.0), persistidos em
  `localStorage` (`GameSettings`).
- Inversão de eixo: `invertX` / `invertY` (booleanos independentes).
- Sensibilidade base do yaw: `0.002` (normal) ou `0.001` (durante ADS —
  câmera mais lenta ao mirar). Sensibilidade base do pitch: `0.1`.
- Pitch (olhar cima/baixo) é **clampado em ±25 graus** — não é um FPS de
  pitch livre completo, é uma limitação deliberada (`clamp(pitch, -25, 25)`).
- Velocidade de movimento: `4` unidades/tick normal, `6` ao segurar `Shift`;
  reduzida em até 50% durante ADS (`* (1 - adsProgress * 0.5)`), com rampa
  suave de entrada/saída de mira (`adsProgress` sobe/desce 0.1/tick).
- Não há deadzone (não é analógico) — todo input de movimento é digital
  (tecla pressionada/solta).

## 3. Recomendação para a Unreal (se mobile/touch for meta)

Não há esquema legado para portar; a Fase 3 do plano precisa **desenhar do
zero** um esquema touch usando **Enhanced Input** da Unreal, sugerindo como
ponto de partida (mantendo paridade de sensação com o desktop atual):

- Joystick virtual esquerdo (movimento, digital ou analógico com deadzone
  configurável — decisão de design nova).
- Área de arraste direita para look (yaw/pitch), replicando sensibilidade
  configurável e o clamp de pitch de ±25° observado no jogo atual (ou
  revisitar esse limite agora que a Unreal permite pitch livre real).
- Botão de fogo, botão de ADS (hold), botão de recarga, seletor de arma
  (troca entre 4 slots).
- Reaproveitar os multiplicadores de sensibilidade e a opção de inversão de
  eixo Y já existentes em `GameSettings` como base do menu de opções.
