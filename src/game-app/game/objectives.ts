/**
 * Per-wave objective table for Protocol DOC.
 * Boss wave (5) stays eliminate so the Titan IS the objective.
 */

import { CELL_SIZE } from "./constants";
import type { ArenaDef } from "../data/arenas";
import type { WaveObjective, ObjectiveRuntime, ObjectiveZone } from "./types";

const HACK_DURATION = 12_000;
const DEFEND_DURATION = 30_000;
const EXTRACT_TIME_LIMIT = 25_000;
const EXTRACT_KILLS = 5;
const CORE_HP = 500;

function arenaCenter(arena: ArenaDef): ObjectiveZone {
  const cx = (arena.mapData[0].length / 2) * CELL_SIZE;
  const cy = (arena.mapData.length / 2) * CELL_SIZE;
  return { x: cx, y: cy, radius: CELL_SIZE * 1.6 };
}

function extractCorner(arena: ArenaDef): ObjectiveZone {
  // Pick a free cell near the corner opposite the player spawn.
  const cols = arena.mapData[0].length;
  const rows = arena.mapData.length;
  const spawnCellX = Math.floor(arena.playerSpawn.x / CELL_SIZE);
  const spawnCellY = Math.floor(arena.playerSpawn.y / CELL_SIZE);
  const targetX = spawnCellX < cols / 2 ? cols - 3 : 2;
  const targetY = spawnCellY < rows / 2 ? rows - 3 : 2;
  // Walk a few cells inward looking for a floor cell
  for (let dx = 0; dx < 4; dx++) {
    for (let dy = 0; dy < 4; dy++) {
      const cx = targetX + (spawnCellX < cols / 2 ? -dx : dx);
      const cy = targetY + (spawnCellY < rows / 2 ? -dy : dy);
      if (arena.mapData[cy]?.[cx] === 0) {
        return {
          x: cx * CELL_SIZE + CELL_SIZE / 2,
          y: cy * CELL_SIZE + CELL_SIZE / 2,
          radius: CELL_SIZE * 1.4,
        };
      }
    }
  }
  return arenaCenter(arena);
}

export function getWaveObjective(wave: number, arena: ArenaDef): WaveObjective {
  switch (wave) {
    case 1:
      return { kind: "eliminate", label: "Neutralize Hostiles" };
    case 2:
      return {
        kind: "hack",
        label: "Hack Node",
        zone: arenaCenter(arena),
        durationMs: HACK_DURATION,
      };
    case 3:
      return { kind: "eliminate", label: "Neutralize Hostiles" };
    case 4:
      return {
        kind: "defend",
        label: "Defend Core",
        zone: arenaCenter(arena),
        durationMs: DEFEND_DURATION,
        coreMaxHp: CORE_HP,
      };
    case 5:
      return { kind: "eliminate", label: "Titan Protocol" };
    case 6:
      return {
        kind: "extract",
        label: "Extract",
        zone: extractCorner(arena),
        killThreshold: EXTRACT_KILLS,
        timeLimitMs: EXTRACT_TIME_LIMIT,
      };
    default:
      return { kind: "eliminate", label: "Neutralize Hostiles" };
  }
}

export function createRuntime(obj: WaveObjective): ObjectiveRuntime {
  const isExtract = obj.kind === "extract";
  return {
    kind: obj.kind,
    label: obj.label,
    zone: obj.zone,
    progress: 0,
    // hack/defend countdown starts full; extract timer only starts after activation
    timer: isExtract ? 0 : (obj.durationMs ?? 0),
    inZone: false,
    killCount: 0,
    killTarget: obj.killThreshold,
    coreHp: obj.coreMaxHp,
    coreMaxHp: obj.coreMaxHp,
    extractActive: !isExtract,
    status: "active",
    startedAt: Date.now(),
  };
}
