import type { CityState } from "@/lib/city/types";

export function drawWeatherOverlay(
  ctx: CanvasRenderingContext2D,
  state: CityState,
  width: number,
  height: number,
  time: number,
) {
  const kind = state.weather?.kind;
  if (kind !== "rain" && kind !== "snow") return;

  ctx.save();
  if (kind === "rain") {
    ctx.fillStyle = "rgba(36, 48, 62, 0.08)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(180, 200, 220, 0.32)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    const count = 90;
    for (let i = 0; i < count; i++) {
      const drift = time * 420 + i * 47;
      const x = ((i * 97 + drift * 0.35) % (width + 40)) - 20;
      const y = ((i * 53 + drift) % (height + 50)) - 25;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y + 16);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(220, 230, 240, 0.1)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.beginPath();
    const count = 70;
    for (let i = 0; i < count; i++) {
      const drift = time * 55 + i * 31;
      const x = ((i * 131 + Math.sin(time + i) * 18 + drift * 0.25) % (width + 20)) - 10;
      const y = ((i * 79 + drift) % (height + 20)) - 10;
      ctx.moveTo(x + 1.3, y);
      ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.restore();
}
