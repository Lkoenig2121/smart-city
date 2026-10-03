import * as THREE from "three";
import { INTERIORS, WHEELS, type OwnedVehicle, type VehicleCategory } from "@/lib/city/vehicles";
import { TILE } from "./buildCity";

/** Body proportions per class: width, body height, length, cabin height, cabin length, ride height. */
const SHAPES: Record<VehicleCategory, { w: number; h: number; l: number; ch: number; cl: number; ride: number }> = {
  compact: { w: 1.75, h: 0.55, l: 3.6, ch: 0.6, cl: 2.0, ride: 0.28 },
  sedan: { w: 1.9, h: 0.55, l: 4.3, ch: 0.55, cl: 2.2, ride: 0.28 },
  suv: { w: 2.0, h: 0.75, l: 4.5, ch: 0.7, cl: 2.6, ride: 0.42 },
  sports: { w: 1.95, h: 0.45, l: 4.3, ch: 0.42, cl: 1.7, ride: 0.2 },
  luxury: { w: 2.0, h: 0.6, l: 4.8, ch: 0.55, cl: 2.4, ride: 0.3 },
  supercar: { w: 2.05, h: 0.4, l: 4.5, ch: 0.36, cl: 1.5, ride: 0.16 },
};

/** Changes whenever a garage visit should change how the car looks. */
export function carLookKey(car: OwnedVehicle) {
  return [car.catalogId, car.color, car.wheels, car.interior, car.licensePlate, [...car.accessories].sort().join("+")].join("|");
}

function plateTexture(text: string) {
  const el = document.createElement("canvas");
  el.width = 256;
  el.height = 128;
  const ctx = el.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = "#1f3a5c";
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 244, 116);
    ctx.fillStyle = "#1f3a5c";
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 70, 230);
  }
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Parked/driven car mesh for the player fleet, dressed with its garage mods. */
export function makePlayerCarMesh(car: OwnedVehicle) {
  const group = new THREE.Group();
  group.name = `owned-car-${car.id}`;
  const s = SHAPES[car.category] ?? SHAPES.sedan;
  const tint = car.accessories.includes("tint");
  const wheel = WHEELS.find((w) => w.id === car.wheels) ?? WHEELS[0];
  const seat = INTERIORS.find((i) => i.id === car.interior) ?? INTERIORS[0];

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  const bodyMat = new THREE.MeshStandardMaterial({ color: car.color, roughness: 0.38, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.8, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: tint ? "#1b2530" : "#9ec5e8",
    roughness: 0.15,
    metalness: 0.4,
    transparent: true,
    opacity: tint ? 0.82 : 0.5,
  });
  const bodyY = s.ride + s.h / 2 + 0.12;
  const deck = bodyY + s.h / 2;
  add(new THREE.BoxGeometry(s.w, s.h, s.l), bodyMat, 0, bodyY, 0);
  add(new THREE.BoxGeometry(s.w - 0.2, s.ch, s.cl), glass, 0, deck + s.ch / 2, -0.15);

  const seatMat = new THREE.MeshStandardMaterial({ color: seat.color, roughness: 0.7 });
  for (const x of [-s.w / 4, s.w / 4]) {
    add(new THREE.BoxGeometry(0.5, 0.18, 0.55), seatMat, x, deck + 0.02, -0.25);
    add(new THREE.BoxGeometry(0.5, Math.max(0.3, s.ch - 0.1), 0.14), seatMat, x, deck + s.ch / 2, 0.05);
  }

  const r = s.ride + 0.12;
  const tireGeo = new THREE.CylinderGeometry(r, r, 0.3, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.32, 10);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: wheel.color,
    roughness: wheel.id === "stock" ? 0.8 : 0.2,
    metalness: wheel.id === "stock" ? 0.2 : 0.85,
  });
  const wx = s.w / 2 - 0.08;
  const wz = s.l / 2 - 0.75;
  for (const [x, z] of [
    [-wx, wz],
    [wx, wz],
    [-wx, -wz],
    [wx, -wz],
  ]) {
    add(tireGeo, dark, x, r, z);
    add(rimGeo, rimMat, x, r, z);
  }

  const plateTex = plateTexture(car.licensePlate);
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.26), plateMat);
  plate.position.set(0, bodyY, s.l / 2 + 0.01);
  group.add(plate);

  if (car.accessories.includes("spoiler")) {
    const z = s.l / 2 - 0.3;
    for (const x of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.08, 0.28, 0.12), dark, x, deck + 0.14, z);
    add(new THREE.BoxGeometry(s.w - 0.1, 0.06, 0.42), dark, 0, deck + 0.3, z);
  }
  if (car.accessories.includes("rack")) {
    const top = deck + s.ch;
    for (const z of [-0.8, 0.5]) add(new THREE.BoxGeometry(s.w - 0.3, 0.06, 0.08), dark, 0, top + 0.06, z - 0.15);
    for (const x of [-(s.w - 0.4) / 2, (s.w - 0.4) / 2]) add(new THREE.BoxGeometry(0.06, 0.06, 1.5), dark, x, top + 0.1, -0.3);
  }
  if (car.accessories.includes("stripes")) {
    const stripe = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.4 });
    for (const x of [-0.22, 0.22]) add(new THREE.BoxGeometry(0.2, 0.01, s.l + 0.01), stripe, x, deck + 0.005, 0);
  }
  if (car.accessories.includes("underglow")) {
    const glow = new THREE.MeshBasicMaterial({ color: "#38e1ff", transparent: true, opacity: 0.75 });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(s.w + 0.5, s.l + 0.4), glow);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    group.add(pad);
  }

  if (car.garageLocation === "police") {
    addPoliceLivery(group, s, bodyY, deck);
    group.userData.police = true;
  }

  group.add(buildDutySiren());

  group.userData.vehicleId = car.id;
  group.userData.lookKey = carLookKey(car);
  return group;
}

/** Black-and-white department paint: dark doors and hood, POLICE lettering, push bar. */
function addPoliceLivery(
  group: THREE.Group,
  s: { w: number; h: number; l: number },
  bodyY: number,
  deck: number,
) {
  const black = new THREE.MeshStandardMaterial({ color: "#111317", roughness: 0.4, metalness: 0.35 });
  const doors = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.02, s.h * 0.62, s.l * 0.46), black);
  doors.position.set(0, bodyY - s.h * 0.12, -0.1);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(s.w - 0.1, 0.02, s.l * 0.26), black);
  hood.position.set(0, deck + 0.01, -s.l / 2 + s.l * 0.14);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.7, 0.32, 0.14), black);
  bar.position.set(0, bodyY - 0.05, -s.l / 2 - 0.12);
  group.add(doors, hood, bar);

  const el = document.createElement("canvas");
  el.width = 256;
  el.height = 64;
  const ctx = el.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f4f4f2";
    ctx.font = "900 46px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("POLICE", 128, 34);
  }
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const geo = new THREE.PlaneGeometry(1.5, 0.38);
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(geo, label);
    decal.position.set(side * (s.w / 2 + 0.02), bodyY - s.h * 0.1, -0.1);
    decal.rotation.y = side * Math.PI / 2;
    group.add(decal);
  }
}

export function disposeCarMesh(mesh: THREE.Object3D) {
  mesh.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      (mat as THREE.MeshStandardMaterial).map?.dispose();
      mat.dispose();
    }
  });
}

/** Roof light bar — hidden unless the player is on a police shift. */
export function buildDutySiren() {
  const siren = new THREE.Group();
  siren.name = "duty-siren";
  siren.visible = false;

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.14, 0.32),
    new THREE.MeshStandardMaterial({ color: "#1a1c22", roughness: 0.55, metalness: 0.4 }),
  );
  housing.position.set(0, 1.42, -0.15);
  housing.castShadow = true;
  siren.add(housing);

  const redMat = new THREE.MeshStandardMaterial({
    color: "#ff2a2a",
    emissive: "#ff1a1a",
    emissiveIntensity: 1.6,
    roughness: 0.35,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    color: "#2a6bff",
    emissive: "#1a4cff",
    emissiveIntensity: 1.6,
    roughness: 0.35,
  });

  const lensGeo = new THREE.BoxGeometry(0.42, 0.12, 0.26);
  const red = new THREE.Mesh(lensGeo, redMat);
  red.name = "siren-red";
  red.position.set(-0.32, 1.42, -0.15);
  const blue = new THREE.Mesh(lensGeo, blueMat);
  blue.name = "siren-blue";
  blue.position.set(0.32, 1.42, -0.15);
  siren.add(red, blue);

  return siren;
}

export function placeCarMesh(mesh: THREE.Object3D, car: OwnedVehicle, groundY = 0) {
  mesh.position.set(car.parkX * TILE, groundY, car.parkY * TILE);
  mesh.rotation.y = car.parkYaw;
  mesh.visible = true;
}

/** Pulse red / blue emissive on a car's duty siren. */
export function updateDutySiren(mesh: THREE.Object3D, time: number, on: boolean) {
  let siren = mesh.getObjectByName("duty-siren");
  if (!siren) {
    siren = buildDutySiren();
    mesh.add(siren);
  }
  // Department cars always carry the bar; it just stays dark until the lights are on.
  siren.visible = on || Boolean(mesh.userData.police);
  if (!siren.visible) return;
  const redOn = Math.sin(time * 8) > 0;
  const red = siren.getObjectByName("siren-red") as THREE.Mesh | undefined;
  const blue = siren.getObjectByName("siren-blue") as THREE.Mesh | undefined;
  if (red?.material instanceof THREE.MeshStandardMaterial) {
    red.material.emissiveIntensity = !on ? 0.08 : redOn ? 2.8 : 0.25;
  }
  if (blue?.material instanceof THREE.MeshStandardMaterial) {
    blue.material.emissiveIntensity = !on ? 0.08 : redOn ? 0.25 : 2.8;
  }
}
