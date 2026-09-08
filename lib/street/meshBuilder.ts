import * as THREE from "three";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Accumulates quads into a single interleaved buffer so the whole city can be
 * drawn in a handful of calls. Colour rides on the vertices, which lets every
 * building keep its own palette while sharing one material.
 */
export class MeshBuilder {
  private position: number[] = [];
  private normal: number[] = [];
  private color: number[] = [];
  private uv: number[] = [];

  get empty() {
    return this.position.length === 0;
  }

  /**
   * Adds a quad wound p0→p1→p2→p3. `uMax`/`vMax` are the UV extents, which for
   * tiled facades are the face size divided by the bay and storey height.
   */
  quad(
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    color: THREE.Color,
    uMax = 1,
    vMax = 1,
  ) {
    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const az = p1.z - p0.z;
    const bx = p3.x - p0.x;
    const by = p3.y - p0.y;
    const bz = p3.z - p0.z;

    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    const corners = [p0, p1, p2, p3];
    const uvs = [
      [0, 0],
      [uMax, 0],
      [uMax, vMax],
      [0, vMax],
    ];

    // Two triangles: 0-1-2 and 0-2-3.
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = corners[i];
      this.position.push(p.x, p.y, p.z);
      this.normal.push(nx, ny, nz);
      this.color.push(color.r, color.g, color.b);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
  }

  /** A flat horizontal quad, facing up, spanning a rectangle in x/z. */
  ground(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    color: THREE.Color,
    uMax = 1,
    vMax = 1,
  ) {
    this.quad(
      { x: x0, y, z: z1 },
      { x: x1, y, z: z1 },
      { x: x1, y, z: z0 },
      { x: x0, y, z: z0 },
      color,
      uMax,
      vMax,
    );
  }

  /**
   * Four upright walls of a box. UVs tile by `bay` horizontally and `storey`
   * vertically so window grids line up regardless of the box proportions.
   */
  walls(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    yBottom: number,
    yTop: number,
    color: THREE.Color,
    bay = 0,
    storey = 0,
  ) {
    const h = yTop - yBottom;
    const w = x1 - x0;
    const d = z1 - z0;
    const vMax = storey > 0 ? Math.max(1, Math.round(h / storey)) : 1;
    const uW = bay > 0 ? Math.max(1, Math.round(w / bay)) : 1;
    const uD = bay > 0 ? Math.max(1, Math.round(d / bay)) : 1;

    // South (+z), north (-z), east (+x), west (-x).
    this.quad(
      { x: x0, y: yBottom, z: z1 },
      { x: x1, y: yBottom, z: z1 },
      { x: x1, y: yTop, z: z1 },
      { x: x0, y: yTop, z: z1 },
      color,
      uW,
      vMax,
    );
    this.quad(
      { x: x1, y: yBottom, z: z0 },
      { x: x0, y: yBottom, z: z0 },
      { x: x0, y: yTop, z: z0 },
      { x: x1, y: yTop, z: z0 },
      color,
      uW,
      vMax,
    );
    this.quad(
      { x: x1, y: yBottom, z: z1 },
      { x: x1, y: yBottom, z: z0 },
      { x: x1, y: yTop, z: z0 },
      { x: x1, y: yTop, z: z1 },
      color,
      uD,
      vMax,
    );
    this.quad(
      { x: x0, y: yBottom, z: z0 },
      { x: x0, y: yBottom, z: z1 },
      { x: x0, y: yTop, z: z1 },
      { x: x0, y: yTop, z: z0 },
      color,
      uD,
      vMax,
    );
  }

  /** A full box including its lid. */
  box(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    yBottom: number,
    yTop: number,
    color: THREE.Color,
  ) {
    this.walls(x0, z0, x1, z1, yBottom, yTop, color);
    this.ground(x0, z0, x1, z1, yTop, color);
  }

  /** A gabled roof with the ridge running along x or z. */
  gable(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    yBase: number,
    rise: number,
    color: THREE.Color,
    ridge: "x" | "z",
  ) {
    const yTop = yBase + rise;
    if (ridge === "x") {
      const zm = (z0 + z1) / 2;
      // Two sloping planes.
      this.quad(
        { x: x0, y: yBase, z: z1 },
        { x: x1, y: yBase, z: z1 },
        { x: x1, y: yTop, z: zm },
        { x: x0, y: yTop, z: zm },
        color,
      );
      this.quad(
        { x: x1, y: yBase, z: z0 },
        { x: x0, y: yBase, z: z0 },
        { x: x0, y: yTop, z: zm },
        { x: x1, y: yTop, z: zm },
        color,
      );
      // Triangular gable ends, emitted as degenerate quads.
      this.quad(
        { x: x0, y: yBase, z: z0 },
        { x: x0, y: yBase, z: z1 },
        { x: x0, y: yTop, z: zm },
        { x: x0, y: yTop, z: zm },
        color,
      );
      this.quad(
        { x: x1, y: yBase, z: z1 },
        { x: x1, y: yBase, z: z0 },
        { x: x1, y: yTop, z: zm },
        { x: x1, y: yTop, z: zm },
        color,
      );
    } else {
      const xm = (x0 + x1) / 2;
      this.quad(
        { x: x1, y: yBase, z: z0 },
        { x: x1, y: yBase, z: z1 },
        { x: xm, y: yTop, z: z1 },
        { x: xm, y: yTop, z: z0 },
        color,
      );
      this.quad(
        { x: x0, y: yBase, z: z1 },
        { x: x0, y: yBase, z: z0 },
        { x: xm, y: yTop, z: z0 },
        { x: xm, y: yTop, z: z1 },
        color,
      );
      this.quad(
        { x: x0, y: yBase, z: z0 },
        { x: x1, y: yBase, z: z0 },
        { x: xm, y: yTop, z: z0 },
        { x: xm, y: yTop, z: z0 },
        color,
      );
      this.quad(
        { x: x1, y: yBase, z: z1 },
        { x: x0, y: yBase, z: z1 },
        { x: xm, y: yTop, z: z1 },
        { x: xm, y: yTop, z: z1 },
        color,
      );
    }
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.position, 3),
    );
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normal, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
