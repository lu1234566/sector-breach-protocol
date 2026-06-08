# Animated Enemy GLBs

Drop rigged + animated GLBs here using these exact filenames:

- enemy_rusher_animated.glb
- enemy_rifleman_animated.glb
- enemy_sniper_animated.glb
- enemy_titan_animated.glb

The game probes these paths at runtime (HEAD request). If a file exists,
it is preferred over the static GLB in `../`. If clips are missing or
broken, the game automatically falls back to the static GLB + procedural
motion. No code changes required to swap models in/out.

Expected clip names (case-insensitive substring match):
- idle / breathe
- walk / run / move
- attack / shoot / bite / slam
- death / die

Multiple clips per state are fine — the engine picks the first match.
