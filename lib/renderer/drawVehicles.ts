import { tileCenter } from "@/lib/city/iso";
import type { Vehicle } from "@/lib/city/types";
import { lit, shade, type Lighting } from "./palette";

export function drawVehicle(ctx: CanvasRenderingContext2D, vehicle: Vehicle, light: Lighting) {
  const c = tileCenter(vehicle.x, vehicle.y);
  const next = vehicle.path[Math.min(vehicle.pathIndex + 1, vehicle.path.length - 1)];
  const ang = next ? Math.atan2(next.y - vehicle.y, next.x - vehicle.x) : 0;
  const dir = (ang + Math.PI * 2) % (Math.PI * 2);
  const eastish = dir < Math.PI * 0.25 || dir > Math.PI * 1.75 || (dir > Math.PI * 0.75 && dir < Math.PI * 1.25);
  const bus = vehicle.kind === "bus";
  const truck = vehicle.kind === "truck" || vehicle.kind === "firetruck";
  const w = bus ? 16 : truck ? 14 : 11;
  const d = bus ? 8 : 6;
  const h = vehicle.kind === "bus" ? 8 : 6;
  const body = vehicle.kind === "ambulance" ? "#f4f6f7" : vehicle.kind === "firetruck" ? "#c0392b" : vehicle.color;
  const left = lit(shade(body, 0.78), light, "left");
  const right = lit(body, light, "right");
  const top = lit(shade(body, 1.08), light, "top");

  const ox = eastish ? 6 : 0;
  const oy = eastish ? 0 : 2;

  ctx.beginPath();
  ctx.fillStyle = "rgba(20,20,20,0.2)";
  ctx.ellipse(c.x + 2, c.y + 4, w * 0.55, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(c.x - w / 2 + ox, c.y + oy);
  ctx.lineTo(c.x + oy, c.y + d / 2 + oy);
  ctx.lineTo(c.x + oy, c.y + d / 2 + oy - h);
  ctx.lineTo(c.x - w / 2 + ox, c.y + oy - h);
  ctx.closePath();
  ctx.fillStyle = left;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(c.x + w / 2 + ox, c.y + oy);
  ctx.lineTo(c.x + oy, c.y + d / 2 + oy);
  ctx.lineTo(c.x + oy, c.y + d / 2 + oy - h);
  ctx.lineTo(c.x + w / 2 + ox, c.y + oy - h);
  ctx.closePath();
  ctx.fillStyle = right;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(c.x - w / 2 + ox, c.y + oy - h);
  ctx.lineTo(c.x + ox, c.y - d / 2 + oy - h);
  ctx.lineTo(c.x + w / 2 + ox, c.y + oy - h);
  ctx.lineTo(c.x + oy, c.y + d / 2 + oy - h);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();

  ctx.fillStyle = lit("#b9d7e8", light, "top");
  ctx.fillRect(c.x - 3 + ox, c.y - h - 1 + oy, 6, 3);

  if (vehicle.kind === "taxi") {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(c.x - 2 + ox, c.y - h - 3 + oy, 4, 2);
  }
}
