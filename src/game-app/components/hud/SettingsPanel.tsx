import { motion } from 'motion/react';
import { useSettings, DEFAULT_SETTINGS, type QualityTier } from '@/game-app/game/settings';

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
  const options: { id: QualityTier; label: string; hint: string }[] = [
    { id: 'auto', label: 'Auto', hint: 'Detect GPU' },
    { id: 'low', label: 'Low', hint: 'Chromebook' },
    { id: 'medium', label: 'Med', hint: 'Laptop' },
    { id: 'high', label: 'High', hint: 'Desktop GPU' },
  ];
  return (
    <div>
      <div className="text-[10px] text-cyan-300/90 uppercase tracking-widest font-bold mb-2">
        Graphics Quality
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={`flex flex-col items-center py-2 rounded border transition-colors ${
                active
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                  : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider">{o.label}</span>
              <span className="text-[8px] uppercase tracking-widest opacity-70">{o.hint}</span>
            </button>
          );
        })}
      </div>
      <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-2">
        Restart match for full effect
      </div>
    </div>
  );
}
