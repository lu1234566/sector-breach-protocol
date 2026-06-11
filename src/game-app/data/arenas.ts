// @ts-nocheck
/**
 * Arena layouts for Protocol DOC.
 * Map cell codes:
 *   0 = floor
 *   1 = wall
 *   2 = door / low cover (movement-blocking)
 *   3 = barrel (movement-blocking, destructible-feel prop)
 */

import { CELL_SIZE } from "../game/constants";

export type ArenaAccent = "cyan" | "magenta" | "amber";

export interface SpawnPoint {
  x: number;
  y: number;
}

export interface ArenaDef {
  id: string;
  name: string;
  tagline: string;
  accent: ArenaAccent;
  propSeed: number;
  mapData: number[][];
  /** Pixel-space player start (centered cell). */
  playerSpawn: { x: number; y: number; angle: number };
  /** Pixel-space spawn points for enemies. */
  spawnPoints: SpawnPoint[];
}

const cellCenter = (x: number, y: number): SpawnPoint => ({
  x: x * CELL_SIZE + CELL_SIZE / 2,
  y: y * CELL_SIZE + CELL_SIZE / 2,
});

/* ============================================================
 * Containment Block — original layout, symmetric grid w/ alcoves
 * ============================================================ */
const CONTAINMENT_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 2, 0, 0, 2, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 3, 3, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 3, 0, 0, 0, 3, 1, 0, 3, 0, 0, 3, 0, 1, 3, 0, 0, 0, 3, 1, 0, 1],
  [1, 0, 1, 3, 0, 0, 0, 3, 1, 0, 3, 0, 0, 3, 0, 1, 3, 0, 0, 0, 3, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 3, 3, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 2, 0, 0, 2, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

/* ============================================================
 * Reactor Ring — open central arena with 4 columns + reactor core
 * ============================================================ */
const REACTOR_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 3, 0, 0, 0, 0, 1, 1, 3, 3, 1, 1, 0, 0, 0, 0, 3, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 3, 0, 0, 0, 0, 1, 1, 3, 3, 1, 1, 0, 0, 0, 0, 3, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

/* ============================================================
 * Server Causeway — long corridor with server racks on the sides
 * ============================================================ */
const CAUSEWAY_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 3, 1, 0, 1, 3, 1, 0, 1, 3, 3, 1, 0, 1, 3, 1, 0, 1, 3, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 3, 1, 0, 1, 3, 1, 0, 1, 3, 3, 1, 0, 1, 3, 1, 0, 1, 3, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

export const ARENAS: ArenaDef[] = [
  {
    id: "containment",
    name: "Containment Block",
    tagline: "Symmetric grid · Cyan",
    accent: "cyan",
    propSeed: 1337,
    mapData: CONTAINMENT_MAP,
    playerSpawn: {
      x: 12 * CELL_SIZE + CELL_SIZE / 2,
      y: 6 * CELL_SIZE + CELL_SIZE / 2,
      angle: -Math.PI / 2,
    },
    spawnPoints: [
      cellCenter(2, 2),
      cellCenter(21, 2),
      cellCenter(2, 16),
      cellCenter(21, 16),
      cellCenter(12, 2),
      cellCenter(12, 16),
      cellCenter(2, 9),
      cellCenter(21, 9),
      cellCenter(6, 6),
      cellCenter(18, 6),
      cellCenter(6, 12),
      cellCenter(18, 12),
    ],
  },
  {
    id: "reactor",
    name: "Reactor Ring",
    tagline: "Open arena · Magenta core",
    accent: "magenta",
    propSeed: 7919,
    mapData: REACTOR_MAP,
    playerSpawn: {
      x: 3 * CELL_SIZE + CELL_SIZE / 2,
      y: 3 * CELL_SIZE + CELL_SIZE / 2,
      angle: Math.PI / 4,
    },
    spawnPoints: [
      cellCenter(20, 2),
      cellCenter(20, 16),
      cellCenter(2, 16),
      cellCenter(12, 2),
      cellCenter(12, 16),
      cellCenter(2, 9),
      cellCenter(21, 9),
      cellCenter(5, 5),
      cellCenter(18, 5),
      cellCenter(5, 13),
      cellCenter(18, 13),
    ],
  },
  {
    id: "causeway",
    name: "Server Causeway",
    tagline: "Long corridor · Amber",
    accent: "amber",
    propSeed: 2718,
    mapData: CAUSEWAY_MAP,
    playerSpawn: { x: 1 * CELL_SIZE + CELL_SIZE / 2, y: 9 * CELL_SIZE + CELL_SIZE / 2, angle: 0 },
    spawnPoints: [
      cellCenter(22, 9),
      cellCenter(22, 5),
      cellCenter(22, 13),
      cellCenter(12, 6),
      cellCenter(12, 12),
      cellCenter(8, 8),
      cellCenter(16, 10),
      cellCenter(5, 9),
      cellCenter(19, 9),
      cellCenter(22, 1),
      cellCenter(22, 16),
    ],
  },
];

export const DEFAULT_ARENA_ID = "containment";

export function getArenaById(id: string | null | undefined): ArenaDef {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0];
}
