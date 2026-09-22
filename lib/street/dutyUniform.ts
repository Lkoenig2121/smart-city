import * as THREE from "three";

/**
 * First-person duty kit (sleeves + badge/radio) parented to the camera so the
 * player visibly looks on-duty while walking the streets.
 */
export class DutyUniformView {
  readonly group = new THREE.Group();
  private on = false;
  private disposables: Array<{ dispose: () => void }> = [];
  private time = 0;

  constructor() {
    this.group.visible = false;
    this.group.frustumCulled = false;
    this.group.position.set(0, -0.28, -0.42);
    this.build();
  }

  attach(camera: THREE.Object3D) {
    if (this.group.parent !== camera) camera.add(this.group);
  }

  setOnDuty(on: boolean) {
    this.on = on;
    this.group.visible = on;
  }

  update(dt: number) {
    this.time += dt;
    if (!this.group.visible) return;
    const bob = Math.sin(this.time * 2.2) * 0.008;
    this.group.position.y = -0.28 + bob;
  }

  dispose() {
    this.group.removeFromParent();
    for (const item of this.disposables) item.dispose();
    this.disposables = [];
  }

  private build() {
    const navy = new THREE.MeshStandardMaterial({ color: "#1f4d8c", roughness: 0.72 });
    const gold = new THREE.MeshStandardMaterial({ color: "#c9a44c", roughness: 0.45, metalness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: "#12151a", roughness: 0.8 });
    this.disposables.push(navy, gold, dark);

    // Left / right sleeves in the lower FOV.
    const sleeveGeo = new THREE.BoxGeometry(0.14, 0.28, 0.18);
    this.disposables.push(sleeveGeo);
    const left = new THREE.Mesh(sleeveGeo, navy);
    left.position.set(-0.28, -0.05, 0.08);
    left.rotation.z = 0.35;
    const right = new THREE.Mesh(sleeveGeo, navy);
    right.position.set(0.28, -0.05, 0.08);
    right.rotation.z = -0.35;
    this.group.add(left, right);

    // Chest / badge plate.
    const chestGeo = new THREE.BoxGeometry(0.42, 0.22, 0.08);
    this.disposables.push(chestGeo);
    const chest = new THREE.Mesh(chestGeo, navy);
    chest.position.set(0, 0.06, 0.02);
    this.group.add(chest);

    const badgeGeo = new THREE.BoxGeometry(0.06, 0.08, 0.02);
    this.disposables.push(badgeGeo);
    const badge = new THREE.Mesh(badgeGeo, gold);
    badge.position.set(0.12, 0.08, 0.07);
    this.group.add(badge);

    // Radio mic on the shoulder.
    const micGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.07, 8);
    this.disposables.push(micGeo);
    const mic = new THREE.Mesh(micGeo, dark);
    mic.position.set(-0.16, 0.14, 0.06);
    mic.rotation.z = 0.5;
    this.group.add(mic);
  }
}
