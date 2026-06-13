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

// A cell is walkable for the player if it's floor (0) or a door (2, opens on
// contact). Walls (1) and barrels (3) block movement.
const isWalkable = (cell: number | undefined) => cell === 0 || cell === 2;

/**
 * BFS over walkable cells from the player spawn, returning every cell the
 * player can actually reach. Objective zones MUST land on one of these —
 * the geometric center of e.g. the Reactor arena is sealed inside the core
 * and would soft-lock any zone-based objective.
 */
function reachableCells(arena: ArenaDef): Set<string> {
  const map = arena.mapData;
  const rows = map.length;
  const cols = map[0].length;
  const startX = Math.floor(arena.playerSpawn.x / CELL_SIZE);
  const startY = Math.floor(arena.playerSpawn.y / CELL_SIZE);
  const seen = new Set<string>();
  const queue: [number, number][] = [[startX, startY]];
  seen.add(`${startX},${startY}`);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows || seen.has(key)) continue;
      if (!isWalkable(map[ny][nx])) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/** Reachable cell closest to a target grid position; falls back to spawn. */
function nearestReachable(
  arena: ArenaDef,
  targetX: number,
  targetY: number,
): { x: number; y: number } {
  const reachable = reachableCells(arena);
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const key of reachable) {
    const [x, y] = key.split(",").map(Number);
    const d = (x - targetX) ** 2 + (y - targetY) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  if (!best) {
    best = {
      x: Math.floor(arena.playerSpawn.x / CELL_SIZE),
      y: Math.floor(arena.playerSpawn.y / CELL_SIZE),
    };
  }
  return {
    x: best.x * CELL_SIZE + CELL_SIZE / 2,
    y: best.y * CELL_SIZE + CELL_SIZE / 2,
  };
}

function arenaCenter(arena: ArenaDef): ObjectiveZone {
  // Snap the geometric center onto the nearest cell the player can reach.
  const targetX = Math.floor(arena.mapData[0].length / 2);
  const targetY = Math.floor(arena.mapData.length / 2);
  const { x, y } = nearestReachable(arena, targetX, targetY);
  return { x, y, radius: CELL_SIZE * 1.6 };
}

function extractCorner(arena: ArenaDef): ObjectiveZone {
  // Reachable cell nearest the corner opposite the player spawn.
  const cols = arena.mapData[0].length;
  const rows = arena.mapData.length;
  const spawnCellX = Math.floor(arena.playerSpawn.x / CELL_SIZE);
  const spawnCellY = Math.floor(arena.playerSpawn.y / CELL_SIZE);
  const targetX = spawnCellX < cols / 2 ? cols - 3 : 2;
  const targetY = spawnCellY < rows / 2 ? rows - 3 : 2;
  const { x, y } = nearestReachable(arena, targetX, targetY);
  return { x, y, radius: CELL_SIZE * 1.4 };
}

export function getWaveObjective(wave: number, arena: ArenaDef, endless = false): WaveObjective {
  // Endless keeps the campaign pacing for waves 1-5, then switches to the
  // open-ended rotation — extraction is campaign-exclusive.
  if (endless && wave >= 6) return endlessObjective(wave, arena);
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
      return endlessObjective(wave, arena);
  }
}

/** Open-ended rotation: a Titan every 5th wave, otherwise hack/defend/eliminate. */
function endlessObjective(wave: number, arena: ArenaDef): WaveObjective {
  if (wave % 5 === 0) return { kind: "eliminate", label: "Titan Protocol" };
  const mod = wave % 3;
  if (mod === 1)
    return {
      kind: "hack",
      label: "Hack Node",
      zone: arenaCenter(arena),
      durationMs: HACK_DURATION,
    };
  if (mod === 2)
    return {
      kind: "defend",
      label: "Defend Core",
      zone: arenaCenter(arena),
      durationMs: DEFEND_DURATION,
      coreMaxHp: CORE_HP,
    };
  return { kind: "eliminate", label: "Neutralize Hostiles" };
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
