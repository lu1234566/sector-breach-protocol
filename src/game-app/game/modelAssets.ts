// Central registry for prop GLB models used in the arena.

export interface PropModelDef {
  url: string;
  targetSize: number;
  yOffset: number;
  rotation: [number, number, number];
}

export const PROP_MODELS: Record<string, PropModelDef> = {
  crate: {
    url: "/assets/models/props/prop_scifi_crate.glb",
    targetSize: 0.78,
    yOffset: 0,
    rotation: [0, 0, 0],
  },
  barrel: {
    url: "/assets/models/props/prop_energy_barrel.glb",
    targetSize: 0.62,
    yOffset: 0,
    rotation: [0, 0, 0],
  },
  terminal: {
    url: "/assets/models/props/prop_lab_terminal.glb",
    targetSize: 0.75,
    yOffset: 0,
    rotation: [0, 0, 0],
  },
  wallPanel: {
    url: "/assets/models/props/prop_wall_panel.glb",
    targetSize: 1.0,
    yOffset: 0,
    rotation: [0, 0, 0],
  },
};
