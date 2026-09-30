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
  private biter: ((bites: number) => void) | null = null;
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
      this.biter = food.bite ?? null;
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
    if (this.biter) this.biter(this.sips);
    for (const bit of this.foodBits) {
      if (!this.biter) bit.scale.setScalar(Math.max(0.12, left));
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
    this.biter = null;
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

interface FoodView {
  group: THREE.Group;
  bits: THREE.Object3D[];
  bite?: (bites: number) => void;
}

function foodMesh(item: ConsumableItem, bucket: Array<{ dispose: () => void }>): FoodView {
  const group = new THREE.Group();
  if (item.id === "food-ice-cream") {
    const coneMat = new THREE.MeshStandardMaterial({ color: "#c47a2c", roughness: 0.7 });
    const scoopMat = new THREE.MeshStandardMaterial({ color: item.accent, roughness: 0.55 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.11, 10), coneMat);
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), scoopMat);
    cone.rotation.x = Math.PI;
    cone.position.y = 0.02;
    scoop.position.y = 0.09;
    group.add(cone, scoop);
    bucket.push(cone.geometry, scoop.geometry, coneMat, scoopMat);
    viewmodel(group);
    return { group, bits: [scoop] };
  }
  if (HOT_DOGS.has(item.id) || PRETZELS.has(item.id)) {
    const view = HOT_DOGS.has(item.id) ? hotDogMesh(item, group, bucket) : pretzelMesh(item, group, bucket);
    viewmodel(view.group);
    return view;
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

const HOT_DOGS = new Set(["food-hotdog", "food-chili-dog", "food-relish-dog"]);
const PRETZELS = new Set(["food-pretzel", "food-pretzel-cheese"]);

type Bucket = Array<{ dispose: () => void }>;

/** Hot dog or pretzel model for world displays such as concession counters; null for other foods. */
export function displayFood(id: string, bucket: Bucket): THREE.Group | null {
  const item = consumableById(id);
  if (!item) return null;
  if (HOT_DOGS.has(id)) return hotDogMesh(item, new THREE.Group(), bucket).group;
  if (PRETZELS.has(id)) return pretzelMesh(item, new THREE.Group(), bucket).group;
  return null;
}

function material(bucket: Bucket, color: string, roughness = 0.6) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness });
  bucket.push(mat);
  return mat;
}

function geometry<T extends THREE.BufferGeometry>(bucket: Bucket, geo: T) {
  bucket.push(geo);
  return geo;
}

function hotDogMesh(item: ConsumableItem, group: THREE.Group, bucket: Bucket) {
  const paper = material(bucket, "#f4f1ea", 0.8);
  const stripe = material(bucket, "#c0392b", 0.7);

  const base = new THREE.Mesh(geometry(bucket, new THREE.BoxGeometry(0.17, 0.008, 0.075)), paper);
  const wallGeo = geometry(bucket, new THREE.BoxGeometry(0.17, 0.024, 0.005));
  const wallA = new THREE.Mesh(wallGeo, stripe);
  const wallB = new THREE.Mesh(wallGeo, stripe);
  wallA.position.set(0, 0.012, 0.039);
  wallB.position.set(0, 0.012, -0.039);
  group.add(base, wallA, wallB);

  const food = new THREE.Group();
  const ropes: Array<{ rope: Rope; start: number }> = [];
  const straight = (x0: number, x1: number, y: number, z: number) =>
    new THREE.LineCurve3(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z));
  const addRope = (rope: Rope, start: number, layer: number) => {
    rope.mesh.userData.layer = layer;
    food.add(rope.mesh);
    ropes.push({ rope, start });
  };

  for (const z of [-0.014, 0.014]) {
    addRope(makeRope(bucket, straight(-0.068, 0.068, 0.022, z), 0.018, "#d9a05b", "#f3e2bf", 0.75), -0.068, 1);
  }
  addRope(makeRope(bucket, straight(-0.074, 0.074, 0.034, 0), 0.014, "#a8432c", "#d98a6c", 0.4), -0.074, 2);

  const toppings: THREE.Object3D[] = [];
  if (item.id === "food-chili-dog") {
    const chili = makeRope(bucket, straight(-0.058, 0.058, 0.043, 0), 0.016, item.color, item.color, 0.85);
    chili.mesh.scale.set(1, 0.6, 0.6);
    chili.mesh.position.y = 0.043 * 0.4;
    addRope(chili, -0.058, 3);
    const onionGeo = geometry(bucket, new THREE.BoxGeometry(0.007, 0.005, 0.007));
    const onionMat = material(bucket, "#f6f1dc", 0.5);
    for (let i = 0; i < 9; i++) {
      const onion = new THREE.Mesh(onionGeo, onionMat);
      onion.position.set(-0.05 + i * 0.0125, 0.052, ((i * 7) % 5) * 0.004 - 0.008);
      onion.rotation.y = i;
      toppings.push(onion);
    }
  } else {
    const mustardGeo = geometry(bucket, new THREE.BoxGeometry(0.026, 0.005, 0.005));
    const mustardMat = material(bucket, "#e8c21a", 0.35);
    for (let i = 0; i < 6; i++) {
      const squiggle = new THREE.Mesh(mustardGeo, mustardMat);
      squiggle.position.set(-0.05 + i * 0.02, 0.049, 0);
      squiggle.rotation.y = i % 2 ? 0.9 : -0.9;
      toppings.push(squiggle);
    }
    if (item.id === "food-relish-dog") {
      const relishGeo = geometry(bucket, new THREE.BoxGeometry(0.008, 0.006, 0.008));
      const relishMat = material(bucket, item.accent, 0.5);
      for (let i = 0; i < 8; i++) {
        const bit = new THREE.Mesh(relishGeo, relishMat);
        bit.position.set(-0.045 + i * 0.013, 0.05, i % 2 ? 0.007 : -0.007);
        toppings.push(bit);
      }
    }
  }
  for (const topping of toppings) {
    topping.userData.layer = 4;
    food.add(topping);
  }
  group.add(food);

  const bite = (bites: number) => {
    const eatenTo = bites > 0 ? -0.074 + bites * 0.05 : -Infinity;
    for (const { rope, start } of ropes) rope.bite(eatenTo - start);
    for (const topping of toppings) topping.visible = topping.position.x > eatenTo + 0.008;
  };
  return { group, bits: [food], bite };
}

function pretzelMesh(item: ConsumableItem, group: THREE.Group, bucket: Bucket) {
  const paper = new THREE.Mesh(
    geometry(bucket, new THREE.BoxGeometry(0.15, 0.004, 0.15)),
    material(bucket, "#f4efe2", 0.9),
  );
  paper.position.y = -0.004;
  group.add(paper);

  const pts: Array<[number, number, number]> = [
    [0.032, 0.004, 0.05],
    [0.014, 0.004, 0.022],
    [0, 0.002, 0],
    [-0.015, 0.006, -0.022],
    [-0.022, 0.006, -0.048],
    [-0.038, 0.006, -0.066],
    [-0.058, 0.006, -0.05],
    [-0.063, 0.006, -0.01],
    [-0.05, 0.006, 0.034],
    [-0.02, 0.006, 0.058],
    [0.02, 0.006, 0.058],
    [0.05, 0.006, 0.034],
    [0.063, 0.006, -0.01],
    [0.058, 0.006, -0.05],
    [0.038, 0.006, -0.066],
    [0.022, 0.006, -0.048],
    [0.015, 0.01, -0.022],
    [0, 0.014, 0],
    [-0.014, 0.008, 0.022],
    [-0.032, 0.004, 0.05],
  ];
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const food = new THREE.Group();
  const dough = makeRope(bucket, curve, 0.0095, "#8a4a1c", "#f0d9a8", 0.42, 240);
  food.add(dough.mesh);

  const saltGeo = geometry(bucket, new THREE.BoxGeometry(0.0045, 0.0045, 0.0045));
  const saltMat = material(bucket, "#fbfaf5", 0.3);
  const salts: Array<{ salt: THREE.Mesh; along: number }> = [];
  for (let i = 0; i < 22; i++) {
    const u = (i + 0.5) / 22;
    const p = curve.getPointAt(u);
    const salt = new THREE.Mesh(saltGeo, saltMat);
    salt.position.set(p.x + (i % 3 - 1) * 0.003, p.y + 0.009, p.z + ((i * 5) % 3 - 1) * 0.003);
    salt.rotation.set(i, i * 2, 0);
    salt.userData.layer = 1;
    food.add(salt);
    salts.push({ salt, along: u * dough.length });
  }
  group.add(food);

  const bits: THREE.Object3D[] = [food];
  let cheese: THREE.Mesh | null = null;
  if (item.id === "food-pretzel-cheese") {
    const cup = new THREE.Mesh(
      geometry(bucket, new THREE.CylinderGeometry(0.024, 0.019, 0.028, 14)),
      material(bucket, "#f4f1ea", 0.6),
    );
    cup.position.set(0.085, 0.012, 0.045);
    cheese = new THREE.Mesh(
      geometry(bucket, new THREE.CylinderGeometry(0.021, 0.021, 0.004, 14)),
      material(bucket, item.accent, 0.3),
    );
    cheese.position.set(0.085, 0.025, 0.045);
    cheese.userData.layer = 1;
    group.add(cup, cheese);
    bits.push(cheese);
  }

  const bite = (bites: number) => {
    const eaten = bites > 0 ? (bites / CONSUME_BITES) * dough.length * 1.05 : -Infinity;
    dough.bite(eaten);
    for (const { salt, along } of salts) salt.visible = along > eaten + 0.012;
    if (cheese) cheese.position.y = 0.025 - Math.min(bites, CONSUME_BITES - 1) * 0.007;
  };
  return { group, bits, bite };
}

interface Rope {
  mesh: THREE.Mesh;
  length: number;
  /** Removes everything within `eaten` units of the rope's start, leaving a jagged bitten face. */
  bite: (eaten: number) => void;
}

const BITE_DEPTH = 0.012;

/** A tube with rounded ends whose start can be bitten away, exposing its lighter inside. */
function makeRope(
  bucket: Bucket,
  curve: THREE.Curve<THREE.Vector3>,
  radius: number,
  crust: string,
  inside: string,
  roughness: number,
  tubular = 96,
): Rope {
  const radial = 12;
  const length = curve.getLength();
  const frames = curve.computeFrenetFrames(tubular, false);
  const capU = Math.min(0.5, radius / length);
  const count = (tubular + 1) * (radial + 1);
  const base = new Float32Array(count * 3);
  const along = new Float32Array(count);
  const teeth = new Float32Array(count);
  const centers: THREE.Vector3[] = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= tubular; j++) {
    const u = j / tubular;
    curve.getPointAt(u, p);
    centers.push(p.clone());
    const edge = Math.min(u, 1 - u) / capU;
    const r = edge >= 1 ? radius : radius * Math.sqrt(Math.max(0, 1 - (1 - edge) ** 2));
    const n = frames.normals[j];
    const b = frames.binormals[j];
    for (let i = 0; i <= radial; i++) {
      const v = (i / radial) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const k = j * (radial + 1) + i;
      base[k * 3] = p.x + r * (cos * n.x + sin * b.x);
      base[k * 3 + 1] = p.y + r * (cos * n.y + sin * b.y);
      base[k * 3 + 2] = p.z + r * (cos * n.z + sin * b.z);
      along[k] = u * length;
      teeth[k] = 0.35 + 0.65 * Math.abs(Math.sin(v * 1.5));
    }
  }
  const index: number[] = [];
  for (let j = 1; j <= tubular; j++) {
    for (let i = 1; i <= radial; i++) {
      const a = (radial + 1) * (j - 1) + (i - 1);
      const b = (radial + 1) * j + (i - 1);
      const c = (radial + 1) * j + i;
      const d = (radial + 1) * (j - 1) + i;
      index.push(a, b, d, b, c, d);
    }
  }
  const geo = geometry(bucket, new THREE.BufferGeometry());
  const position = new THREE.BufferAttribute(base.slice(), 3);
  const color = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  geo.setAttribute("position", position);
  geo.setAttribute("color", color);
  geo.setIndex(index);

  const crustColor = new THREE.Color(crust);
  const insideColor = new THREE.Color(inside);
  const mat = material(bucket, "#ffffff", roughness);
  mat.vertexColors = true;
  const mesh = new THREE.Mesh(geo, mat);

  const bite = (eaten: number) => {
    for (let k = 0; k < count; k++) {
      const limit = eaten + BITE_DEPTH * teeth[k];
      if (eaten > -BITE_DEPTH && along[k] < limit) {
        const c = centers[Math.min(tubular, Math.max(0, Math.ceil((limit / length) * tubular)))];
        position.setXYZ(k, c.x, c.y, c.z);
        color.setXYZ(k, insideColor.r, insideColor.g, insideColor.b);
      } else {
        position.setXYZ(k, base[k * 3], base[k * 3 + 1], base[k * 3 + 2]);
        color.setXYZ(k, crustColor.r, crustColor.g, crustColor.b);
      }
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    geo.computeVertexNormals();
  };
  bite(-Infinity);
  return { mesh, length, bite };
}

function viewmodel(group: THREE.Group) {
  group.traverse((obj) => {
    obj.frustumCulled = false;
    if (!(obj instanceof THREE.Mesh)) return;
    obj.renderOrder = 12 + (obj.userData.layer ?? 0);
    const material = obj.material;
    const list = Array.isArray(material) ? material : [material];
    for (const mat of list) {
      mat.depthTest = false;
      mat.depthWrite = false;
    }
  });
}
