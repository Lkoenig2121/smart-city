import { tileCenter } from "@/lib/city/iso";
import type { Citizen, CityState } from "@/lib/city/types";
import { sidewalkOffset } from "@/lib/simulation/traffic/pathfinding";
import { citizenIsOutdoors } from "@/lib/simulation/citizens/citizenBehavior";
import { citizenHairColor, citizenHairStyle } from "@/lib/simulation/citizens/citizenLook";
import { lit, type Lighting } from "./palette";

export function drawCitizen(
  ctx: CanvasRenderingContext2D,
  citizen: Citizen,
  light: Lighting,
  lift = 0,
  state?: CityState,
) {
  if (!citizenIsOutdoors(citizen)) return;

  const offset = state ? sidewalkOffset(state, citizen) : { x: 0, y: 0 };
  const raw = tileCenter(citizen.x + offset.x, citizen.y + offset.y);
  const c = { x: raw.x, y: raw.y - lift };
  const bob = Math.sin(citizen.x * 14 + citizen.y * 9) * 0.7;
  ctx.beginPath();
  ctx.fillStyle = "rgba(20,20,20,0.2)";
  ctx.ellipse(c.x + 1, c.y + 3.4, 3.6, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit(citizen.color, light, "right");
  ctx.fillRect(c.x - 1.7, c.y - 7 + bob, 3.4, 7);
  ctx.beginPath();
  ctx.fillStyle = lit("#f0d2b6", light, "top");
  ctx.arc(c.x, c.y - 9 + bob, 2.05, 0, Math.PI * 2);
  ctx.fill();
  const style = citizenHairStyle(citizen.id);
  const hairY = c.y - (style === 2 ? 9.4 : 10.15) + bob;
  const hairRx = style === 0 ? 1.95 : 2.2;
  const hairRy = style === 0 ? 1.05 : style === 1 ? 1.45 : 1.85;
  ctx.beginPath();
  ctx.fillStyle = lit(citizenHairColor(citizen.id), light, "top");
  ctx.ellipse(c.x, hairY, hairRx, hairRy, 0, Math.PI, 0, true);
  ctx.fill();
}
