import type { Building } from "@/lib/city/types";
import { lodgingUse } from "./lodging";
import { isSubwayStation } from "./subway";
import { venueRole } from "./venues";

export type PoiKind =
  | "subway"
  | "hotel"
  | "residences"
  | "hospital"
  | "police"
  | "fire"
  | "school"
  | "city_hall"
  | "stadium"
  | "bank"
  | "office"
  | "bus"
  | "marina"
  | "beach"
  | "ferris";

export const POI_LEGEND: { kind: PoiKind; label: string }[] = [
  { kind: "subway", label: "Subway" },
  { kind: "hotel", label: "Hotel" },
  { kind: "hospital", label: "Hospital" },
  { kind: "police", label: "Police" },
  { kind: "fire", label: "Fire" },
  { kind: "school", label: "School" },
  { kind: "city_hall", label: "Hall" },
  { kind: "stadium", label: "Stadium" },
  { kind: "bank", label: "Bank" },
  { kind: "office", label: "Jobs" },
  { kind: "bus", label: "Bus" },
  { kind: "marina", label: "Marina" },
  { kind: "beach", label: "Beach" },
  { kind: "ferris", label: "Pier" },
];

export function poiKind(building: Building): PoiKind | null {
  if (isSubwayStation(building)) return "subway";
  const lodging = lodgingUse(building);
  if (lodging === "hotel") return "hotel";
  if (lodging === "residences") return "residences";
  if (building.kind === "hospital") return "hospital";
  if (building.kind === "police") return "police";
  if (building.kind === "fire") return "fire";
  if (building.kind === "school") return "school";
  if (building.kind === "city_hall") return "city_hall";
  if (building.kind === "baseball_stadium") return "stadium";
  if (isJobBuilding(building)) return "office";
  if (building.stats.extra?.venue === "bank") return "bank";
  return null;
}

/** Offices you can actually work at, without covering downtown in pins. */
export function isJobBuilding(building: Building) {
  if (venueRole(building) !== "office") return false;
  if (building.kind === "skyscraper" || building.kind === "tower") return true;
  return building.stats.extra?.venue === "office";
}

const FILL: Record<PoiKind, string> = {
  subway: "#e8c36a",
  hotel: "#c9a44c",
  residences: "#8a5a3a",
  hospital: "#c0392b",
  police: "#1f4d8c",
  fire: "#d35400",
  school: "#2f5d4a",
  city_hall: "#b8953a",
  stadium: "#1f4d8c",
  bank: "#2f5d4a",
  office: "#3d9ad1",
  bus: "#5d7384",
  marina: "#1d6a8a",
  beach: "#d6c38a",
  ferris: "#c45c4a",
};

export function drawPoiMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: PoiKind,
  radius = 4.4,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = FILL[kind];
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "#f7f4ea";
  ctx.strokeStyle = "#f7f4ea";
  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawGlyph(ctx, cx, cy, kind, radius);
  ctx.restore();
}

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: PoiKind,
  r: number,
) {
  switch (kind) {
    case "subway":
      ctx.font = `bold ${r * 1.35}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("M", cx, cy + 0.2);
      break;
    case "hotel":
      ctx.fillRect(cx - r * 0.45, cy - r * 0.15, r * 0.9, r * 0.38);
      ctx.fillRect(cx - r * 0.45, cy - r * 0.42, r * 0.22, r * 0.28);
      ctx.fillRect(cx + r * 0.23, cy - r * 0.42, r * 0.22, r * 0.28);
      break;
    case "residences":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.45, cy - r * 0.05);
      ctx.lineTo(cx + r * 0.45, cy + r * 0.42);
      ctx.lineTo(cx - r * 0.45, cy + r * 0.42);
      ctx.lineTo(cx - r * 0.45, cy - r * 0.05);
      ctx.closePath();
      ctx.fill();
      break;
    case "hospital":
      ctx.fillRect(cx - r * 0.16, cy - r * 0.42, r * 0.32, r * 0.84);
      ctx.fillRect(cx - r * 0.42, cy - r * 0.16, r * 0.84, r * 0.32);
      break;
    case "police":
      star(ctx, cx, cy, r * 0.48, 5);
      break;
    case "fire":
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.4);
      ctx.quadraticCurveTo(cx - r * 0.45, cy + r * 0.1, cx - r * 0.15, cy - r * 0.15);
      ctx.quadraticCurveTo(cx - r * 0.05, cy - r * 0.45, cx, cy - r * 0.5);
      ctx.quadraticCurveTo(cx + r * 0.12, cy - r * 0.2, cx + r * 0.38, cy);
      ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 0.25, cx, cy + r * 0.4);
      ctx.fill();
      break;
    case "school":
      ctx.font = `bold ${r * 1.25}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("A", cx, cy + 0.2);
      break;
    case "city_hall":
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.08, r * 0.28, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - r * 0.42, cy - r * 0.08, r * 0.84, r * 0.48);
      break;
    case "stadium":
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.48, r * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy);
      ctx.lineTo(cx + r * 0.22, cy);
      ctx.stroke();
      break;
    case "bank":
      ctx.fillRect(cx - r * 0.4, cy + r * 0.22, r * 0.8, r * 0.14);
      ctx.fillRect(cx - r * 0.32, cy - r * 0.18, r * 0.12, r * 0.4);
      ctx.fillRect(cx - r * 0.06, cy - r * 0.18, r * 0.12, r * 0.4);
      ctx.fillRect(cx + r * 0.2, cy - r * 0.18, r * 0.12, r * 0.4);
      ctx.fillRect(cx - r * 0.4, cy - r * 0.3, r * 0.8, r * 0.14);
      break;
    case "office":
      ctx.strokeStyle = "#f7f4ea";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.16, cy - r * 0.08);
      ctx.lineTo(cx - r * 0.16, cy - r * 0.28);
      ctx.lineTo(cx + r * 0.16, cy - r * 0.28);
      ctx.lineTo(cx + r * 0.16, cy - r * 0.08);
      ctx.stroke();
      ctx.fillRect(cx - r * 0.42, cy - r * 0.1, r * 0.84, r * 0.5);
      break;
    case "bus":
      ctx.fillRect(cx - r * 0.42, cy - r * 0.22, r * 0.84, r * 0.42);
      ctx.fillStyle = FILL.bus;
      ctx.fillRect(cx - r * 0.28, cy - r * 0.12, r * 0.22, r * 0.16);
      ctx.fillRect(cx + r * 0.02, cy - r * 0.12, r * 0.22, r * 0.16);
      break;
    case "marina":
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.48);
      ctx.lineTo(cx, cy + r * 0.42);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.18);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.08);
      ctx.lineTo(cx, cy + r * 0.22);
      ctx.closePath();
      ctx.fill();
      break;
    case "beach":
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.12, r * 0.38, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.12);
      ctx.lineTo(cx, cy - r * 0.42);
      ctx.stroke();
      break;
    case "ferris":
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.06, r * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.22, cy + r * 0.42);
      ctx.lineTo(cx, cy - r * 0.06);
      ctx.lineTo(cx + r * 0.22, cy + r * 0.42);
      ctx.stroke();
      break;
  }
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
