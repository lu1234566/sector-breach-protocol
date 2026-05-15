# Pacote de artes — Protocol DOC

Liberdade visual máxima, mas amarrada à identidade do art bible: cyan dominante, magenta acento, amber funcional, danger reativo. Hexágonos/trapézios em vez de cubos. Tom Doom 2016 + Tron Legacy + arcade CoD Mobile.

Tudo gerado por IA, salvo direto em `src/assets/` ou `public/`, integrado nos componentes na mesma rodada. Inclui auditoria visual de cada lote antes de seguir.

---

## Capítulo 1 — Identidade & Menu (5 artes)

| # | Arquivo | Dimensões | Modelo | Conteúdo |
|---|---|---|---|---|
| 1 | `src/assets/key-art-hero.jpg` | 1920×1080 | premium | Operador silhueta contra arena reactor, núcleo magenta pulsando ao fundo, raios cyan, atmosfera densa. Sem texto. Vai virar fundo da landing + og:image. |
| 2 | `public/menu/bg_arena_breach.jpg` | 1920×1080 | standard | Background do MainMenu — arena vista de cima, grid cyan no chão, néon magenta refletido em superfícies metálicas, fog volumétrico, profundidade extrema. |
| 3 | `public/menu/arena_containment.jpg` | 1024×768 | standard | Card thumb arena 1: corredor claustrofóbico, cover hexagonal, faixas magenta-hazard, luz amber no fundo. |
| 4 | `public/menu/arena_reactor.jpg` | 1024×768 | standard | Card thumb arena 2: arena circular, núcleo magenta no centro pit, 4 colunas trapezoidais, anel de luz cyan. |
| 5 | `public/menu/arena_causeway.jpg` | 1024×768 | standard | Card thumb arena 3: corredor longo, paredes de vidro com servidor racks atrás, sniper-perspective, linhas cyan paralelas convergindo. |

**Integração:** substituir o `menu_bg_tactical.jpg` atual; trocar miniaturas procedurais do `ArenaSelect.tsx` pelas 3 thumbs novas; usar key-art como `og:image` no head do `__root.tsx` + opcional como overlay no estado `'start'` do `GameApp`.

---

## Capítulo 2 — Inimigos & Texturas (8 artes)

### Retratos de inimigos (substituem `enemy_mark_*`)
| # | Arquivo | Dimensões | Modelo | Conteúdo |
|---|---|---|---|---|
| 6 | `public/ui/portrait_rusher.png` | 512×512, transparent | standard | Silhueta low/leaning, blade limbs, accent magenta, trail erratico. Retrato 3/4 estilizado. |
| 7 | `public/ui/portrait_rifleman.png` | 512×512, transparent | standard | Boxy soldier, ombros largos, accent cyan, muzzle pre-flash visível. |
| 8 | `public/ui/portrait_sniper.png` | 512×512, transparent | standard | Tall/thin, antenna/visor, accent amber, laser de mira saindo. |
| 9 | `public/ui/portrait_titan.png` | 512×512, transparent | standard | Wide/hunched, core magenta+danger pulsando no peito. Boss final. |

### Texturas 3D (re-skin das atuais)
| # | Arquivo | Dimensões | Modelo | Conteúdo |
|---|---|---|---|---|
| 10 | `public/textures/floor_arena_grid.jpg` | 1024×1024 tileable | standard | Painel de chão hexagonal, linhas cyan emissive, base graphite escuro. |
| 11 | `public/textures/wall_panel_neon.jpg` | 1024×1024 tileable | standard | Parede com painel trapezoidal, faixas magenta-hazard, parafusos amber. |
| 12 | `public/textures/wall_reactor_core.jpg` | 1024×1024 tileable | standard | Variante reactor — gradiente cyan→magenta, ductos, calor visível. |
| 13 | `public/decals/protocol_doc_logo.png` | 512×512, transparent | standard | Logo PROTOCOL DOC para decal de chão/parede dentro do 3D. |

**Integração:** retratos vão pro killfeed expandido + tela de upgrades; texturas substituem `floor_panel_tactical.jpg`/`wall_panel_graphite.jpg` no `World.tsx`; decal vai como `MeshBasicMaterial` em alguns pontos do mapa.

---

## Capítulo 3 — HUD & Telas (9 artes)

### Icon set (substitui Lucide nos pontos onde a marca aparece)
| # | Arquivo | Dimensões | Modelo | Conteúdo |
|---|---|---|---|---|
| 14 | `public/ui/icon_health_neon.png` | 256×256, transparent | fast | Cruz médica estilizada, cyan glow, hexagonal frame. |
| 15 | `public/ui/icon_ammo_neon.png` | 256×256, transparent | fast | Magazine vista lateral, amber accent, neon outline. |
| 16 | `public/ui/icon_credits_neon.png` | 256×256, transparent | fast | Símbolo de crédito tactical, amber dominante. |
| 17 | `public/ui/icon_objective_eliminate.png` | 256×256, transparent | fast | Crosshair magenta + skull stilizado. |
| 18 | `public/ui/icon_objective_hack.png` | 256×256, transparent | fast | Terminal/cpu cyan com waveform. |
| 19 | `public/ui/icon_objective_defend.png` | 256×256, transparent | fast | Núcleo cyan dentro de escudo hexagonal. |
| 20 | `public/ui/icon_objective_extract.png` | 256×256, transparent | fast | Seta apontando pra zona de extração, amber+cyan. |

### Splashes
| # | Arquivo | Dimensões | Modelo | Conteúdo |
|---|---|---|---|---|
| 21 | `src/assets/splash_mission_complete.jpg` | 1920×1080 | premium | Tela final vitória — operador costas, arena pacificada, "MISSION COMPLETE" integrado tipograficamente em cyan. |
| 22 | `src/assets/splash_mission_failed.jpg` | 1920×1080 | premium | Tela final derrota — visão de baixo do operador caído, arena vermelha (`--neon-danger`), "PROTOCOL TERMINATED" magenta+danger. |

**Integração:** icons substituem Lucide no `ObjectivePanel.tsx`, `MainHUD`, `Killfeed`; splashes viram background animado dos estados `'win'` e `'dead'` do `GameApp`.

---

## Workflow de execução

1. **Capítulo 1 (key art + menu)** — gerar 5 imagens em paralelo, integrar, QA visual no preview.
2. **Capítulo 2 (inimigos + texturas)** — gerar 8 imagens, integrar World.tsx + retratos, QA com partida de teste.
3. **Capítulo 3 (HUD + splashes)** — gerar 9 imagens, integrar componentes HUD, QA final.

Em cada capítulo: prompts seguem o art bible (cyan ~60%, magenta ~20%, amber ~15%, danger ~5%; hexágono/trapézio; sem texto exceto onde marcado; identidade Doom 2016 + Tron Legacy).

## Limpeza

Ao final, deletar legados que conflitam com a nova identidade:
- `public/ui/title_nano_banana.png/.webp` (nome proibido).
- `public/menu/menu_bg_tactical.*` se a nova `bg_arena_breach.jpg` ocupar o mesmo papel.
- `public/textures/floor_panel_tactical.*` e `wall_panel_graphite.*` após confirmar substituição funcionando.

## Custos

- 3 imagens premium (key-art + 2 splashes) — alto custo, alto impacto.
- 12 standard (menu, inimigos, texturas, decal) — médio.
- 7 fast (HUD icons) — baixo.

Total: **22 imagens em 3 lotes**.

## Fora desta rodada

- Modelos `.glb` 3D — segue regra do art bible: procedural-only sem upload do usuário.
- Tutorial in-game.
- Trailer / vídeo.
- Refino mobile.
