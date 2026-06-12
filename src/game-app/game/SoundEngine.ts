// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WeaponType } from './constants';
import { getSettings, subscribeSettings } from './settings';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// The synth gain constants were tuned against the old fixed sfxVolume of
// 0.7, so the master gain is normalized to keep that loudness at default.
const SFX_REFERENCE = 0.7;

/**
 * SoundEngine — drop-in audio pipeline.
 *
 * Tries to play a real MP3 file from /audio/<name>.mp3 first. If the file is
 * missing (404 / load error), falls back to the synthesized oscillator that
 * has always shipped with the game. This means audio "just gets better" the
 * moment files appear under public/audio/ — no code change needed in
 * GameApp.tsx.
 *
 * To generate the files run: bun run scripts/generate-audio.ts
 * (requires ELEVENLABS_API_KEY secret).
 */

type FileKey =
  | 'pistol_shot'
  | 'rifle_shot'
  | 'shotgun_shot'
  | 'sniper_shot'
  | 'reload_short'
  | 'reload_long'
  | 'enemy_hit'
  | 'enemy_death'
  | 'pickup_health'
  | 'pickup_ammo'
  | 'ui_click'
  | 'ui_error'
  | 'wave_start'
  | 'boss_roar'
  | 'menu_theme'
  | 'combat_loop'
  | 'boss_theme';

const POOL_SIZE = 4;

class FilePool {
  private url: string;
  private pool: HTMLAudioElement[] = [];
  private index = 0;
  loaded: boolean | null = null; // null = not yet probed
  private probed: Promise<boolean> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  probe(): Promise<boolean> {
    if (this.loaded !== null) return Promise.resolve(this.loaded);
    if (this.probed) return this.probed;
    this.probed = new Promise((resolve) => {
      const a = new Audio();
      a.addEventListener('canplaythrough', () => {
        this.loaded = true;
        // Fill pool now that we know it works
        for (let i = 0; i < POOL_SIZE; i++) {
          const el = new Audio(this.url);
          el.preload = 'auto';
          this.pool.push(el);
        }
        resolve(true);
      }, { once: true });
      a.addEventListener('error', () => {
        this.loaded = false;
        resolve(false);
      }, { once: true });
      a.src = this.url;
      a.load();
    });
    return this.probed;
  }

  play(volume = 0.7) {
    if (!this.loaded || this.pool.length === 0) return false;
    const el = this.pool[this.index];
    this.index = (this.index + 1) % this.pool.length;
    try {
      el.currentTime = 0;
      el.volume = volume;
      el.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
}

export class SoundEngine {
  ctx: AudioContext | null = null;
  private files: Partial<Record<FileKey, FilePool>> = {};
  private music: { key: FileKey; el: HTMLAudioElement } | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Live-apply volume changes from the settings panel to whatever is
    // already playing (file pools read the volume fresh on each play).
    subscribeSettings((s) => {
      if (this.music) this.music.el.volume = clamp01(s.musicVolume ?? 0.35);
      if (this.masterGain) {
        this.masterGain.gain.value = clamp01(s.sfxVolume ?? SFX_REFERENCE) / SFX_REFERENCE;
      }
    });
  }

  private get musicVolume() {
    return clamp01(getSettings().musicVolume ?? 0.35);
  }

  private get sfxVolume() {
    return clamp01(getSettings().sfxVolume ?? SFX_REFERENCE);
  }

  /** Output node for the oscillator fallbacks — scaled by the SFX volume. */
  private out(): AudioNode {
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.sfxVolume / SFX_REFERENCE;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.masterGain ?? this.ctx!.destination;
  }

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    // Probe SFX files in background — non-blocking
    this.preload();
  }

  private getFile(key: FileKey): FilePool {
    if (!this.files[key]) {
      this.files[key] = new FilePool(`/audio/${key}.mp3`);
      this.files[key]!.probe();
    }
    return this.files[key]!;
  }

  preload() {
    const all: FileKey[] = [
      'pistol_shot', 'rifle_shot', 'shotgun_shot', 'sniper_shot',
      'reload_short', 'reload_long', 'enemy_hit', 'enemy_death',
      'pickup_health', 'pickup_ammo', 'ui_click', 'ui_error',
      'wave_start', 'boss_roar',
    ];
    all.forEach((k) => this.getFile(k));
  }

  /* ----------------------------- Public API ----------------------------- */
  playShot(weapon: WeaponType) {
    const key: FileKey =
      weapon === 'sniper'
        ? 'sniper_shot'
        : weapon === 'shotgun'
          ? 'shotgun_shot'
          : weapon === 'rifle'
            ? 'rifle_shot'
            : 'pistol_shot';
    if (this.getFile(key).play(this.sfxVolume)) return;
    this.synthShot(weapon);
  }

  playKill() {
    if (this.getFile('enemy_death').play(this.sfxVolume * 0.9)) return;
    this.synthKill();
  }

  playReload() {
    if (this.getFile('reload_short').play(this.sfxVolume * 0.8)) return;
    this.synthReload();
  }

  playHit() {
    if (this.getFile('enemy_hit').play(this.sfxVolume * 0.6)) return;
    this.synthHit();
  }

  playUiClick() {
    if (this.getFile('ui_click').play(this.sfxVolume * 0.4)) return;
    this.synthUiClick();
  }

  playPickup(type?: 'health' | 'ammo') {
    const key: FileKey = type === 'health' ? 'pickup_health' : 'pickup_ammo';
    if (this.getFile(key).play(this.sfxVolume * 0.7)) return;
    this.synthPickup(type);
  }

  playError() {
    if (this.getFile('ui_error').play(this.sfxVolume * 0.5)) return;
    this.synthError();
  }

  playWaveStart() {
    if (this.getFile('wave_start').play(this.sfxVolume)) return;
    this.synthShot('rifle');
  }

  playBossRoar() {
    if (this.getFile('boss_roar').play(this.sfxVolume)) return;
    this.synthShot('shotgun');
  }

  /* ----------------------------- Music ----------------------------- */
  playMusic(key: 'menu_theme' | 'combat_loop' | 'boss_theme') {
    if (this.music?.key === key) return;
    this.stopMusic();
    const el = new Audio(`/audio/${key}.mp3`);
    el.loop = true;
    el.volume = this.musicVolume;
    el.preload = 'auto';
    el.addEventListener('error', () => {
      // No file available — silently skip; oscillator music isn't worth synthesizing
    }, { once: true });
    el.play().catch(() => {});
    this.music = { key, el };
  }

  stopMusic() {
    if (this.music) {
      try { this.music.el.pause(); } catch {}
      this.music = null;
    }
  }

  /* ----------------------------- Oscillator fallbacks ----------------------------- */
  private synthShot(weapon: WeaponType) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = weapon === 'sniper' || weapon === 'shotgun' ? 'sawtooth' : 'square';
    const freq = weapon === 'sniper' ? 80 : weapon === 'shotgun' ? 120 : weapon === 'rifle' ? 180 : 220;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(weapon === 'sniper' ? 400 : 800, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (weapon === 'sniper' ? 0.4 : weapon === 'shotgun' ? 0.3 : 0.1));
    osc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.5);
  }

  private synthKill() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }

  private synthReload() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }

  private synthHit() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.05);
  }

  private synthUiClick() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.02);
  }

  private synthPickup(type?: 'health' | 'ammo') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    if (type === 'health') {
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.2);
    } else {
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.1);
    }
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }

  private synthError() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }
}

export const sounds = new SoundEngine();
