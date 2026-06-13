// @ts-nocheck
/**
 * Quality preset detection + presets for renderer/scene.
 * Heuristic: GPU renderer string + cores.
 */
import type { QualityTier } from "./settings";

export interface QualityPreset {
  tier: "low" | "medium" | "high";
  pixelRatio: number;
  shadows: false | "basic" | "pcfsoft";
  bloom: boolean;
  propsDensity: number; // 0..1 multiplier
  anisotropy: number;
  maxLights: number;
}

const PRESETS: Record<"low" | "medium" | "high", QualityPreset> = {
  low: {
    tier: "low",
    pixelRatio: 1,
    shadows: false,
    bloom: false,
    propsDensity: 0.5,
    anisotropy: 1,
    maxLights: 4,
  },
  medium: {
    tier: "medium",
    pixelRatio: 1,
    shadows: "basic",
    bloom: false,
    propsDensity: 1,
    anisotropy: 4,
    maxLights: 8,
  },
  high: {
    tier: "high",
    pixelRatio: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1),
    shadows: "pcfsoft",
    bloom: true,
    propsDensity: 1,
    anisotropy: 8,
    maxLights: 16,
  },
};

function detectAuto(): "low" | "medium" | "high" {
  if (typeof window === "undefined") return "medium";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return "low";
    const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? ((gl as any).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : "";
    const r = (renderer || "").toLowerCase();
    const cores = navigator.hardwareConcurrency || 4;

    // Chromebook / integrated indicators. Note: devicePixelRatio must NOT
    // gate this — desktop 1080p monitors report dpr === 1 and would all be
    // misclassified as low-end.
    const isLowGpu = /intel|swiftshader|mali|adreno [3-5]\d\d|powervr|llvmpipe|chromebook/.test(r);
    const isHighGpu = /rtx|geforce|radeon rx|apple m[1-9]|arc a\d/.test(r);

    if (isLowGpu || cores <= 4) return "low";
    if (isHighGpu && cores >= 8) return "high";
    return "medium";
  } catch {
    return "medium";
  }
}

let cached: "low" | "medium" | "high" | null = null;

export function resolveQuality(tier: QualityTier): QualityPreset {
  if (tier === "auto") {
    if (!cached) cached = detectAuto();
    return PRESETS[cached];
  }
  return PRESETS[tier];
}
