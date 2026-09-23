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
  const weather = state.weather?.kind ?? "clear";

  let light: Lighting;
  if (phase === "dawn") {
    const k = (t - 5.5) / 1.7;
    light = {
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
  } else if (phase === "dusk") {
    const k = (t - 17.4) / 2.8;
    light = {
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
  } else if (phase === "night") {
    light = {
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
  } else {
    light = {
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

  // Future City: bright neon twilight — readable LEDs without crushing blacks.
  if (state.id === "future") {
    if (phase === "day") {
      light = {
        ...light,
        ambient: 1.05,
        sun: 0.95,
        skyTop: "#6a9ad8",
        skyBottom: "#f0c8a8",
        tint: "#88c8ff",
        tintAmount: 0.1,
        windowLit: 0.85,
        waterSparkle: 0.55,
      };
    } else if (phase === "dusk" || phase === "dawn") {
      light = {
        ...light,
        ambient: Math.max(light.ambient, 0.88),
        skyTop: mix(light.skyTop, "#4a68b8", 0.35),
        skyBottom: mix(light.skyBottom, "#f0a070", 0.3),
        windowLit: Math.min(1, light.windowLit + 0.35),
        tint: "#ff8ad0",
        tintAmount: Math.max(light.tintAmount, 0.18),
      };
    } else {
      light = {
        ...light,
        ambient: 0.72,
        sun: 0.65,
        skyTop: "#1a2858",
        skyBottom: "#3a2868",
        windowLit: 1,
        tint: "#6a8cff",
        tintAmount: 0.2,
      };
    }
  }

  if (weather === "rain") {
    return {
      ...light,
      ambient: light.ambient * 0.78,
      sun: light.sun * 0.62,
      skyTop: mix(light.skyTop, "#4a5a6c", 0.45),
      skyBottom: mix(light.skyBottom, "#7a8694", 0.4),
      waterSparkle: light.waterSparkle * 0.25,
      windowLit: Math.min(1, light.windowLit + 0.12),
    };
  }
  if (weather === "snow") {
    return {
      ...light,
      ambient: light.ambient * 0.88,
      sun: light.sun * 0.7,
      skyTop: mix(light.skyTop, "#c5d4e4", 0.4),
      skyBottom: mix(light.skyBottom, "#e8eef4", 0.45),
      tint: mix(light.tint, "#d8e4f0", 0.35),
      tintAmount: Math.max(light.tintAmount, 0.12),
      waterSparkle: light.waterSparkle * 0.15,
    };
  }
  if (weather === "cloudy") {
    return {
      ...light,
      sun: light.sun * 0.82,
      skyTop: mix(light.skyTop, "#8aa0b4", 0.28),
      skyBottom: mix(light.skyBottom, "#c5d0da", 0.22),
    };
  }

  return light;
}

export function lit(hex: string, light: Lighting, face: "left" | "right" | "top" | "ground") {
  const faceMul =
    face === "top" ? 1.08 : face === "right" ? 0.86 : face === "left" ? 0.72 : 0.95;
  const shaded = shade(hex, light.ambient * light.sun * faceMul);
  return light.tintAmount > 0 ? mix(shaded, light.tint, light.tintAmount) : shaded;
}
