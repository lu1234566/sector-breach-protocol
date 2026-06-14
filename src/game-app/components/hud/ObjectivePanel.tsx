import { motion } from "motion/react";
import { Target, Cpu, Shield, LogOut } from "lucide-react";
import type { ObjectiveRuntime } from "@/game-app/game/types";

const ICONS: Record<ObjectiveRuntime["kind"], typeof Target> = {
  eliminate: Target,
  hack: Cpu,
  defend: Shield,
  extract: LogOut,
};

interface Props {
  runtime: ObjectiveRuntime | null;
  enemiesRemaining: number;
}

export function ObjectivePanel({ runtime, enemiesRemaining }: Props) {
  if (!runtime || runtime.status !== "active") return null;
  const pct = Math.max(0, Math.min(1, runtime.progress));
  const seconds = Math.max(0, Math.ceil(runtime.timer / 1000));
  const Icon = ICONS[runtime.kind] ?? Target;

  let detail = "";
  if (runtime.kind === "hack") {
    detail = runtime.inZone ? `Uploading · ${seconds}s` : "Enter Zone";
  } else if (runtime.kind === "defend") {
    const corePct = Math.round(((runtime.coreHp ?? 0) / (runtime.coreMaxHp ?? 1)) * 100);
    detail = `Core ${corePct}% · ${seconds}s left`;
  } else if (runtime.kind === "extract") {
    detail = runtime.extractActive
      ? `Reach Zone · ${seconds}s`
      : `Eliminate ${runtime.killCount}/${runtime.killTarget ?? 0}`;
  } else {
    detail = `${enemiesRemaining} hostiles remaining`;
  }

  // Defend core HP overrides progress bar visualization
  const barPct =
    runtime.kind === "defend" && runtime.coreMaxHp
      ? (runtime.coreHp ?? 0) / runtime.coreMaxHp
      : pct;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 px-5 py-2 rounded-md border border-cyan-400/40 bg-slate-950/70 backdrop-blur-md shadow-[0_0_30px_rgba(34,211,238,0.18)]"
    >
      <div className="flex items-center gap-2">
        <Icon size={12} className="text-cyan-300" />
        <span className="text-[10px] font-black tracking-[0.4em] text-white uppercase">
          {runtime.label}
        </span>
      </div>
      <div className="text-[8px] tracking-[0.25em] font-bold text-cyan-300/80 uppercase">
        {detail}
      </div>
      <div className="h-0.5 w-52 bg-cyan-500/15 overflow-hidden rounded-full">
        <motion.div
          className={`h-full shadow-[0_0_8px_rgba(34,211,238,0.8)] ${
            runtime.kind === "defend"
              ? "bg-gradient-to-r from-rose-400 to-cyan-300"
              : "bg-gradient-to-r from-cyan-400 to-cyan-200"
          }`}
          animate={{ width: `${barPct * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
    </motion.div>
  );
}
