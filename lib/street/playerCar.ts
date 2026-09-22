import * as THREE from "three";
import type { OwnedVehicle } from "@/lib/city/vehicles";
import { TILE } from "./buildCity";

/** Simple parked/driven car mesh for the player fleet. */
export function makePlayerCarMesh(car: OwnedVehicle) {
  const group = new THREE.Group();
  group.name = `owned-car-${car.id}`;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(car.color),
    roughness: 0.42,
    metalness: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.8, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: "#9ec5e8",
    roughness: 0.15,
    metalness: 0.4,
    transparent: true,
    opacity: 0.55,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.05, -0.15);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [x, z] of [
    [-0.85, 1.25],
    [0.85, 1.25],
    [-0.85, -1.25],
    [0.85, -1.25],
  ] as const) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(x, 0.38, z);
    wheel.castShadow = true;
    group.add(wheel);
  }

  group.add(buildDutySiren());

  group.userData.vehicleId = car.id;
  return group;
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
  siren.visible = on;
  if (!on) return;
  const flash = time * 8;
  const redOn = Math.sin(flash) > 0;
  const red = siren.getObjectByName("siren-red") as THREE.Mesh | undefined;
  const blue = siren.getObjectByName("siren-blue") as THREE.Mesh | undefined;
  if (red?.material instanceof THREE.MeshStandardMaterial) {
    red.material.emissiveIntensity = redOn ? 2.8 : 0.25;
  }
  if (blue?.material instanceof THREE.MeshStandardMaterial) {
    blue.material.emissiveIntensity = redOn ? 0.25 : 2.8;
  }
}
