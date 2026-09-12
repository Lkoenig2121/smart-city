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
    ctx.fillStyle = "rgba(36, 48, 62, 0.1)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(180, 200, 220, 0.38)";
    ctx.lineWidth = 1.1;
    const count = 220;
    for (let i = 0; i < count; i++) {
      const drift = time * 420 + i * 47;
      const x = ((i * 97 + drift * 0.35) % (width + 40)) - 20;
      const y = ((i * 53 + drift) % (height + 50)) - 25;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y + 16);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "rgba(220, 230, 240, 0.12)";
    ctx.fillRect(0, 0, width, height);
    const count = 160;
    for (let i = 0; i < count; i++) {
      const drift = time * 55 + i * 31;
      const x = ((i * 131 + Math.sin(time + i) * 18 + drift * 0.25) % (width + 20)) - 10;
      const y = ((i * 79 + drift) % (height + 20)) - 10;
      const r = 1.1 + (i % 4) * 0.45;
      ctx.fillStyle = `rgba(255,255,255,${0.45 + (i % 5) * 0.08})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
