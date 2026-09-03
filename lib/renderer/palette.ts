import type { CityState } from "@/lib/city/types";
import { dayPhase } from "@/lib/simulation/city/cityTick";

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: string, b: string, t: number) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * amt, g * amt, b * amt);
}

export function alpha(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export interface Lighting {
  phase: ReturnType<typeof dayPhase>;
  ambient: number;
  sun: number;
  skyTop: string;
  skyBottom: string;
  tint: string;
  tintAmount: number;
  windowLit: number;
  waterSparkle: number;
}

export function lightingFor(state: CityState): Lighting {
  const phase = dayPhase(state);
  const t = state.clock.minuteOfDay / 60;

  if (phase === "dawn") {
    const k = (t - 5.5) / 1.7;
    return {
      phase,
      ambient: 0.62 + k * 0.28,
      sun: 0.7 + k * 0.25,
      skyTop: mix("#2a3358", "#6ea7d6", k),
      skyBottom: mix("#e7a46b", "#f3d7a8", k),
      tint: "#ffb070",
      tintAmount: 0.18,
      windowLit: 0.35,
      waterSparkle: 0.45,
    };
  }
  if (phase === "dusk") {
    const k = (t - 17.4) / 2.8;
    return {
      phase,
      ambient: 0.9 - k * 0.35,
      sun: 0.85 - k * 0.3,
      skyTop: mix("#4d78b5", "#1d2348", k),
      skyBottom: mix("#f0b27a", "#c26b4a", k),
      tint: "#ff8a4c",
      tintAmount: 0.16 + k * 0.08,
      windowLit: 0.2 + k * 0.7,
      waterSparkle: 0.55,
    };
  }
  if (phase === "night") {
    return {
      phase,
      ambient: 0.58,
      sun: 0.52,
      skyTop: "#111a38",
      skyBottom: "#1e3058",
      tint: "#2a3a7a",
      tintAmount: 0.18,
      windowLit: 0.92,
      waterSparkle: 0.22,
    };
  }
  return {
    phase,
    ambient: 1,
    sun: 1,
    skyTop: "#79b7ea",
    skyBottom: "#d7edfb",
    tint: "#ffffff",
    tintAmount: 0,
    windowLit: 0.04,
    waterSparkle: 0.7,
  };
}

export function lit(hex: string, light: Lighting, face: "left" | "right" | "top" | "ground") {
  const faceMul =
    face === "top" ? 1.08 : face === "right" ? 0.86 : face === "left" ? 0.72 : 0.95;
  const shaded = shade(hex, light.ambient * light.sun * faceMul);
  return light.tintAmount > 0 ? mix(shaded, light.tint, light.tintAmount) : shaded;
}
