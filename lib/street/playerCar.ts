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

  group.userData.vehicleId = car.id;
  return group;
}

export function placeCarMesh(mesh: THREE.Object3D, car: OwnedVehicle, groundY = 0) {
  mesh.position.set(car.parkX * TILE, groundY, car.parkY * TILE);
  mesh.rotation.y = car.parkYaw;
  mesh.visible = true;
}
