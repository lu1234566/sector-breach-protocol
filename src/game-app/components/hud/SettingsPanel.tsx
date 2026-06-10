import { motion } from 'motion/react';
import { useSettings, DEFAULT_SETTINGS, type QualityTier, type EnemyVisualMode } from '@/game-app/game/settings';

interface Props {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: Props) {
  const [settings, update] = useSettings();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[130] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md px-6"
    >
      <div className="text-[10px] tracking-[0.5em] text-cyan-400/80 uppercase mb-2">
        Operator Calibration
      </div>
      <h2 className="text-4xl font-black tracking-tighter text-white mb-8 uppercase italic">
        Settings
      </h2>

      <div className="w-full max-w-md flex flex-col gap-6 bg-slate-900/60 border border-cyan-500/20 rounded-md p-6">
        <SensSlider
          label="Mouse Sensitivity — X"
          value={settings.mouseSensX}
          onChange={(v) => update({ mouseSensX: v })}
        />
        <SensSlider
          label="Mouse Sensitivity — Y"
          value={settings.mouseSensY}
          onChange={(v) => update({ mouseSensY: v })}
        />

        <Toggle
          label="Invert Mouse X"
          value={settings.invertX}
          onChange={(v) => update({ invertX: v })}
        />
        <Toggle
          label="Invert Mouse Y"
          value={settings.invertY}
          onChange={(v) => update({ invertY: v })}
        />

        <QualityPicker
          value={settings.quality}
          onChange={(q) => update({ quality: q })}
        />

        <EnemyVisualModePicker
          value={settings.enemyVisualMode}
          onChange={(m) => update({ enemyVisualMode: m })}
        />

        <button
          onClick={() => update(DEFAULT_SETTINGS)}
          className="text-[10px] text-slate-400 hover:text-cyan-400 uppercase tracking-widest self-start transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <button
        onClick={onBack}
        className="mt-8 py-3 px-10 rounded-md bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-transform"
      >
        Back
      </button>
      <div className="mt-4 text-[10px] text-slate-500 tracking-widest uppercase">
        Preferences saved automatically
      </div>
    </motion.div>
  );
}

function SensSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-[10px] text-cyan-300/90 uppercase tracking-widest font-bold">
          {label}
        </span>
        <span className="font-mono text-xs text-white">{value.toFixed(2)}x</span>
      </div>
      <input
        type="range"
        min={0.1}
        max={3}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between py-1 group"
    >
      <span className="text-[10px] text-cyan-300/90 uppercase tracking-widest font-bold">
        {label}
      </span>
      <span
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? 'bg-cyan-400' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function QualityPicker({

  value,
  onChange,
}: {
  value: QualityTier;
  onChange: (q: QualityTier) => void;
}) {
  const options: { id: QualityTier; label: string; tag: string; desc: string }[] = [
    {
      id: 'auto',
      label: 'Auto',
      tag: 'Recommended',
      desc: 'Automatically chooses the best setting for your device.',
    },
    {
      id: 'low',
      label: 'Low / Performance',
      tag: 'Chromebook',
      desc: 'Best performance. Uses lightweight enemies and simplified world rendering.',
    },
    {
      id: 'medium',
      label: 'Medium / Balanced',
      tag: 'Laptop',
      desc: 'Balanced visuals. Uses some 3D assets with limited effects.',
    },
    {
      id: 'high',
      label: 'High / Full Visuals',
      tag: 'Desktop GPU',
      desc: 'Full visuals. Uses all new 3D assets, props and enhanced effects.',
    },
  ];
  return (
    <div>
      <div className="text-[10px] text-cyan-300/90 uppercase tracking-widest font-bold mb-2">
        Graphics Quality
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={`flex flex-col items-start text-left px-3 py-2 rounded border transition-colors ${
                active
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100'
                  : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold uppercase tracking-wider">{o.label}</span>
                <span className="text-[8px] uppercase tracking-widest opacity-60">{o.tag}</span>
              </div>
              <span className={`text-[9px] mt-1 leading-snug ${active ? 'text-cyan-200/90' : 'text-slate-500'}`}>
                {o.desc}
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-[9px] text-amber-400/80 uppercase tracking-widest mt-2">
        High mode may reduce performance on Chromebooks or low-end devices.
      </div>
      <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
        Changes will apply when restarting the mission.
      </div>
    </div>
  );
}

function EnemyVisualModePicker({
  value,
  onChange,
}: {
  value: EnemyVisualMode;
  onChange: (m: EnemyVisualMode) => void;
}) {
  const options: { id: EnemyVisualMode; label: string; desc: string }[] = [
    {
      id: 'auto',
      label: 'Auto / Stable',
      desc: 'Uses the safest current enemy renderer.',
    },
    {
      id: 'rig',
      label: 'Procedural Rig',
      desc: 'Uses animated part-based enemies.',
    },
    {
      id: 'glb',
      label: 'GLB Model Test',
      desc: 'Forces the original GLB enemy models for animation and positioning tests.',
    },
  ];
  return (
    <div>
      <div className="text-[10px] text-cyan-300/90 uppercase tracking-widest font-bold mb-2">
        Enemy Visual Mode
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={`flex flex-col items-start text-left px-3 py-2 rounded border transition-colors ${
                active
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100'
                  : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold uppercase tracking-wider">{o.label}</span>
              </div>
              <span className={`text-[9px] mt-1 leading-snug ${active ? 'text-cyan-200/90' : 'text-slate-500'}`}>
                {o.desc}
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-[9px] text-amber-400/80 uppercase tracking-widest mt-2">
        Affects Medium and High quality only. Low / Performance always uses the lightweight renderer.
      </div>
      <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
        Changes will apply when restarting the mission.
      </div>
    </div>
  );
}



