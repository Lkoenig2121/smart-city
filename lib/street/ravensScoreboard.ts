import { GAME_HOURS_LABEL, type StadiumGame } from "@/lib/city/stadium";

const GREEN = "#2ea44a";
const GREEN_DARK = "#1e7a34";
const GREEN_DEEP = "#17662a";
const CREAM = "#f4f1ea";
const YELLOW = "#ffe14a";
const RED = "#e31b23";
const WHITE = "#fffdf6";
const NAVY = "#16325c";

export interface ScoreboardClock {
  hour24: number;
  minute: number;
  time: string;
}

/** Backyard-style park board: innings, RHE, count lamps, and the on-deck line. */
export function paintRavensScoreboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  game: StadiumGame | null,
  clock: ScoreboardClock,
  time: number,
  club: { shortName: string; visitorShort: string; fullName: string } = {
    shortName: "Ravens",
    visitorShort: "Bears",
    fullName: "Ravens Baseball",
  },
) {
  ctx.clearRect(0, 0, w, h);

  const sky = ctx.createLinearGradient(0, 0, 0, 230);
  sky.addColorStop(0, "#7ec4f0");
  sky.addColorStop(1, "#c5e4a4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, 240);
  paintCloud(ctx, 80, 48, 0.9);
  paintCloud(ctx, w - 220, 36, 1.05);

  const flutter = Math.sin(time * 2.2);
  paintFlag(ctx, 70, 28, -0.18 + flutter * 0.04);
  paintFlag(ctx, 210, 18, 0.12 + flutter * 0.05);
  paintFlag(ctx, w - 250, 20, -0.1 + flutter * 0.03);
  paintFlag(ctx, w - 90, 30, 0.16 + flutter * 0.04);

  paintMegaphone(ctx, 340, 78, 1);
  paintMegaphone(ctx, w - 420, 78, -1);
  paintBaseballClock(ctx, w / 2, 108, 78, clock.hour24, clock.minute);

  roundRect(ctx, 18, 188, w - 36, h - 206, 28);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.strokeStyle = "#d7d0c4";
  ctx.lineWidth = 6;
  ctx.stroke();

  roundRect(ctx, 36, 206, w - 72, h - 242, 18);
  ctx.fillStyle = GREEN;
  ctx.fill();
  ctx.strokeStyle = GREEN_DARK;
  ctx.lineWidth = 8;
  ctx.stroke();

  paintTitleBanner(ctx, w / 2, 214, club.fullName.includes("Baseball") ? club.fullName : `${club.shortName} Baseball`);

  const boardX = 64;
  const boardY = 278;
  const boardW = w - 128;
  const teamW = 268;
  const rheW = 210;
  const inningsW = boardW - teamW - rheW;
  const inningW = inningsW / 9;
  const rowH = 78;

  ctx.fillStyle = WHITE;
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TEAM", boardX + teamW / 2, boardY + 22);

  ctx.beginPath();
  ctx.moveTo(boardX + 18, boardY + 40);
  ctx.lineTo(boardX + teamW - 18, boardY + 40);
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 3;
  ctx.stroke();

  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = WHITE;
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(String(i + 1), boardX + teamW + inningW * (i + 0.5), boardY + 22);
  }
  const rhe = ["R", "H", "E"];
  for (let i = 0; i < 3; i++) {
    ctx.fillText(rhe[i], boardX + teamW + inningsW + 70 * i + 35, boardY + 22);
  }

  const visitors = {
    name: club.visitorShort,
    script: true,
    line: game?.visitorsLine ?? emptyLine(),
    runs: game?.visitors ?? 0,
    hits: game?.visitorsHits ?? 0,
    errors: game?.visitorsErrors ?? 0,
    accent: "#c0392b",
  };
  const ravens = {
    name: club.shortName,
    script: true,
    line: game?.ravensLine ?? emptyLine(),
    runs: game?.ravens ?? 0,
    hits: game?.ravensHits ?? 0,
    errors: game?.ravensErrors ?? 0,
    accent: NAVY,
  };

  paintTeamRow(ctx, boardX, boardY + 46, teamW, inningW, inningsW, rowH, visitors, "bears");
  paintTeamRow(ctx, boardX, boardY + 46 + rowH + 10, teamW, inningW, inningsW, rowH, ravens, "ravens");

  const lampY = boardY + 46 + rowH * 2 + 36;
  paintCountLamps(ctx, boardX + 8, lampY, "BALLS", 4, game?.balls ?? 0, "#3d8bfd");
  paintCountLamps(ctx, boardX + boardW * 0.22, lampY, "STRIKES", 3, game?.strikes ?? 0, "#e6c84a");
  paintCountLamps(ctx, boardX + boardW * 0.42, lampY, "OUTS", 3, game?.outs ?? 0, "#e24b4b");

  const brandW = 210;
  const brandX = boardX + boardW * 0.62;
  roundRect(ctx, brandX, lampY - 18, brandW, 46, 8);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RAVEN-TRONIC", brandX + brandW / 2, lampY + 6);

  paintStatusLamp(ctx, boardX + boardW * 0.82, lampY, "HIT", game?.hitLight ?? false, "#7CFF7C");
  paintStatusLamp(ctx, boardX + boardW * 0.91, lampY, "ERROR", game?.errorLight ?? false, "#ff5a5a");

  const boxY = lampY + 58;
  const boxH = h - boxY - 48;
  const gap = 18;
  const boxW = (boardW - gap * 2) / 3;
  const atBatLabel = game?.playing ? (game.top ? "BEARS" : "RAVENS") : "";
  paintNameBox(ctx, boardX, boxY, boxW, boxH, "AT BAT:", game?.atBat || (game ? "FINAL" : `First pitch ${GAME_HOURS_LABEL.split("–")[0]}`), atBatLabel);
  paintNameBox(ctx, boardX + boxW + gap, boxY, boxW, boxH, "ON DECK:", game?.onDeck ?? "", "");
  paintNameBox(ctx, boardX + (boxW + gap) * 2, boxY, boxW, boxH, "IN THE HOLE:", game?.inTheHole ?? "", "");

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(clock.time, w - 56, h - 28);
}

function emptyLine() {
  return Array.from({ length: 9 }, () => null as number | null);
}

function paintTitleBanner(ctx: CanvasRenderingContext2D, cx: number, cy: number, title = "Ravens Baseball") {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(-320, 18);
  ctx.lineTo(-300, -28);
  ctx.lineTo(300, -28);
  ctx.lineTo(320, 18);
  ctx.closePath();
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.strokeStyle = GREEN_DEEP;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.font = "italic bold 44px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 8;
  ctx.strokeText(title, 0, -4);
  ctx.fillText(title, 0, -4);
  ctx.restore();
}

function paintTeamRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  teamW: number,
  inningW: number,
  inningsW: number,
  rowH: number,
  team: {
    name: string;
    line: Array<number | null>;
    runs: number;
    hits: number;
    errors: number;
    accent: string;
  },
  mark: "ravens" | "bears",
) {
  roundRect(ctx, x, y, teamW - 10, rowH, 8);
  ctx.fillStyle = team.accent;
  ctx.fill();
  paintTeamMark(ctx, x + 38, y + rowH / 2, mark);
  ctx.fillStyle = WHITE;
  ctx.font = "italic bold 34px Georgia, serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(team.name, x + 72, y + rowH / 2 + 2);

  for (let i = 0; i < 9; i++) {
    paintDigitCell(ctx, x + teamW + i * inningW + 4, y, inningW - 8, rowH, team.line[i]);
  }
  paintDigitCell(ctx, x + teamW + inningsW + 4, y, 62, rowH, team.runs);
  paintDigitCell(ctx, x + teamW + inningsW + 74, y, 62, rowH, team.hits);
  paintDigitCell(ctx, x + teamW + inningsW + 144, y, 62, rowH, team.errors);
}

function paintDigitCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number | null | undefined,
) {
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = "#08160c";
  ctx.fill();
  if (value == null) return;
  ctx.fillStyle = YELLOW;
  ctx.font = `bold ${Math.floor(h * 0.62)}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), x + w / 2, y + h / 2 + 2);
}

function paintCountLamps(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  count: number,
  lit: number,
  color: string,
) {
  ctx.fillStyle = WHITE;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
  const start = x + ctx.measureText(label).width + 14;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(start + i * 22, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < lit ? color : "#0d2a14";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function paintStatusLamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  on: boolean,
  color: string,
) {
  ctx.fillStyle = WHITE;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
  ctx.beginPath();
  ctx.arc(x + ctx.measureText(label).width + 16, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = on ? color : "#0d2a14";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function paintNameBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  name: string,
  sub: string,
) {
  ctx.fillStyle = WHITE;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + 6, y);
  roundRect(ctx, x, y + 26, w, h - 26, 8);
  ctx.fillStyle = "#08160c";
  ctx.fill();
  if (!name) return;
  ctx.fillStyle = YELLOW;
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, x + w / 2, y + 26 + (h - 26) / 2 - (sub ? 10 : 0));
  if (sub) {
    ctx.fillStyle = "#9fe8a8";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(sub, x + w / 2, y + 26 + (h - 26) / 2 + 18);
  }
}

function paintTeamMark(ctx: CanvasRenderingContext2D, x: number, y: number, mark: "ravens" | "bears") {
  ctx.save();
  ctx.translate(x, y);
  if (mark === "ravens") {
    ctx.fillStyle = "#e8c36a";
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.quadraticCurveTo(-18, -16, 2, -18);
    ctx.quadraticCurveTo(20, -8, 16, 10);
    ctx.quadraticCurveTo(2, 16, -16, 8);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(6, -6, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.lineTo(24, -6);
    ctx.lineTo(14, 4);
    ctx.fill();
  } else {
    ctx.fillStyle = "#8b5a2b";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4a574";
    ctx.beginPath();
    ctx.arc(-6, -4, 4, 0, Math.PI * 2);
    ctx.arc(6, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(-5, -3, 1.6, 0, Math.PI * 2);
    ctx.arc(5, -3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 4, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function paintBaseballClock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  hour24: number,
  minute: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
  ctx.fillStyle = GREEN_DARK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "#3cb85a";
  ctx.fill();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, -6);
  ctx.quadraticCurveTo(0, -r * 0.2, r * 0.72, -6);
  ctx.moveTo(-r * 0.72, 8);
  ctx.quadraticCurveTo(0, r * 0.22, r * 0.72, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.78);
  ctx.quadraticCurveTo(12, 0, 0, r * 0.78);
  ctx.stroke();

  const hour = ((hour24 % 12) + minute / 60) * 30 * (Math.PI / 180);
  const min = minute * 6 * (Math.PI / 180);
  ctx.strokeStyle = RED;
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(hour) * r * 0.45, -Math.cos(hour) * r * 0.45);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(min) * r * 0.7, -Math.cos(min) * r * 0.7);
  ctx.stroke();
  ctx.restore();
}

function paintFlag(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#c5cdd6";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 150);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#e8eef2";
  ctx.fill();
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(4, 8);
  ctx.quadraticCurveTo(52, 18, 86, 6);
  ctx.lineTo(86, 48);
  ctx.quadraticCurveTo(48, 62, 4, 50);
  ctx.closePath();
  ctx.fillStyle = GREEN_DARK;
  ctx.fill();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function paintMegaphone(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = "#d8b56a";
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(54, -28);
  ctx.lineTo(54, 28);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a6a32";
  ctx.fillRect(-16, -10, 18, 20);
  ctx.restore();
}

function paintCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.beginPath();
  ctx.arc(0, 18, 18, 0, Math.PI * 2);
  ctx.arc(22, 10, 24, 0, Math.PI * 2);
  ctx.arc(48, 18, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
