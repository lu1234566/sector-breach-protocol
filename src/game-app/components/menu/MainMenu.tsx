// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  Shield, 
  Zap, 
  Users, 
  Coins, 
  ShoppingCart, 
  ChevronLeft, 
  Swords, 
  Award, 
  Skull,
  Play,
  Database,
  Settings as SettingsIcon,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { 
  WeaponType, 
  DifficultyKey, 
  WEAPONS, 
  DIFFICULTIES 
} from '../../game/constants';
import { LifetimeStats, WeaponUpgradeLevels } from '../../game/types';
import { saveDifficulty } from '../../game/persistence';
import { sounds } from '../../game/SoundEngine';
import { ASSETS } from '../../game/assets';
import { useSettings } from '../../game/settings';
import type { ArenaDef } from '../../data/arenas';
import { Map as MapIcon } from 'lucide-react';

type MenuView = 'main' | 'armory' | 'difficulty' | 'profile' | 'arena';

interface MainMenuProps {
  initGame: () => void;
  setGameState: (state: 'start' | 'playing' | 'dead' | 'win' | 'upgrades') => void;
  menuView: MenuView;
  setMenuView: (view: MenuView) => void;
  difficulty: DifficultyKey;
  setDifficulty: (difficulty: DifficultyKey) => void;
  tacticalCredits: number;
  lifetimeStats: LifetimeStats;
  weaponUpgradeLevels: WeaponUpgradeLevels;
  setUpgradeTab: (tab: 'biological' | 'weapon') => void;
  setSelectedLabWeapon: (weapon: WeaponType) => void;
  arenas: ArenaDef[];
  selectedArenaId: string;
  setSelectedArenaId: (id: string) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  initGame,
  setGameState,
  menuView,
  setMenuView,
  difficulty,
  setDifficulty,
  tacticalCredits,
  lifetimeStats,
  weaponUpgradeLevels,
  setUpgradeTab,
  setSelectedLabWeapon,
  arenas,
  selectedArenaId,
  setSelectedArenaId,
}) => {
  const currentArena = arenas.find(a => a.id === selectedArenaId) ?? arenas[0];
  const accentColors: Record<string, { ring: string; text: string; glow: string }> = {
    cyan: { ring: 'border-cyan-500/60', text: 'text-cyan-400', glow: 'shadow-[0_0_40px_rgba(34,211,238,0.25)]' },
    magenta: { ring: 'border-fuchsia-500/60', text: 'text-fuchsia-400', glow: 'shadow-[0_0_40px_rgba(232,121,249,0.25)]' },
    amber: { ring: 'border-amber-500/60', text: 'text-amber-400', glow: 'shadow-[0_0_40px_rgba(251,191,36,0.25)]' },
  };
  const [settings] = useSettings();
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const allowVideo = settings.quality !== 'low' && !reducedMotion;
  const [videoReady, setVideoReady] = useState(false);

  const handleSettings = () => { sounds.playUiClick(); setMenuView('difficulty'); };
  const handleDatabase = () => { sounds.playUiClick(); setMenuView('profile'); };


  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-slate-950">
      {/* Background: video (med/high) or static poster (low / reduced motion) */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src="/assets/menu/menu_bg_poster.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: videoReady && allowVideo ? 0 : 1, transition: 'opacity 600ms ease' }}
        />
        {allowVideo && (
          <video
            src="/assets/menu/menu_bg.mp4"
            poster="/assets/menu/menu_bg_poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: videoReady ? 1 : 0, transition: 'opacity 800ms ease' }}
          />
        )}
        {/* Dark readability overlays */}
        <div className="absolute inset-0 bg-slate-950/65" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/40 to-slate-950/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70" />
      </div>

      {/* HUD grid + scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.08] bg-[linear-gradient(#22d3ee_1px,transparent_1px),linear-gradient(90deg,#22d3ee_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#67e8f9_3px,transparent_3px)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      <AnimatePresence mode="wait">
        {(menuView === 'main' || !['armory', 'difficulty', 'profile', 'arena'].includes(menuView)) && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex-1 w-full max-w-[1600px] mx-auto px-6 md:px-12 lg:px-16 py-8 flex flex-col"
          >
            {/* Top status strip */}
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.4em] text-cyan-300/70">
              <div className="flex items-center gap-3">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>SBP // TERMINAL_v1.2.5</span>
              </div>
              <div className="flex items-center gap-6">
                <span>UPLINK: SECURE</span>
                <span className="text-red-400/80 flex items-center gap-2">
                  <AlertTriangle size={11} /> LOCKDOWN
                </span>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center mt-6">
              {/* LEFT — Title + buttons */}
              <div className="flex flex-col">
                <motion.div
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex items-center gap-3 text-cyan-400 font-mono text-[10px] md:text-xs tracking-[0.5em] uppercase mb-4">
                    <div className="h-px w-10 bg-cyan-400/60" />
                    Classified Operation
                  </div>
                  <h1 className="font-black italic uppercase leading-[0.85] tracking-tighter text-white drop-shadow-[0_0_30px_rgba(34,211,238,0.35)]">
                    <span className="block text-5xl md:text-7xl lg:text-8xl">SECTOR BREACH</span>
                    <span className="block text-5xl md:text-7xl lg:text-8xl bg-gradient-to-r from-cyan-200 via-cyan-400 to-sky-500 bg-clip-text text-transparent">
                      PROTOCOL
                    </span>
                  </h1>
                  <div className="mt-5 flex items-center gap-3 font-mono text-xs md:text-sm uppercase tracking-[0.35em] text-red-400">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Containment Failure Detected
                  </div>
                </motion.div>

                {/* Buttons */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="mt-12 flex flex-col gap-3 max-w-md"
                >
                  {/* DEPLOY — primary */}
                  <button
                    onClick={() => { sounds.playUiClick(); initGame(); }}
                    className="group relative overflow-hidden rounded-md border border-cyan-400/70 bg-cyan-500/10 hover:bg-cyan-500/20 px-6 py-4 text-left transition-all shadow-[0_0_30px_rgba(34,211,238,0.35)] hover:shadow-[0_0_50px_rgba(34,211,238,0.65)] hover:border-cyan-300"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.9)]" />
                    <div className="absolute top-0 right-0 w-16 h-px bg-cyan-400/60" />
                    <div className="absolute top-0 right-0 w-px h-4 bg-cyan-400/60" />
                    <div className="flex items-center gap-4 pl-2">
                      <div className="p-2.5 rounded bg-cyan-400/20 border border-cyan-400/40 group-hover:bg-cyan-400/30">
                        <Play size={22} className="text-cyan-200 fill-cyan-200" />
                      </div>
                      <div>
                        <div className="font-black text-2xl tracking-widest text-white uppercase italic">DEPLOY</div>
                        <div className="text-[10px] font-mono tracking-[0.3em] text-cyan-300/80 uppercase">Engage Hostile Sector</div>
                      </div>
                    </div>
                  </button>

                  {/* Secondary row */}
                  <div className="grid grid-cols-2 gap-3">
                    <SbpButton icon={<Swords size={16} />} label="ARMORY" sub="Munitions"
                      onClick={() => { sounds.playUiClick(); setMenuView('armory'); }} />
                    <SbpButton icon={<Zap size={16} />} label="UPGRADES" sub="Augments"
                      onClick={() => { sounds.playUiClick(); setGameState('upgrades'); }} />
                    <SbpButton icon={<Database size={16} />} label="DATABASE" sub="Intel Logs"
                      onClick={handleDatabase} />
                    <SbpButton icon={<SettingsIcon size={16} />} label="SETTINGS" sub="Protocol Config"
                      onClick={handleSettings} />
                  </div>
                </motion.div>

                {/* Credits strip */}
                <div className="mt-8 inline-flex items-center gap-3 text-xs font-mono uppercase tracking-[0.3em] text-white/50">
                  <Coins size={14} className="text-amber-400" />
                  <span>Salvage</span>
                  <span className="text-amber-300 font-black text-base tabular-nums">
                    {tacticalCredits.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* RIGHT — CURRENT OPERATION panel */}
              <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="relative"
              >
                <div className="relative rounded-md border border-cyan-500/30 bg-slate-950/70 backdrop-blur-md p-6 shadow-[0_0_60px_rgba(8,47,73,0.55)] overflow-hidden">
                  <span className="absolute -top-px -left-px w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                  <span className="absolute -top-px -right-px w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
                  <span className="absolute -bottom-px -left-px w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                  <span className="absolute -bottom-px -right-px w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
                    <div className="flex items-center gap-2 text-cyan-300">
                      <Activity size={14} />
                      <span className="font-mono text-[11px] uppercase tracking-[0.4em]">
                        Current Operation
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-cyan-400/70 tabular-nums">OP-05</span>
                  </div>

                  <div className="space-y-4 font-mono text-sm">
                    <OpRow label="Threat Level" value="Adaptive" tone="amber" />
                    <OpRow label="Final Hostile" value="Sapphire Dragonoid" tone="cyan" />
                    <OpRow label="Sector" value="Containment-05" tone="white" />
                  </div>

                  <div className="mt-5 pt-4 border-t border-cyan-500/20 grid grid-cols-3 gap-3 text-center">
                    <Telemetry label="WAVES" value={lifetimeStats?.totalWaves ?? 0} />
                    <Telemetry label="KILLS" value={lifetimeStats?.totalKills ?? 0} />
                    <Telemetry label="RUNS" value={lifetimeStats?.totalRuns ?? 0} />
                  </div>

                  <motion.div
                    aria-hidden
                    animate={{ y: ['0%', '1200%'] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    className="pointer-events-none absolute left-0 right-0 top-0 h-2 bg-gradient-to-b from-cyan-400/30 to-transparent"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-[0.3em]">
                  <span
                    className="px-3 py-1.5 rounded border border-white/10 bg-slate-950/60"
                    style={{ color: DIFFICULTIES[difficulty].color }}
                  >
                    Protocol: {difficulty}
                  </span>
                  <button
                    onClick={() => { sounds.playUiClick(); setMenuView('arena'); }}
                    className="px-3 py-1.5 rounded border border-cyan-500/30 bg-slate-950/60 text-cyan-300 hover:border-cyan-400/60 transition-colors flex items-center gap-2"
                  >
                    <MapIcon size={11} /> {currentArena.name}
                  </button>
                </div>
              </motion.div>
            </div>

            <div className="mt-6 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">
              <span>// END_OF_TRANSMISSION</span>
              <span>ENCRYPTED · AES-256 · CHANNEL Δ</span>
            </div>
          </motion.div>
        )}


        {menuView === 'armory' && (
          <motion.div 
            key="armory"
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-5xl z-10 py-12"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-8 md:p-10 bg-slate-950/50 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-blue-500/10 rounded-3xl border-2 border-blue-500/30 flex items-center justify-center relative">
                         <div className="absolute inset-0 bg-blue-500/10 animate-pulse rounded-3xl" />
                         <Swords size={40} className="text-blue-500 relative z-10" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Armory</h2>
                        <span className="text-blue-500/60 text-xs font-black uppercase tracking-[0.3em] mt-2 block">Available Ordnance Control</span>
                      </div>
                   </div>
                   <button 
                    onClick={() => {
                        sounds.playUiClick();
                        setMenuView('main');
                    }}
                    className="w-full md:w-auto px-12 py-5 bg-white text-slate-950 font-black uppercase text-base rounded-2xl hover:bg-cyan-500 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                   >
                     <ChevronLeft size={24} />
                     Return
                   </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {(['pistol', 'rifle', 'shotgun', 'sniper'] as WeaponType[]).map(wKey => {
                      const weapon = WEAPONS[wKey];
                      const upgrades = weaponUpgradeLevels[wKey];
                      const avgLevel = (upgrades.damage + upgrades.reload + upgrades.stability) / 3;
                      
                      return (
                        <div key={wKey} className="group relative bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/5 hover:border-white/20 transition-all overflow-hidden flex flex-col gap-6">
                          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-blue-500/30">
                                  <Swords size={20} className="text-blue-500/50 group-hover:text-blue-500" />
                               </div>
                               <div>
                                  <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest block leading-none mb-1">Class: {weapon.type.toUpperCase()}</span>
                                  <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">{weapon.name}</h3>
                               </div>
                            </div>
                            <div className="flex flex-col items-end">
                               <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Proficiency</span>
                               <span className="px-3 py-1 bg-blue-500/20 rounded-full text-blue-400 font-black text-xs tabular-nums border border-blue-500/20">LVL {Math.floor(avgLevel)}</span>
                            </div>
                          </div>
      
                          <div className="grid grid-cols-2 gap-x-12 gap-y-5">
                            <div className="space-y-2">
                              <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-tighter">
                                <span>Output Potential</span>
                                <span className="text-white">{Math.round(weapon.damage * (1 + upgrades.damage * 0.05))} TPU</span>
                              </div>
                              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" style={{ width: `${(weapon.damage / 100) * 100}%` }} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-tighter">
                                <span>Cycle Speed</span>
                                <span className="text-white">{Math.round(1000 / weapon.fireRate)} R/S</span>
                              </div>
                              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" style={{ width: `${(100 / weapon.fireRate) * 10}%` }} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-tighter">
                                <span>Storage Cap</span>
                                <span className="text-white">{weapon.magSize} ROUNDS</span>
                              </div>
                              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ width: `${(weapon.magSize / 50) * 100}%` }} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-tighter">
                                <span>Operation Range</span>
                                <span className="text-white">{weapon.range} UNITS</span>
                              </div>
                              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" style={{ width: `${(weapon.range / 1500) * 100}%` }} />
                              </div>
                            </div>
                          </div>
      
                          <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                            <div className="text-[10px] text-slate-500 uppercase font-black tracking-tight flex flex-col gap-1">
                               <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${weapon.isAuto ? 'bg-cyan-500' : 'bg-slate-700'}`} />
                                  <span>{weapon.isAuto ? 'Automatic Trigger Group' : 'Precision Semi-Auto'}</span>
                               </div>
                               {weapon.isScoped && (
                                 <div className="flex items-center gap-2 text-cyan-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_cyan]" />
                                    <span>High-Magnification Scope Mounted</span>
                                 </div>
                               )}
                            </div>
                            <button 
                              onClick={() => {
                                sounds.playUiClick();
                                setMenuView('main');
                                setUpgradeTab('weapon');
                                setSelectedLabWeapon(wKey);
                                setGameState('upgrades');
                              }}
                              className="px-6 py-2.5 bg-yellow-500 text-slate-950 rounded-xl font-black uppercase text-[10px] hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                            >
                              Tech Augmentation
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
            </div>
          </motion.div>
        )}

        {menuView === 'difficulty' && (
          <motion.div 
            key="difficulty"
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="flex flex-col items-center z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto px-4 md:px-8 custom-scrollbar py-12"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl p-10 md:p-16 w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
                
                <div className="flex flex-col items-center mb-12">
                   <div className="w-16 h-16 bg-red-500/10 rounded-2xl border-2 border-red-500/30 flex items-center justify-center mb-4">
                      <Zap className="text-red-500" size={32} />
                   </div>
                   <h2 className="text-5xl md:text-6xl font-black text-white italic uppercase tracking-tighter text-center leading-none">Mission Protocol</h2>
                   <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-4 text-center max-w-sm">Authority override required. Select deployment threat level.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-12">
                  {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        sounds.playUiClick();
                        setDifficulty(key);
                        saveDifficulty(key);
                      }}
                      className={`group relative p-8 rounded-[2rem] border-2 text-left transition-all overflow-hidden ${
                        difficulty === key 
                          ? 'bg-white text-slate-950 border-white shadow-[0_20px_60px_rgba(255,255,255,0.15)] active:scale-95' 
                          : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/30 hover:bg-black/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Threat Level</span>
                           <span className="font-black uppercase text-3xl italic tracking-tighter leading-none">{key}</span>
                        </div>
                        <div className={`w-4 h-4 rounded-full ${difficulty === key ? 'bg-slate-900 animate-pulse' : ''}`} style={{ backgroundColor: difficulty !== key ? DIFFICULTIES[key].color : undefined }} />
                      </div>

                      <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold uppercase opacity-50 tracking-tight text-[10px]">Resource Density</span>
                          <span className="font-black tabular-nums">{DIFFICULTIES[key].hpMult}X CAP</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold uppercase opacity-50 tracking-tight text-[10px]">Hostile Threat</span>
                          <span className="font-black tabular-nums">{DIFFICULTIES[key].dmgMult}X DMG</span>
                        </div>
                        <div className={`flex justify-between items-center text-xs mt-4 pt-4 border-t ${difficulty === key ? 'border-slate-950/10 text-slate-700' : 'border-white/10 text-yellow-500'}`}>
                          <span className="font-black uppercase tracking-tighter italic">Credit Multiplier</span>
                          <span className="font-black tabular-nums">+{Math.round((DIFFICULTIES[key].creditMult - 1) * 100)}%</span>
                        </div>
                      </div>

                      {/* Decorative Background Elements on Active */}
                      {difficulty === key && (
                        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-slate-950/5 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                   <button 
                    onClick={() => {
                        sounds.playUiClick();
                        setMenuView('main');
                    }}
                    className="bg-white text-slate-950 px-16 py-5 rounded-2xl text-lg font-black uppercase tracking-tighter italic shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all"
                   >
                     Confirm Protocol
                   </button>
                </div>
            </div>
          </motion.div>
        )}

        {menuView === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
            className="w-full max-w-4xl z-10 py-12"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl p-8 md:p-16 w-full relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
                  <div className="flex items-center gap-8">
                    <div className="w-24 h-24 bg-cyan-500/10 rounded-3xl border-2 border-cyan-500/30 flex items-center justify-center shrink-0 relative group">
                      <div className="absolute inset-0 bg-cyan-500/10 rounded-3xl rotate-6 group-hover:rotate-12 transition-transform" />
                      <Users className="text-cyan-400 relative z-10" size={48} />
                    </div>
                    <div className="text-left">
                      <h2 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Operational Status</h2>
                      <div className="flex items-center gap-3 mt-4">
                        <span className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase tracking-[0.3em] bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                           <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                           Active Deployment
                        </span>
                        <span className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">ID: 99x-NANOBANANA</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                        sounds.playUiClick();
                        setMenuView('main');
                    }}
                    className="w-full md:w-auto px-10 py-5 bg-white/5 text-white/60 flex items-center justify-center rounded-2xl hover:bg-white hover:text-slate-950 transition-all border border-white/10 gap-3 group"
                  >
                    <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-black uppercase text-sm tracking-widest">Return Command</span>
                  </button>
                </div>
    
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col gap-2 group hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                       <Skull size={16} className="text-red-500/50" />
                       <span className="text-white/30 font-black text-[9px] uppercase tracking-[0.3em]">Total Kills</span>
                    </div>
                    <div className="text-4xl md:text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{lifetimeStats.totalKills.toLocaleString()}</div>
                  </div>
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col gap-2 group hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                       <Coins size={16} className="text-yellow-500/50" />
                       <span className="text-white/30 font-black text-[9px] uppercase tracking-[0.3em]">Gross Salvage</span>
                    </div>
                    <div className="text-4xl md:text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{lifetimeStats.totalCredits.toLocaleString()}</div>
                  </div>
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col gap-2 group hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                       <Award size={16} className="text-green-500/50" />
                       <span className="text-white/30 font-black text-[9px] uppercase tracking-[0.3em]">Force Successful</span>
                    </div>
                    <div className="text-4xl md:text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{lifetimeStats.totalWins}</div>
                  </div>
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col gap-2 group hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                       <Skull size={16} className="text-slate-500/50" />
                       <span className="text-white/30 font-black text-[9px] uppercase tracking-[0.3em]">Integrity Loss</span>
                    </div>
                    <div className="text-4xl md:text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{lifetimeStats.totalDeaths}</div>
                  </div>
                </div>
    
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                  <div className="bg-black/40 p-8 rounded-[2.5rem] border border-white/10 flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                       <h3 className="text-xs font-black text-white uppercase tracking-[0.4em] italic">Sector Mastery</h3>
                       <span className="text-[10px] text-cyan-400 font-bold uppercase">Peak WAVE {lifetimeStats.bestWave}</span>
                    </div>
                    <div className="flex gap-3 h-12">
                      {[1,2,3,4,5].map(w => (
                        <div key={w} className="flex-1 relative group">
                           <div className={`absolute inset-0 rounded-xl transition-all duration-500 ${w <= lifetimeStats.bestWave ? 'bg-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : 'bg-white/5'}`} />
                           {w <= lifetimeStats.bestWave && (
                             <div className="absolute inset-0 bg-white/20 rounded-xl animate-pulse" />
                           )}
                           <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${w <= lifetimeStats.bestWave ? 'text-slate-950' : 'text-white/20'}`}>{w}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-500 uppercase font-black leading-relaxed tracking-wider">
                       Simulation shows 100% viability up to WAVE {lifetimeStats.bestWave}. Training recommended for higher sector targets.
                    </p>
                  </div>

                  <div className="bg-black/40 p-8 rounded-[2.5rem] border border-white/10 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-[0.4em] italic mb-6">Preferred Protocol</h3>
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 rounded-3xl flex items-center justify-center border-4 border-white/10 group overflow-hidden relative shadow-2xl" style={{ backgroundColor: DIFFICULTIES[difficulty].color }}>
                            <div className="absolute inset-0 bg-white/20 mix-blend-overlay" />
                            <Shield size={32} className="text-white relative z-10" />
                         </div>
                         <div className="text-left">
                            <span className="text-white font-black text-3xl italic tracking-tighter uppercase leading-none">{difficulty}</span>
                            <div className="flex items-center gap-2 mt-2">
                               <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Configuration</span>
                            </div>
                         </div>
                      </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/5">
                       <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">
                          Global Ranking Position: <span className="text-white">ENCRYPTED</span>
                       </p>
                    </div>
                  </div>
                </div>
            </div>
          </motion.div>
        )}

        {menuView === 'arena' && (
          <motion.div
            key="arena"
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-5xl z-10 py-12"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-8 md:p-10 bg-slate-950/50 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl border-2 border-cyan-500/30 flex items-center justify-center">
                    <MapIcon size={40} className="text-cyan-400" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Sector Select</h2>
                    <span className="text-cyan-500/60 text-xs font-black uppercase tracking-[0.3em] mt-2 block">Choose Deployment Zone</span>
                  </div>
                </div>
                <button
                  onClick={() => { sounds.playUiClick(); setMenuView('main'); }}
                  className="w-full md:w-auto px-12 py-5 bg-white text-slate-950 font-black uppercase text-base rounded-2xl hover:bg-cyan-500 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                >
                  <ChevronLeft size={24} /> Return
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {arenas.map((a) => {
                    const acc = accentColors[a.accent];
                    const selected = a.id === selectedArenaId;
                    return (
                      <button
                        key={a.id}
                        onClick={() => { sounds.playUiClick(); setSelectedArenaId(a.id); }}
                        className={`group relative p-6 rounded-[2rem] border-2 text-left transition-all overflow-hidden bg-slate-950/60 backdrop-blur-md ${selected ? `${acc.ring} ${acc.glow} scale-[1.02]` : 'border-white/5 hover:border-white/20'}`}
                      >
                        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:18px_18px]" />
                        <div className="relative z-10 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${acc.text}`}>{selected ? 'Active' : 'Available'}</span>
                            <MapIcon size={18} className={acc.text} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{a.name}</h3>
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/50">{a.tagline}</p>
                          </div>
                          {/* arena thumb + mini map overlay */}
                          <div className="aspect-square w-full rounded-xl overflow-hidden border border-white/10 bg-black/60 relative">
                            {ASSETS.menu.arenaThumbs[a.id] && (
                              <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                                style={{ backgroundImage: `url(${ASSETS.menu.arenaThumbs[a.id]})` }}
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                            {/* mini map badge */}
                            <div className="absolute bottom-2 right-2 w-12 h-12 rounded-md border border-white/20 bg-black/70 backdrop-blur-sm p-0.5">
                              <div
                                className="w-full h-full grid"
                                style={{ gridTemplateColumns: `repeat(${a.mapData[0].length}, 1fr)`, gridTemplateRows: `repeat(${a.mapData.length}, 1fr)` }}
                              >
                                {a.mapData.flatMap((row, ry) => row.map((cell, cx) => (
                                  <div
                                    key={`${a.id}-${ry}-${cx}`}
                                    className={
                                      cell === 1 ? `bg-white/30` :
                                      cell === 2 ? 'bg-amber-500/60' :
                                      cell === 3 ? 'bg-fuchsia-500/60' :
                                      'bg-transparent'
                                    }
                                  />
                                )))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
