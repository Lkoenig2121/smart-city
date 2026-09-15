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

function blockedByWorks(state: CityState, x: number, y: number) {
  return state.roadWorks.some((work) => work.x === x && work.y === y);
}

export function neighbors(state: CityState, x: number, y: number): Vec2[] {
  const tile = state.tiles[y]?.[x];
  if (!tile?.road) return [];
  const next: Vec2[] = [];
  const consider = (nx: number, ny: number) => {
    if (!isRoad(state, nx, ny) || blockedByWorks(state, nx, ny)) return;
    next.push({ x: nx, y: ny });
  };
  if (tile.road.north) consider(x, y - 1);
  if (tile.road.east) consider(x + 1, y);
  if (tile.road.south) consider(x, y + 1);
  if (tile.road.west) consider(x - 1, y);
  if (next.length === 0) {
    for (const d of DIRS) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (isRoad(state, nx, ny) && !blockedByWorks(state, nx, ny)) next.push({ x: nx, y: ny });
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
      const tentative = (g.get(current.k) ?? Infinity) + (state.tiles[n.y][n.x].upgraded ? 0.7 : 1);
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
/** Offset from the road centre into the right-hand driving lane, in tiles. */
const DRIVE_LANE = 0.17;

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

  const { fx, fy } = travelAxis(citizen) ?? { fx: 1, fy: 0 };

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

const lastLaneAxis = new Map<string, { fx: number; fy: number }>();

function snapAxis(fx: number, fy: number) {
  if (fx === 0 && fy === 0) return null;
  if (Math.abs(fx) >= Math.abs(fy)) return { fx: Math.sign(fx) || 1, fy: 0 };
  return { fx: 0, fy: Math.sign(fy) || 1 };
}

function travelAxis(agent: { x: number; y: number; path: Vec2[]; pathIndex: number }) {
  const path = agent.path;
  const i = Math.max(0, agent.pathIndex);
  const from = path[i];
  const to = path[i + 1];

  // The tile-to-tile segment, not the live remainder. Using the leftover
  // distance flips the axis when a car is a few centimetres from a node.
  if (from && to) {
    const axis = snapAxis(to.x - from.x, to.y - from.y);
    if (axis) return axis;
  }

  const prev = path[i - 1];
  if (prev && from) {
    const axis = snapAxis(from.x - prev.x, from.y - prev.y);
    if (axis) return axis;
  }

  return snapAxis(
    (to?.x ?? from?.x ?? agent.x) - agent.x,
    (to?.y ?? from?.y ?? agent.y) - agent.y,
  );
}

/**
 * Offset from the road-tile centre into the right-hand lane. Opposite
 * directions naturally take opposite sides, so two-way streets pass.
 */
export function laneOffset(
  _state: CityState,
  vehicle: { id: string; x: number; y: number; path: Vec2[]; pathIndex: number },
): Vec2 {
  const axis = travelAxis(vehicle) ?? lastLaneAxis.get(vehicle.id) ?? { fx: 1, fy: 0 };
  lastLaneAxis.set(vehicle.id, axis);
  return { x: -axis.fy * DRIVE_LANE, y: axis.fx * DRIVE_LANE };
}
