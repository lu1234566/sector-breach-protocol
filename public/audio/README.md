# Audio drop-in (Protocol DOC)

O `SoundEngine` carrega automaticamente qualquer arquivo MP3 colocado aqui.
Se faltar, ele cai no oscilador antigo. Sem mudar código.

## SFX (15 arquivos)

| Arquivo | Prompt sugerido (ElevenLabs Sound Effects, 0.5–1.5s) |
| --- | --- |
| `pistol_shot.mp3` | "sci-fi energy pistol shot, sharp dry crack with cyan plasma snap, short tail" |
| `rifle_shot.mp3` | "futuristic assault rifle single shot, mid-weight punch with metallic plasma whine" |
| `shotgun_shot.mp3` | "heavy sci-fi shotgun blast, deep boom with magenta energy roar, short reverb" |
| `sniper_shot.mp3` | "high-power sci-fi sniper rifle, deep crack with long plasma decay and amber whine" |
| `reload_short.mp3` | "futuristic magazine click and energy cell snap-in, mechanical, 0.6s" |
| `reload_long.mp3` | "heavy sci-fi reload sequence, slide pull, magnetic clamp, energy cell hum, 1.2s" |
| `enemy_hit.mp3` | "sharp metallic plasma impact on armored robot, short cyan zap" |
| `enemy_death.mp3` | "sci-fi robot collapse, breaking metal panels with neon glitch and short electric fizz" |
| `pickup_health.mp3` | "positive sci-fi medical pickup chime, ascending soft synth, calm cyan tone" |
| `pickup_ammo.mp3` | "ammo magazine snap pickup, mechanical click with bright amber LED beep" |
| `ui_click.mp3` | "minimal HUD click, tiny crisp cyan blip, 60ms" |
| `ui_error.mp3` | "low denied buzz, dry square wave with magenta distortion" |
| `wave_start.mp3` | "tactical alert horn, two-tone sci-fi siren rising, magenta then cyan, 1.5s" |
| `boss_roar.mp3` | "massive industrial mech roar with deep magenta plasma surge, 2s" |

## Música (3 loops, ~60s)

| Arquivo | Prompt sugerido (ElevenLabs Music) |
| --- | --- |
| `menu_theme.mp3` | "cold sci-fi synthwave loop, slow 90 BPM, dark cyan pads, distant magenta arpeggio, no drums on intro, becomes pulsing on second half, futuristic arena lobby" |
| `combat_loop.mp3` | "aggressive cyberpunk drum and bass, 140 BPM, distorted neon synths, magenta lead, pumping bass, action shooter combat" |
| `boss_theme.mp3` | "industrial sci-fi boss battle, 120 BPM, heavy distorted brass and detuned synths, pounding drums, magenta and amber tonal palette" |

## Como gerar

Opção 1 — manualmente em [elevenlabs.io/sound-effects](https://elevenlabs.io/sound-effects)
e [elevenlabs.io/music](https://elevenlabs.io/app/music). Salve cada arquivo
com o nome exato da tabela aqui em `public/audio/`.

Opção 2 — peça pra eu montar o script + server route automatizado;
para isso preciso adicionar o secret `ELEVENLABS_API_KEY` (Lovable Cloud).
