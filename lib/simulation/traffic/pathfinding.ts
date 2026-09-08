import type { CityState, Vec2 } from "@/lib/city/types";

const DIRS: Vec2[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function key(x: number, y: number) {
  return `${x},${y}`;
}

export function isRoad(state: CityState, x: number, y: number) {
  const tile = state.tiles[y]?.[x];
  return Boolean(tile?.road);
}

export function neighbors(state: CityState, x: number, y: number): Vec2[] {
  const tile = state.tiles[y]?.[x];
  if (!tile?.road) return [];
  const next: Vec2[] = [];
  if (tile.road.north && isRoad(state, x, y - 1)) next.push({ x, y: y - 1 });
  if (tile.road.east && isRoad(state, x + 1, y)) next.push({ x: x + 1, y });
  if (tile.road.south && isRoad(state, x, y + 1)) next.push({ x, y: y + 1 });
  if (tile.road.west && isRoad(state, x - 1, y)) next.push({ x: x - 1, y });
  if (next.length === 0) {
    for (const d of DIRS) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (isRoad(state, nx, ny)) next.push({ x: nx, y: ny });
    }
  }
  return next;
}

export function allRoadTiles(state: CityState): Vec2[] {
  const roads: Vec2[] = [];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.tiles[y][x].road) roads.push({ x, y });
    }
  }
  return roads;
}

export function findPath(state: CityState, start: Vec2, goal: Vec2): Vec2[] {
  if (!isRoad(state, start.x, start.y) || !isRoad(state, goal.x, goal.y)) {
    return [];
  }
  if (start.x === goal.x && start.y === goal.y) return [start];

  const startKey = key(start.x, start.y);
  const goalKey = key(goal.x, goal.y);
  const came = new Map<string, string>();
  const g = new Map<string, number>([[startKey, 0]]);
  const open: { k: string; x: number; y: number; f: number }[] = [
    {
      k: startKey,
      x: start.x,
      y: start.y,
      f: Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y),
    },
  ];
  const inOpen = new Set([startKey]);

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    inOpen.delete(current.k);
    if (current.k === goalKey) {
      const path: Vec2[] = [{ x: current.x, y: current.y }];
      let ck = current.k;
      while (came.has(ck)) {
        ck = came.get(ck)!;
        const [cx, cy] = ck.split(",").map(Number);
        path.push({ x: cx, y: cy });
      }
      path.reverse();
      return path;
    }

    for (const n of neighbors(state, current.x, current.y)) {
      const nk = key(n.x, n.y);
      const tentative = (g.get(current.k) ?? Infinity) + 1;
      if (tentative < (g.get(nk) ?? Infinity)) {
        came.set(nk, current.k);
        g.set(nk, tentative);
        const f = tentative + Math.abs(goal.x - n.x) + Math.abs(goal.y - n.y);
        if (!inOpen.has(nk)) {
          open.push({ k: nk, x: n.x, y: n.y, f });
          inOpen.add(nk);
        }
      }
    }
  }

  return [];
}

export function nearestRoad(state: CityState, x: number, y: number): Vec2 | null {
  if (isRoad(state, x, y)) return { x, y };
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isRoad(state, nx, ny)) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < bestD) {
        bestD = d;
        best = { x: nx, y: ny };
      }
    }
  }
  return best;
}

/**
 * How far off the lane centre a pedestrian stands, in tiles. Matches the 3D
 * sidewalk strip (~1.7m of a 10m tile), so people read as walking the curb
 * rather than the carriageway.
 */
const SIDEWALK_LANE = 0.38;

function sidewalkSide(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return hash & 1 ? 1 : -1;
}

/**
 * Offset from the road-tile centre onto a sidewalk. Each person keeps a
 * consistent side of the street, flipped if that edge has no pavement.
 */
export function sidewalkOffset(state: CityState, citizen: { id: string; x: number; y: number; path: Vec2[]; pathIndex: number }): Vec2 {
  const tx = Math.round(citizen.x);
  const ty = Math.round(citizen.y);
  if (!isRoad(state, tx, ty)) return { x: 0, y: 0 };

  const next = citizen.path[Math.min(citizen.pathIndex + 1, citizen.path.length - 1)];
  let fx = next ? next.x - citizen.x : 0;
  let fy = next ? next.y - citizen.y : 0;

  if (Math.hypot(fx, fy) < 0.08) {
    const road = state.tiles[ty][tx].road!;
    if (road.north || road.south) {
      fx = 0;
      fy = 1;
    } else {
      fx = 1;
      fy = 0;
    }
  }

  if (Math.abs(fx) >= Math.abs(fy)) {
    fx = Math.sign(fx) || 1;
    fy = 0;
  } else {
    fy = Math.sign(fy) || 1;
    fx = 0;
  }

  // Perpendicular: facing along (fx, fy), this is the right-hand sidewalk.
  let ox = -fy;
  let oy = fx;
  if (sidewalkSide(citizen.id) < 0) {
    ox = -ox;
    oy = -oy;
  }

  // Prefer the curb that actually has pavement (neighbour is not more road).
  const preferred = isRoad(state, tx + Math.round(ox), ty + Math.round(oy));
  const opposite = isRoad(state, tx - Math.round(ox), ty - Math.round(oy));
  if (preferred && !opposite) {
    ox = -ox;
    oy = -oy;
  }

  return { x: ox * SIDEWALK_LANE, y: oy * SIDEWALK_LANE };
}
