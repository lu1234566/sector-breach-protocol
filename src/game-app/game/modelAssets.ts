// Central registry for all GLB models used in the arena.
// Animation indices are by clip order (Blender NlaTrack, NlaTrack.001, ...).
// Components fall back to clip-by-name and to clip[0] if an index is missing.

export interface EnemyModelDef {
  url: string;
  displayName: string;
  color: string;
  eyeColor?: string;
  targetSize: number; // multiplied by cellSize for the longest bbox axis
  yOffset: number;
  rotation: [number, number, number];
  // Additional yaw (radians) added to the dynamic facing rotation, used when
  // the GLB's "forward" axis is not -Z. Try Math.PI, Math.PI/2, -Math.PI/2.
  facingOffset?: number;
  animationMap: Record<string, number>;
}

export const ENEMY_MODELS: Record<string, EnemyModelDef> = {
  rusher: {
    url: '/assets/models/enemies/enemy_rusher.glb',
    displayName: 'Rusher',
    color: '#e879f9',
    targetSize: 0.62,
    yOffset: 0,
    rotation: [0, 0, 0],
    facingOffset: 0, // tune to Math.PI / Math.PI/2 / -Math.PI/2 if model faces wrong way
    animationMap: { idle: 0, walk: 0, run: 0, attack: 0, hit: 0, death: 0 },
  },
  rifleman: {
    url: '/assets/models/enemies/enemy_rifleman.glb',
    displayName: 'Rifleman',
    color: '#22d3ee',
    targetSize: 0.82,
    yOffset: 0,
    rotation: [0, 0, 0],
    facingOffset: 0,
    animationMap: { idle: 0, walk: 1, attack: 3, shoot: 3, death: 4 },
  },
  sniper: {
    url: '/assets/models/enemies/enemy_sniper.glb',
    displayName: 'Sniper',
    color: '#fbbf24',
    targetSize: 0.9,
    yOffset: 0,
    rotation: [0, 0, 0],
    facingOffset: 0,
    animationMap: { idle: 3, walk: 0, attack: 1, shoot: 1, death: 2 },
  },
  titan: {
    url: '/assets/models/enemies/enemy_titan.glb',
    displayName: 'Sapphire Dragonoid',
    color: '#38bdf8',
    eyeColor: '#22c55e',
    targetSize: 1.85,
    yOffset: 0,
    rotation: [0, 0, 0],
    facingOffset: 0,
    animationMap: { idle: 1, walk: 0, attack: 2, death: 3 },
  },
  oldTitan: {
    url: '/assets/models/enemies/enemy_old_titan.glb',
    displayName: 'Old Titan',
    color: '#f43f5e',
    targetSize: 1.65,
    yOffset: 0,
    rotation: [0, 0, 0],
    facingOffset: 0,
    animationMap: { idle: 0, walk: 1, attack: 3, heavyAttack: 4, death: 5 },
  },
};

export interface PropModelDef {
  url: string;
  targetSize: number;
  yOffset: number;
  rotation: [number, number, number];
}

export const PROP_MODELS: Record<string, PropModelDef> = {
  crate: {
    url: '/assets/models/props/prop_scifi_crate.glb',
    targetSize: 0.78,
    yOffset: 0,
    rotation: [0, 0, 0],
  },
  barrel: {
    url: '/assets/models/props/prop_energy_barrel.glb',
    targetSize: 0.62,
    yOffset: 0,
    rotation: [0, 0, 0],
  },
  terminal: {
    url: '/assets/models/props/prop_lab_terminal.glb',
    targetSize: 0.75,
    yOffset: 0,
    rotation: [0, 0, 0],
  },
  wallPanel: {
    url: '/assets/models/props/prop_wall_panel.glb',
    targetSize: 1.0,
    yOffset: 0,
    rotation: [0, 0, 0],
  },
};
