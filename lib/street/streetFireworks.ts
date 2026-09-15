import * as THREE from "three";
import {
  FIREWORK_PALETTE,
  createFireworkSparks,
  sparkFade,
  stepFireworks,
  type FireworkBurstOpts,
  type FireworkSpark,
} from "@/lib/city/fireworks";

/**
 * Night-game bursts above the street-view ballpark, high enough to clear the
 * north facade from the gate.
 */
export class StreetFireworks {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private sparks: FireworkSpark[];
  private time = 0;
  private flash: THREE.PointLight;
  private color = new THREE.Color();

  constructor(count = 128) {
    this.sparks = createFireworkSparks(count);
    const geo = new THREE.SphereGeometry(0.32, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      toneMapped: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = count;
    for (let i = 0; i < count; i++) {
      this.mesh.setColorAt(i, this.color.set(FIREWORK_PALETTE[i % FIREWORK_PALETTE.length]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.group.add(this.mesh);

    this.flash = new THREE.PointLight(0xffc070, 0, 90, 1.35);
    this.flash.position.set(0, 22, -8);
    this.group.add(this.flash);
    this.hideAll();
  }

  update(dt: number, on: boolean, origin: THREE.Vector3, opts?: FireworkBurstOpts) {
    this.time += dt;
    this.group.position.copy(origin);
    this.mesh.visible = on;
    this.flash.intensity = on ? 18 + Math.sin(this.time * 9) * 10 : 0;

    stepFireworks(this.sparks, on, this.time, dt, {
      spreadX: 24,
      spreadZ: 16,
      z0: -14,
      height0: 18,
      height1: 34,
      bursts: 2,
      sparksPerBurst: 16,
      rate: 2.4,
      ...opts,
    });

    const dummy = this.dummy;
    for (let i = 0; i < this.sparks.length; i++) {
      const spark = this.sparks[i];
      const fade = sparkFade(spark);
      if (!on || fade <= 0) {
        dummy.position.set(0, -40, 0);
        dummy.scale.setScalar(0.001);
      } else {
        dummy.position.set(spark.x, spark.y, spark.z);
        dummy.scale.setScalar(0.9 + fade * 2.2);
        this.mesh.setColorAt(i, this.color.set(FIREWORK_PALETTE[spark.tint]));
      }
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private hideAll() {
    const dummy = this.dummy;
    dummy.scale.setScalar(0.001);
    dummy.position.set(0, -40, 0);
    dummy.updateMatrix();
    for (let i = 0; i < this.sparks.length; i++) {
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
