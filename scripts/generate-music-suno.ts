/**
 * Generate Protocol DOC music tracks via sunoapi.org.
 * Run: bun run scripts/generate-music-suno.ts
 * Requires env: SUNO_API_KEY
 *
 * Idempotent: skips files that already exist.
 */

import { writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

const API_KEY = process.env.SUNO_API_KEY;
if (!API_KEY) {
  console.error("SUNO_API_KEY is not set");
  process.exit(1);
}

const BASE = "https://apibox.erweima.ai/api/v1";
const OUT_DIR = "public/audio";

type Track = { name: string; title: string; style: string; prompt: string };

const TRACKS: Track[] = [
  {
    name: "menu_theme",
    title: "Protocol DOC - Lobby",
    style:
      "dark synthwave, cyberpunk, slow 90 BPM, cyan pads, magenta arpeggio, ambient, futuristic, instrumental, no vocals, loopable",
    prompt:
      "cold sci-fi synthwave loop for an arena lobby. Slow 90 BPM. Dark cyan analog pads sustain throughout. A distant magenta arpeggio enters at 0:10. No drums in the first half, then a pulsing kick joins at 0:20. Ends on a sustained pad for clean looping.",
  },
  {
    name: "combat_loop",
    title: "Protocol DOC - Wave Combat",
    style:
      "aggressive cyberpunk drum and bass, neurofunk, 140 BPM, distorted neon synths, magenta lead, pumping bass, action shooter combat, instrumental, no vocals, loopable",
    prompt:
      "aggressive cyberpunk drum and bass arena combat loop at 140 BPM. Distorted neon synth stabs, a screaming magenta lead, pumping reese bass and tight broken-beat drums. Energy stays high throughout. Clean loop point.",
  },
  {
    name: "boss_theme",
    title: "Protocol DOC - Boss Encounter",
    style:
      "industrial sci-fi boss battle, 120 BPM, heavy distorted brass, detuned synths, pounding drums, magenta and amber tonal palette, cinematic, instrumental, no vocals",
    prompt:
      "industrial sci-fi boss battle at 120 BPM. Heavy distorted brass hits, detuned synth drones, pounding tribal drums. Magenta and amber tonal palette. Builds tension with a half-time breakdown around 0:25, then returns full force.",
  },
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function postJson(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${path} [${res.status}]: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`POST ${path} non-json: ${text}`);
  }
}

async function getJson(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${path} [${res.status}]: ${text}`);
  }
  return JSON.parse(text);
}

async function generate(track: Track): Promise<string> {
  const submit = await postJson("/generate", {
    prompt: track.prompt,
    style: track.style,
    title: track.title,
    customMode: true,
    instrumental: true,
    model: "V4",
    callBackUrl: "https://example.com/callback",
  });

  const taskId: string | undefined = submit?.data?.taskId ?? submit?.data?.task_id;
  if (!taskId) {
    throw new Error(`No taskId returned: ${JSON.stringify(submit)}`);
  }
  console.log(`    task=${taskId}`);

  // Poll
  const start = Date.now();
  const MAX_MS = 5 * 60 * 1000;
  while (Date.now() - start < MAX_MS) {
    await new Promise((r) => setTimeout(r, 8000));
    const info = await getJson(`/generate/record-info?taskId=${taskId}`);
    const status = info?.data?.status;
    process.stdout.write(`    [${Math.round((Date.now() - start) / 1000)}s] status=${status}\n`);
    if (status === "SUCCESS") {
      const items = info?.data?.response?.sunoData ?? info?.data?.response?.data ?? [];
      const audioUrl: string | undefined = items?.[0]?.audioUrl ?? items?.[0]?.audio_url;
      if (!audioUrl)
        throw new Error(`No audioUrl in success: ${JSON.stringify(info).slice(0, 400)}`);
      return audioUrl;
    }
    if (status && /FAIL|ERROR|SENSITIVE/i.test(status)) {
      throw new Error(`Task failed: ${JSON.stringify(info).slice(0, 400)}`);
    }
  }
  throw new Error("Timeout waiting for Suno task");
}

async function downloadTo(url: string, path: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed [${res.status}]`);
  const buf = await res.arrayBuffer();
  await writeFile(path, Buffer.from(buf));
  return buf.byteLength;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let done = 0,
    skipped = 0,
    failed = 0;

  for (const t of TRACKS) {
    const path = join(OUT_DIR, `${t.name}.mp3`);
    if (await exists(path)) {
      console.log(`[skip] ${t.name}.mp3`);
      skipped++;
      continue;
    }
    try {
      console.log(`[gen ] ${t.name} ...`);
      const url = await generate(t);
      const bytes = await downloadTo(url, path);
      console.log(`[ok  ] ${t.name}.mp3 (${(bytes / 1024).toFixed(1)} KB)`);
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
