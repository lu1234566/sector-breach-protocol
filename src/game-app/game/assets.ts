// @ts-nocheck
export const ASSETS = {
  textures: {
    // Legacy (procedural fallback)
    floor: '/assets/textures/floor_panel_tactical.jpg',
    wall: '/assets/textures/wall_panel_graphite.jpg',
    wallAlt: '/assets/textures/wall_panel_graphite_alt.jpg',
    crate: '/assets/textures/crate_tactical.jpg',
    barrel: '/assets/textures/barrel_energy.jpg',
    // Protocol DOC v0.1 art pass
    arenaFloor: '/assets/textures/floor_arena_grid.jpg',
    arenaWall: '/assets/textures/wall_panel_neon.jpg',
    reactorWall: '/assets/textures/wall_reactor_core.jpg',
  },
  decals: {
    sector: '/assets/decals/decal_sector_mark.png',
    warning: '/assets/decals/decal_warning_stripe.png',
    protocolDoc: '/assets/decals/protocol_doc_logo.png',
  },
  ui: {
    panelBg: '/assets/ui/hud_panel_bg.jpg',
    panelActive: '/assets/ui/hud_panel_active.jpg',
    iconHealth: '/assets/ui/icon_health.png',
    iconAmmo: '/assets/ui/icon_ammo.png',
    iconWave: '/assets/ui/icon_wave.png',
    iconScore: '/assets/ui/icon_score.png',
    iconKills: '/assets/ui/icon_kills.png',
    iconProtocol: '/assets/ui/icon_protocol.png',
    crosshair: '/assets/ui/crosshair_tactical.png',
    pickupHealth: '/assets/ui/pickup_health.png',
    pickupAmmo: '/assets/ui/pickup_ammo.png',
    // Legacy enemy marks (small icons)
    enemyRusher: '/assets/ui/enemy_mark_rusher.png',
    enemyRifleman: '/assets/ui/enemy_mark_rifleman.png',
    enemySniper: '/assets/ui/enemy_mark_sniper.png',
    enemyTitan: '/assets/ui/enemy_mark_titan.png',
    // Protocol DOC v0.1 art pass — full portraits
    portraitRusher: '/assets/ui/portrait_rusher.png',
    portraitRifleman: '/assets/ui/portrait_rifleman.png',
    portraitSniper: '/assets/ui/portrait_sniper.png',
    portraitTitan: '/assets/ui/portrait_titan.png',
  },
  menu: {
    bg: '/assets/menu/bg_arena_breach.jpg',
    commandCard: '/assets/menu/command_center_card.jpg',
    armoryCard: '/assets/menu/armory_card.jpg',
    profileCard: '/assets/menu/profile_card.jpg',
    difficultyCard: '/assets/menu/difficulty_card.jpg',
    arenaThumbs: {
      containment: '/assets/menu/arena_containment.jpg',
      reactor: '/assets/menu/arena_reactor.jpg',
      causeway: '/assets/menu/arena_causeway.jpg',
    } as Record<string, string>,
  }
};
