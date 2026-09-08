import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { sidewalkOffset } from "@/lib/simulation/traffic/pathfinding";
import { CURB_H, DECK_H, TILE } from "./buildCity";

/**
 * Draws the citizens and vehicles the simulation is already moving around, as
 * instanced meshes updated once per frame. Nothing here owns any state; it
 * only mirrors whatever the engine currently says.
 */
export class AgentLayer {
  readonly group = new THREE.Group();

  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  private cars: THREE.InstancedMesh;
  private cabins: THREE.InstancedMesh;

  private matrix = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private scale = new THREE.Vector3();
  private position = new THREE.Vector3();
  private color = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);

  private headings = new Map<string, number>();

  constructor(
    private state: CityState,
    private groundAt: (x: number, z: number) => number,
  ) {
    const peopleCount = Math.max(1, state.citizens.length);
    const vehicleCount = Math.max(1, state.vehicles.length);

    // A capsule torso and a sphere head read clearly as a person at eye level.
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.72, 4, 8);
    this.bodies = new THREE.InstancedMesh(
      bodyGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
      peopleCount,
    );

    const headGeo = new THREE.SphereGeometry(0.15, 10, 8);
    this.heads = new THREE.InstancedMesh(
      headGeo,
      new THREE.MeshStandardMaterial({ color: "#c98f65", roughness: 0.72 }),
      peopleCount,
    );

    const carGeo = new THREE.BoxGeometry(1.85, 0.72, 4.3);
    this.cars = new THREE.InstancedMesh(
      carGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.32,
        metalness: 0.45,
      }),
      vehicleCount,
    );

    const cabinGeo = new THREE.BoxGeometry(1.68, 0.62, 2.3);
    this.cabins = new THREE.InstancedMesh(
      cabinGeo,
      new THREE.MeshStandardMaterial({
        color: "#1d2a33",
        roughness: 0.14,
        metalness: 0.2,
      }),
      vehicleCount,
    );

    for (const mesh of [this.bodies, this.heads, this.cars, this.cabins]) {
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  /** Smoothed facing angle so agents turn rather than snap. */
  private heading(id: string, dx: number, dz: number, dt: number) {
    const previous = this.headings.get(id);
    if (Math.hypot(dx, dz) < 0.0001) return previous ?? 0;
    const target = Math.atan2(dx, dz);
    if (previous === undefined) {
      this.headings.set(id, target);
      return target;
    }
    let delta = target - previous;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const next = previous + delta * Math.min(1, dt * 8);
    this.headings.set(id, next);
    return next;
  }

  update(dt: number) {
    const citizens = this.state.citizens;
    for (let i = 0; i < this.bodies.count; i++) {
      const citizen = citizens[i];
      if (!citizen) {
        // Park unused instances far below the ground.
        this.matrix.makeTranslation(0, -1000, 0);
        this.bodies.setMatrixAt(i, this.matrix);
        this.heads.setMatrixAt(i, this.matrix);
        continue;
      }

      const offset = sidewalkOffset(this.state, citizen);
      const wx = (citizen.x + offset.x) * TILE + TILE / 2;
      const wz = (citizen.y + offset.y) * TILE + TILE / 2;
      const onPavement = offset.x !== 0 || offset.y !== 0;
      const base = this.groundAt(wx, wz) + (onPavement ? CURB_H : 0);

      const next = citizen.path[Math.min(citizen.pathIndex + 1, citizen.path.length - 1)];
      const dx = next ? next.x - citizen.x : 0;
      const dz = next ? next.y - citizen.y : 0;
      const walking = citizen.path.length > 1;
      const angle = this.heading(citizen.id, dx, dz, dt);

      // A gentle bob while moving sells the walk cycle without limbs.
      const bob = walking ? Math.sin(performance.now() * 0.011 + i) * 0.045 : 0;

      this.quat.setFromAxisAngle(this.up, angle);
      this.scale.set(1, 1, 1);

      this.position.set(wx, base + 0.58 + bob, wz);
      this.matrix.compose(this.position, this.quat, this.scale);
      this.bodies.setMatrixAt(i, this.matrix);
      this.bodies.setColorAt(i, this.color.set(citizen.color));

      this.position.set(wx, base + 1.24 + bob, wz);
      this.matrix.compose(this.position, this.quat, this.scale);
      this.heads.setMatrixAt(i, this.matrix);
    }

    const vehicles = this.state.vehicles;
    for (let i = 0; i < this.cars.count; i++) {
      const vehicle = vehicles[i];
      if (!vehicle) {
        this.matrix.makeTranslation(0, -1000, 0);
        this.cars.setMatrixAt(i, this.matrix);
        this.cabins.setMatrixAt(i, this.matrix);
        continue;
      }

      const wx = vehicle.x * TILE + TILE / 2;
      const wz = vehicle.y * TILE + TILE / 2;
      const base = this.groundAt(wx, wz);

      const next = vehicle.path[Math.min(vehicle.pathIndex + 1, vehicle.path.length - 1)];
      const dx = next ? next.x - vehicle.x : 0;
      const dz = next ? next.y - vehicle.y : 0;
      const angle = this.heading(vehicle.id, dx, dz, dt);

      const big = vehicle.kind === "bus" || vehicle.kind === "truck";
      const length = big ? 1.9 : 1;
      const height = big ? 1.5 : 1;

      this.quat.setFromAxisAngle(this.up, angle);

      this.scale.set(1, height, length);
      this.position.set(wx, base + 0.55 * height, wz);
      this.matrix.compose(this.position, this.quat, this.scale);
      this.cars.setMatrixAt(i, this.matrix);
      this.cars.setColorAt(
        i,
        this.color.set(
          vehicle.kind === "ambulance"
            ? "#f2f4f5"
            : vehicle.kind === "firetruck"
              ? "#bf3126"
              : vehicle.color,
        ),
      );

      this.scale.set(1, height, big ? 1.6 : 1);
      this.position.set(wx, base + 0.9 * height + 0.32, wz);
      this.matrix.compose(this.position, this.quat, this.scale);
      this.cabins.setMatrixAt(i, this.matrix);
    }

    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.cars.instanceMatrix.needsUpdate = true;
    this.cabins.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (this.cars.instanceColor) this.cars.instanceColor.needsUpdate = true;
  }

  dispose() {
    for (const mesh of [this.bodies, this.heads, this.cars, this.cabins]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}

export { DECK_H };
