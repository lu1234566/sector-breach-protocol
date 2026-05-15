/**
 * Generate Protocol DOC audio assets via ElevenLabs.
 * Run: bun run scripts/generate-audio.ts
 * Requires env: ELEVENLABS_API_KEY
 *
 * Idempotent: skips files that already exist.
 */

import { writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("ELEVENLABS_API_KEY is not set");
  process.exit(1);
}

const OUT_DIR = "public/audio";

type Sfx = { name: string; prompt: string; duration: number };
type Music = { name: string; prompt: string; duration: number };

const SFX: Sfx[] = [
  { name: "pistol_shot", prompt: "sci-fi energy pistol shot, sharp dry crack with cyan plasma snap, short tail", duration: 0.8 },
  { name: "rifle_shot", prompt: "futuristic assault rifle single shot, mid-weight punch with metallic plasma whine", duration: 0.8 },
  { name: "shotgun_shot", prompt: "heavy sci-fi shotgun blast, deep boom with magenta energy roar, short reverb", duration: 1.0 },
  { name: "sniper_shot", prompt: "high-power sci-fi sniper rifle, deep crack with long plasma decay and amber whine", duration: 1.5 },
  { name: "reload_short", prompt: "futuristic magazine click and energy cell snap-in, mechanical, dry, no music", duration: 0.7 },
  { name: "reload_long", prompt: "heavy sci-fi reload sequence, slide pull, magnetic clamp, energy cell hum", duration: 1.3 },
  { name: "enemy_hit", prompt: "sharp metallic plasma impact on armored robot, short cyan zap", duration: 0.5 },
  { name: "enemy_death", prompt: "sci-fi robot collapse, breaking metal panels with neon glitch and short electric fizz", duration: 1.2 },
  { name: "pickup_health", prompt: "positive sci-fi medical pickup chime, ascending soft synth, calm cyan tone", duration: 0.7 },
  { name: "pickup_ammo", prompt: "ammo magazine snap pickup, mechanical click with bright amber LED beep", duration: 0.6 },
  { name: "ui_click", prompt: "minimal HUD click, tiny crisp cyan blip", duration: 0.5 },
  { name: "ui_error", prompt: "low denied buzz, dry square wave with magenta distortion", duration: 0.5 },
  { name: "wave_start", prompt: "tactical alert horn, two-tone sci-fi siren rising, magenta then cyan", duration: 1.8 },
  { name: "boss_roar", prompt: "massive industrial mech roar with deep magenta plasma surge", duration: 2.2 },
];

const MUSIC: Music[] = [
  { name: "menu_theme", prompt: "cold sci-fi synthwave loop, slow 90 BPM, dark cyan pads, distant magenta arpeggio, no drums on intro, becomes pulsing on second half, futuristic arena lobby, instrumental, no vocals", duration: 45 },
  { name: "combat_loop", prompt: "aggressive cyberpunk drum and bass, 140 BPM, distorted neon synths, magenta lead, pumping bass, action shooter combat, instrumental, no vocals, loopable", duration: 45 },
  { name: "boss_theme", prompt: "industrial sci-fi boss battle, 120 BPM, heavy distorted brass and detuned synths, pounding drums, magenta and amber tonal palette, instrumental, no vocals", duration: 45 },
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function generateSfx(item: Sfx): Promise<ArrayBuffer> {
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: item.prompt,
      duration_seconds: item.duration,
      prompt_influence: 0.5,
    }),
  });
  if (!res.ok) {
    throw new Error(`SFX ${item.name} failed [${res.status}]: ${await res.text()}`);
  }
  return res.arrayBuffer();
}

async function generateMusic(item: Music): Promise<ArrayBuffer> {
  const res = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: item.prompt,
      music_length_ms: Math.round(item.duration * 1000),
    }),
  });
  if (!res.ok) {
    throw new Error(`Music ${item.name} failed [${res.status}]: ${await res.text()}`);
  }
  return res.arrayBuffer();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const tasks: Array<{ kind: "sfx" | "music"; name: string; run: () => Promise<ArrayBuffer> }> = [];
  for (const s of SFX) tasks.push({ kind: "sfx", name: s.name, run: () => generateSfx(s) });
  for (const m of MUSIC) tasks.push({ kind: "music", name: m.name, run: () => generateMusic(m) });

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const t of tasks) {
    const path = join(OUT_DIR, `${t.name}.mp3`);
    if (await exists(path)) {
      console.log(`[skip] ${t.name}.mp3`);
      skipped++;
      continue;
    }
    try {
      console.log(`[gen ] ${t.kind} ${t.name} ...`);
      const buf = await t.run();
      await writeFile(path, Buffer.from(buf));
      const kb = (buf.byteLength / 1024).toFixed(1);
      console.log(`[ok  ] ${t.name}.mp3 (${kb} KB)`);
      done++;
    } catch (e) {
      console.error(`[fail] ${t.name}: ${(e as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. generated=${done} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
