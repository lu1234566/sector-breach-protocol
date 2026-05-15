# Protocol DOC — Art Bible v0.1

> Identity locked: **Protocol DOC**, neon arena arcade shooter.
> Reference register: Doom (2016) HUD energy + Tron Legacy light language + Call of Duty Mobile arcade pacing.
> All future art, audio and writing must obey this document. If something on screen contradicts it, the screen is wrong.

---

## 1. The brand mark

- Wordmark: `PROTOCOL` in white + `DOC` in the cyan→magenta gradient.
- Never reverse the colors. Never put `PROTOCOL` in the gradient.
- The mark is typographic, never an illustration. No logo image required.
- Tagline: **Arena Combat Protocol** (always uppercase, letter-spacing 0.5em).
- Names that are now forbidden in UI/copy: *Nano Banana*, *Tactical Wave Shooter*, *DOC: Sector Breach*. They were exploration drafts and have been retired.

## 2. Color tokens (single source of truth)

Defined in `src/styles.css`. Always use these via Tailwind / CSS vars — never hardcode hex.

| Token              | Role                                  |
| ------------------ | ------------------------------------- |
| `--neon-cyan`      | Primary HUD, "live" state, friendly readouts |
| `--neon-magenta`   | Secondary accent, DOC mark, augments  |
| `--neon-amber`     | Credits, ammo, pickups                |
| `--neon-danger`    | Damage, low HP, hostile alerts        |
| `--arena-bg`       | Base canvas behind the 3D scene       |
| `--arena-panel`    | HUD panels (with backdrop blur)       |
| `--arena-grid`     | Faint cyan tactical grid background   |
| `--gradient-doc`   | Reserved for the DOC mark only        |

Rules:
- Cyan is the dominant color (~60% of HUD weight).
- Magenta is an accent (~20%) — never used for body text or large fills.
- Amber is functional (~15%) — only on numeric/economy elements.
- Danger red is reactive (~5%) — appears only when the player is hit, low, or warned.

## 3. Tone of voice

- Short, mechanical, present tense. The arena is alive and observing you.
- "Arena Live", "Arena Reload", "Wave Inbound", "Augment Online".
- Never use marketing fluff like "Tactical Superiority Required" or "System Integrity: OPTIMAL". If a line doesn't tell the player what to do or what changed, cut it.

## 4. World / fiction (one paragraph)

> A black-site arena nicknamed **DOC** runs continuous combat protocols on its operators. Each wave is a contained breach event. Augments are scavenged from defeated targets and slotted between waves. There is no extraction. There is only the next wave and a higher leaderboard.

This is the only canon. Do not invent biological / banana / lab fiction.

## 5. Enemies — silhouette + color rules

| Class    | Silhouette intent             | Accent color    | Telegraph                   |
| -------- | ------------------------------ | --------------- | --------------------------- |
| Rusher   | Low, leaning forward, blade limbs | Magenta         | Erratic zig-zag, bright trail |
| Rifleman | Boxy soldier shoulders, mid-height | Cyan          | Muzzle pre-flash             |
| Sniper   | Tall, thin, antenna/visor       | Amber           | Visible aim laser before shot |
| Titan    | Wide, hunched, glowing core     | Magenta + danger | Core flares before each phase |

Enemies must be readable as silhouettes against the arena bg before any color or detail is processed. If the silhouette test fails, the model fails.

## 6. Maps — three arenas, one language

All three arenas share: cyan grid floor accents, magenta hazard stripes, amber emergency lights, hexagonal/trapezoidal modules (no plain cubes).

1. **Containment Block** — claustrophobic, short sightlines, lots of cover.
2. **Reactor Ring** — circular, central pit, vertical hazards.
3. **Server Causeway** — long sightlines, sniper-friendly, glass walls.

## 7. Motion language

- HUD elements appear with a 120ms cyan flash, never a slow fade.
- Hits push a 60ms danger vignette from the impact direction.
- Kill confirms snap a magenta crosshair pulse — no soft sparkles.
- Menus use scale 0.96→1 + 200ms cyan glow ramp. No purple, no rainbow.

## 8. What this rebrand explicitly did NOT change yet

This pass only fixed identity. Still on the backlog (in priority order):
1. Replace primitive 3D geometry with stylized neon-arena models.
2. Trim HUD density (remove duplicate top-bar info).
3. Real audio files replacing oscillator SFX.
4. Per-wave events / objectives beyond "kill all".
5. Boss phases.
6. Refactor `GameApp.tsx` into systems.

When working on any of the above, this document is the constraint — not a suggestion.
