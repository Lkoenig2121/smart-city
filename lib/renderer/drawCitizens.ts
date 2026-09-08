import { tileCenter } from "@/lib/city/iso";
import type { Citizen, CityState } from "@/lib/city/types";
import { sidewalkOffset } from "@/lib/simulation/traffic/pathfinding";
import { lit, type Lighting } from "./palette";

export function drawCitizen(
  ctx: CanvasRenderingContext2D,
  citizen: Citizen,
  light: Lighting,
  lift = 0,
  state?: CityState,
) {
  if (citizen.activity === "sleep") return;
  if (citizen.activity === "work" && citizen.path.length < 2) return;

  const offset = state ? sidewalkOffset(state, citizen) : { x: 0, y: 0 };
  const raw = tileCenter(citizen.x + offset.x, citizen.y + offset.y);
  const c = { x: raw.x, y: raw.y - lift };
  const bob = Math.sin(citizen.x * 12 + citizen.y * 9) * 0.6;
  ctx.beginPath();
  ctx.fillStyle = "rgba(20,20,20,0.18)";
  ctx.ellipse(c.x + 1, c.y + 3, 3.2, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit(citizen.color, light, "right");
  ctx.fillRect(c.x - 1.4, c.y - 6 + bob, 2.8, 6);
  ctx.beginPath();
  ctx.fillStyle = lit("#f0d2b6", light, "top");
  ctx.arc(c.x, c.y - 8 + bob, 1.8, 0, Math.PI * 2);
  ctx.fill();
}
