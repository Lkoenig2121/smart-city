import * as THREE from "three";
import { consumableById, CONSUME_BITES, type ConsumableItem } from "@/lib/city/consumables";

const REST = { x: 0.3, y: -0.22, z: -0.46, rx: 0.22, ry: 0.38, rz: 0.1 };
const LIQUID_H = 0.09;
const LIQUID_BOTTOM = -0.005;
const SIP_MS = 0.72;

/**
 * First-person held cup or plate, parented to the camera so it stays in view.
 */
export class HeldItemView {
  readonly group = new THREE.Group();
  private current: string | null = null;
  private disposables: Array<{ dispose: () => void }> = [];
  private time = 0;
  private light = new THREE.PointLight(0xffffff, 0.9, 1.6, 2);
  private liquid: THREE.Mesh | null = null;
  private foodBits: THREE.Object3D[] = [];
  private sips = 0;
  private anim = -1;

  constructor() {
    this.group.visible = false;
    this.group.frustumCulled = false;
    this.group.position.set(REST.x, REST.y, REST.z);
    this.group.rotation.set(REST.rx, REST.ry, REST.rz);
    this.group.scale.setScalar(1.35);
    this.light.position.set(-0.06, 0.12, 0.18);
    this.group.add(this.light);
  }

  attach(camera: THREE.Object3D, scene?: THREE.Scene) {
    if (scene && !camera.parent) scene.add(camera);
    if (this.group.parent !== camera) camera.add(this.group);
  }

  setHeld(id: string | null, sips = 0) {
    const next = id && consumableById(id) ? id : null;
    if (next === this.current) {
      this.applySips(sips);
      return;
    }
    this.clearMesh();
    this.current = next;
    this.anim = -1;
    this.liquid = null;
    if (!next) {
      this.group.visible = false;
      this.sips = 0;
      return;
    }
    const item = consumableById(next);
    if (!item) return;
    if (item.kind === "drink") {
      const drink = drinkMesh(item, this.disposables);
      this.liquid = drink.liquid;
      this.group.add(drink.group);
    } else {
      const food = foodMesh(item, this.disposables);
      this.foodBits = food.bits;
      this.group.add(food.group);
    }
    this.group.visible = true;
    this.applySips(sips);
  }

  playSip() {
    if (!this.group.visible) return;
    if (!consumableById(this.current ?? "")) return;
    this.anim = 0;
    this.applySips(Math.min(CONSUME_BITES, this.sips + 1));
  }

  update(dt: number) {
    this.time += dt;
    if (!this.group.visible) return;
    let raise = 0;
    if (this.anim >= 0) {
      this.anim += dt;
      const t = this.anim;
      if (t < 0.22) raise = t / 0.22;
      else if (t < 0.48) raise = 1;
      else if (t < SIP_MS) raise = 1 - (t - 0.48) / (SIP_MS - 0.48);
      else this.anim = -1;
    }
    const bob = Math.sin(this.time * 2.4) * 0.012 * (1 - raise);
    this.group.position.set(REST.x - raise * 0.22, REST.y + bob + raise * 0.2, REST.z + raise * 0.1);
    this.group.rotation.set(REST.rx + raise * 1.05, REST.ry - raise * 0.22, REST.rz);
  }

  dispose() {
    this.group.removeFromParent();
    this.clearMesh();
  }

  private applySips(sips: number) {
    this.sips = Math.max(0, Math.min(CONSUME_BITES, sips));
    const left = Math.max(0, 1 - this.sips / CONSUME_BITES);
    if (this.liquid) {
      const fill = Math.max(0.08, left);
      this.liquid.scale.y = fill;
      this.liquid.position.y = LIQUID_BOTTOM + (LIQUID_H * fill) / 2;
      this.liquid.visible = this.sips < CONSUME_BITES;
    }
    for (const bit of this.foodBits) {
      const fill = Math.max(0.12, left);
      bit.scale.setScalar(fill);
      bit.visible = this.sips < CONSUME_BITES;
    }
  }

  private clearMesh() {
    for (const child of [...this.group.children]) {
      if (child === this.light) continue;
      this.group.remove(child);
    }
    for (const item of this.disposables) item.dispose();
    this.disposables = [];
    this.liquid = null;
    this.foodBits = [];
  }
}

function drinkMesh(item: ConsumableItem, bucket: Array<{ dispose: () => void }>) {
  const group = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#dfeaf0",
    transparent: true,
    opacity: 0.35,
    roughness: 0.12,
    metalness: 0.08,
  });
  const liquidMat = new THREE.MeshStandardMaterial({
    color: item.color,
    roughness: 0.35,
    emissive: new THREE.Color(item.color),
    emissiveIntensity: 0.12,
  });
  const baseMat = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.4 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.13, 12, 1, true), glassMat);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, LIQUID_H, 12), liquidMat);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 12), baseMat);
  glass.position.y = 0.06;
  liquid.position.y = LIQUID_BOTTOM + LIQUID_H / 2;
  base.position.y = -0.005;
  group.add(glass, liquid, base);
  const garnishMat = new THREE.MeshStandardMaterial({ color: item.accent, roughness: 0.5 });
  const garnish = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), garnishMat);
  garnish.position.set(0.02, 0.125, 0);
  group.add(garnish);
  bucket.push(glass.geometry, liquid.geometry, base.geometry, garnish.geometry, glassMat, liquidMat, baseMat, garnishMat);
  viewmodel(group);
  return { group, liquid };
}

function foodMesh(item: ConsumableItem, bucket: Array<{ dispose: () => void }>) {
  const group = new THREE.Group();
  if (item.id === "food-ice-cream") {
    const coneMat = new THREE.MeshStandardMaterial({ color: "#c47a2c", roughness: 0.7 });
    const scoopMat = new THREE.MeshStandardMaterial({ color: item.accent, roughness: 0.55 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.11, 10), coneMat);
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), scoopMat);
    cone.position.y = 0.02;
    scoop.position.y = 0.1;
    group.add(cone, scoop);
    bucket.push(cone.geometry, scoop.geometry, coneMat, scoopMat);
    viewmodel(group);
    return { group, bits: [scoop] };
  }
  const plateMat = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.45 });
  const foodMat = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.65 });
  const accentMat = new THREE.MeshStandardMaterial({ color: item.accent, roughness: 0.6 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16), plateMat);
  const pile = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.07), foodMat);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.05), accentMat);
  pile.position.y = 0.025;
  top.position.y = 0.05;
  group.add(plate, pile, top);
  bucket.push(plate.geometry, pile.geometry, top.geometry, plateMat, foodMat, accentMat);
  viewmodel(group);
  return { group, bits: [pile, top] };
}

function viewmodel(group: THREE.Group) {
  group.traverse((obj) => {
    obj.frustumCulled = false;
    if (!(obj instanceof THREE.Mesh)) return;
    obj.renderOrder = 12;
    const material = obj.material;
    const list = Array.isArray(material) ? material : [material];
    for (const mat of list) {
      mat.depthTest = false;
      mat.depthWrite = false;
    }
  });
}
