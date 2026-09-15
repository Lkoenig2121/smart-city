import { diamondPoints, tileCenter } from "@/lib/city/iso";
import type { CityState, TrafficLight } from "@/lib/city/types";
import { densityAt, isSignalAgainstBuilding } from "@/lib/simulation/traffic/roadNetwork";
import { drawVehicle } from "./drawVehicles";
import { drawDiamond } from "./drawIso";
import { alpha, type Lighting } from "./palette";
import { isHiddenBehindBuilding } from "./pickBuilding";

export function drawTrafficOverlay(ctx: CanvasRenderingContext2D, state: CityState, light: Lighting) {
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.tiles[y][x].upgraded && state.tiles[y][x].road) {
        drawDiamond(ctx, x, y, alpha("#e8c36a", 0.12));
      }
    }
  }
  for (const work of state.roadWorks) {
    if (isHiddenBehindBuilding(state, work.x, work.y)) continue;
    drawWorks(ctx, work.x, work.y);
  }
  for (const lamp of state.trafficLights) {
    if (isHiddenBehindBuilding(state, lamp.x, lamp.y)) continue;
    if (isSignalAgainstBuilding(state, lamp.x, lamp.y)) continue;
    drawSignal(ctx, lamp, light);
  }
}

export function drawCongestionTint(ctx: CanvasRenderingContext2D, state: CityState) {
  for (const vehicle of state.vehicles) {
    const x = Math.round(vehicle.x);
    const y = Math.round(vehicle.y);
    if (densityAt(state, x, y) < 3) continue;
    if (isHiddenBehindBuilding(state, x, y)) continue;
    drawDiamond(ctx, x, y, alpha("#c0392b", 0.16));
  }
}

export function drawParkedCars(ctx: CanvasRenderingContext2D, state: CityState, light: Lighting) {
  for (const car of state.parked) {
    if (isHiddenBehindBuilding(state, car.x + car.ox, car.y + car.oy)) continue;
    drawVehicle(
      ctx,
      {
        id: car.id,
        kind: "car",
        color: car.color,
        x: car.x + car.ox,
        y: car.y + car.oy,
        path: [],
        pathIndex: 0,
        speed: 0,
        ownerId: null,
      },
      light,
    );
  }
}

function drawWorks(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const c = tileCenter(x, y);
  ctx.save();
  drawDiamond(ctx, x, y, alpha("#e67e22", 0.28));
  for (const [dx, dy] of [
    [-8, 4],
    [6, 2],
    [0, 8],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(c.x + dx, c.y + dy - 10);
    ctx.lineTo(c.x + dx - 4, c.y + dy);
    ctx.lineTo(c.x + dx + 4, c.y + dy);
    ctx.closePath();
    ctx.fillStyle = "#e67e22";
    ctx.fill();
    ctx.fillStyle = "#f4f6f7";
    ctx.fillRect(c.x + dx - 3, c.y + dy - 5, 6, 2);
  }
  ctx.restore();
}

function drawSignal(ctx: CanvasRenderingContext2D, light: TrafficLight, _light: Lighting) {
  const d = diamondPoints(light.x, light.y);
  const cx = (d.top.x + d.bottom.x) / 2;
  const cy = (d.top.y + d.bottom.y) / 2;
  const nsGreen = light.phase === 0;
  drawHead(ctx, cx - 11, cy - 16, nsGreen);
  drawHead(ctx, cx + 11, cy - 12, !nsGreen);
}

function drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, green: boolean) {
  ctx.fillStyle = "#2a2d32";
  ctx.fillRect(x - 3, y - 16, 6, 18);
  ctx.fillStyle = "#1a1c20";
  ctx.fillRect(x - 4, y - 17, 8, 12);
  ctx.beginPath();
  ctx.fillStyle = green ? "#3dcc6a" : "#444";
  ctx.arc(x, y - 13, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = green ? "#444" : "#e74c3c";
  ctx.arc(x, y - 8, 2.1, 0, Math.PI * 2);
  ctx.fill();
  if (green) {
    const glow = ctx.createRadialGradient(x, y - 13, 1, x, y - 13, 10);
    glow.addColorStop(0, "rgba(80, 220, 120, 0.45)");
    glow.addColorStop(1, "rgba(80, 220, 120, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 10, y - 23, 20, 20);
  }
}
