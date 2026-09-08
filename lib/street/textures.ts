import * as THREE from "three";

/**
 * All facade art is generated at runtime onto small canvases and tiled, so the
 * city needs no image assets. Each style produces two textures: a colour map
 * (white walls so the building's own colour tints it) and an emissive mask
 * containing only the glass, used to light windows after dark.
 */
export type FacadeStyle = "residential" | "office" | "glass" | "civic" | "brick";

export interface Facade {
  map: THREE.Texture;
  emissive: THREE.Texture;
}

/** One texture cell covers a single window bay by a single storey. */
export const BAY_W = 3.6;
export const FLOOR_H = 3.2;

const CELL = 96;

function canvas(size = CELL) {
  const el = document.createElement("canvas");
  el.width = size;
  el.height = size;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return { el, ctx };
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number, alpha: number) {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 200 + Math.random() * 55;
    ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

function texture(el: HTMLCanvasElement, srgb: boolean) {
  const tex = new THREE.CanvasTexture(el);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface CellSpec {
  /** Window rectangle within the cell, in 0..1 units. */
  win: { x: number; y: number; w: number; h: number };
  wall: string;
  frame: string;
  glass: string;
  /** Extra detailing drawn over the wall. */
  detail?: (ctx: CanvasRenderingContext2D, size: number) => void;
}

const SPECS: Record<FacadeStyle, CellSpec> = {
  residential: {
    win: { x: 0.26, y: 0.22, w: 0.48, h: 0.44 },
    wall: "#ffffff",
    frame: "#d8d2c8",
    glass: "#6f7d88",
    detail: (ctx, s) => {
      // Sill under the window and a faint storey line.
      ctx.fillStyle = "#cdc6ba";
      ctx.fillRect(s * 0.22, s * 0.66, s * 0.56, s * 0.035);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, s * 0.95, s, s * 0.05);
    },
  },
  brick: {
    win: { x: 0.28, y: 0.24, w: 0.44, h: 0.42 },
    wall: "#ffffff",
    frame: "#e6ded2",
    glass: "#5f6d78",
    detail: (ctx, s) => {
      // Brick courses.
      ctx.strokeStyle = "rgba(0,0,0,0.07)";
      ctx.lineWidth = 1;
      const rows = 12;
      for (let r = 0; r <= rows; r++) {
        const y = (r / rows) * s;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y);
        ctx.stroke();
        const offset = r % 2 === 0 ? 0 : s / 8;
        for (let c = 0; c <= 4; c++) {
          const x = offset + (c / 4) * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + s / rows);
          ctx.stroke();
        }
      }
      ctx.fillStyle = "#e2d8c8";
      ctx.fillRect(s * 0.24, s * 0.68, s * 0.52, s * 0.04);
    },
  },
  office: {
    win: { x: 0.1, y: 0.18, w: 0.8, h: 0.5 },
    wall: "#ffffff",
    frame: "#b9bec4",
    glass: "#54697a",
    detail: (ctx, s) => {
      // Spandrel band below the ribbon window.
      ctx.fillStyle = "#e8eaec";
      ctx.fillRect(0, s * 0.72, s, s * 0.2);
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, s * 0.94, s, s * 0.06);
    },
  },
  glass: {
    win: { x: 0.06, y: 0.08, w: 0.88, h: 0.76 },
    wall: "#ffffff",
    frame: "#9aa4ad",
    glass: "#3f5a70",
    detail: (ctx, s) => {
      // Vertical mullion catching the light.
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(s * 0.48, 0, s * 0.035, s);
    },
  },
  civic: {
    win: { x: 0.3, y: 0.14, w: 0.4, h: 0.6 },
    wall: "#ffffff",
    frame: "#ded6c6",
    glass: "#4f5f6b",
    detail: (ctx, s) => {
      // Stone courses and a moulding at the storey break.
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1.5;
      for (let r = 1; r < 4; r++) {
        const y = (r / 4) * s;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#efe7d8";
      ctx.fillRect(0, s * 0.9, s, s * 0.1);
    },
  },
};

function drawCell(style: FacadeStyle, emissive: boolean) {
  const spec = SPECS[style];
  const { el, ctx } = canvas();
  const s = CELL;

  if (emissive) {
    // Emissive pass: everything black except the glass.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, s, s);
  } else {
    ctx.fillStyle = spec.wall;
    ctx.fillRect(0, 0, s, s);
    spec.detail?.(ctx, s);
    noise(ctx, s, 260, 0.05);
  }

  const w = spec.win;
  const x = w.x * s;
  const y = w.y * s;
  const ww = w.w * s;
  const wh = w.h * s;

  if (!emissive) {
    // Frame, then recessed glass with a diagonal highlight.
    ctx.fillStyle = spec.frame;
    ctx.fillRect(x - 2, y - 2, ww + 4, wh + 4);
    ctx.fillStyle = spec.glass;
    ctx.fillRect(x, y, ww, wh);

    const grad = ctx.createLinearGradient(x, y, x + ww, y + wh);
    grad.addColorStop(0, "rgba(255,255,255,0.34)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.05)");
    grad.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, ww, wh);

    // Glazing bar so panes read at close range.
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + ww / 2 - 0.6, y, 1.2, wh);
  } else {
    // Only some bays are lit, so the tower is not uniformly bright.
    const lit = Math.random() < 0.55;
    if (lit) {
      const warmth = 200 + Math.floor(Math.random() * 55);
      ctx.fillStyle = `rgb(${warmth}, ${Math.floor(warmth * 0.85)}, ${Math.floor(warmth * 0.62)})`;
      ctx.fillRect(x, y, ww, wh);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x + ww / 2 - 0.6, y, 1.2, wh);
    }
  }

  return el;
}

const cache = new Map<FacadeStyle, Facade>();

export function facade(style: FacadeStyle): Facade {
  const hit = cache.get(style);
  if (hit) return hit;
  const made: Facade = {
    map: texture(drawCell(style, false), true),
    emissive: texture(drawCell(style, true), true),
  };
  cache.set(style, made);
  return made;
}

let asphaltCache: THREE.Texture | null = null;

export function asphaltTexture() {
  if (asphaltCache) return asphaltCache;
  const { el, ctx } = canvas(128);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 128);
  // Aggregate speckle plus a few hairline cracks.
  for (let i = 0; i < 2600; i++) {
    const g = 190 + Math.random() * 65;
    ctx.fillStyle = `rgba(${g},${g},${g},0.5)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.4, 1.4);
  }
  ctx.strokeStyle = "rgba(120,120,120,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    let x = Math.random() * 128;
    let y = Math.random() * 128;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  asphaltCache = texture(el, true);
  return asphaltCache;
}

let rippleCache: THREE.Texture | null = null;

/** Cheap normal map for the river surface. */
export function rippleNormal() {
  if (rippleCache) return rippleCache;
  const size = 128;
  const { el, ctx } = canvas(size);
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Two crossed sine trains approximate a rippled surface.
      const h1 = Math.sin((x / size) * Math.PI * 6) * Math.cos((y / size) * Math.PI * 4);
      const h2 = Math.sin(((x + y) / size) * Math.PI * 9) * 0.5;
      const dx = Math.cos((x / size) * Math.PI * 6) * 0.5 + h2 * 0.3;
      const dy = Math.cos((y / size) * Math.PI * 4) * 0.5 + h2 * 0.3;
      const i = (y * size + x) * 4;
      image.data[i] = 128 + dx * 90;
      image.data[i + 1] = 128 + dy * 90;
      image.data[i + 2] = 235 + (h1 + h2) * 8;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  rippleCache = texture(el, false);
  return rippleCache;
}

/** Vertical gradient used as the sky dome backdrop. */
export function skyTexture(top: string, bottom: string) {
  const { el, ctx } = canvas(64);
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, bottom);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
