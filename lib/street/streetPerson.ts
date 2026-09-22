import * as THREE from "three";

export interface StreetPersonLook {
  shirt?: string;
  pants?: string;
  hair?: string;
  skin?: string;
  shoes?: string;
}

/**
 * A small third-person pedestrian for mission scenes (escorts, bystanders).
 * Matches the low-poly street style used by AgentLayer citizens.
 */
export function buildStreetPerson(look: StreetPersonLook = {}) {
  const group = new THREE.Group();
  group.name = "street-person";

  const skin = new THREE.MeshStandardMaterial({
    color: look.skin ?? "#e2c4a6",
    roughness: 0.85,
  });
  const hair = new THREE.MeshStandardMaterial({
    color: look.hair ?? "#3a2a22",
    roughness: 0.9,
  });
  const shirt = new THREE.MeshStandardMaterial({
    color: look.shirt ?? "#c45c4a",
    roughness: 0.78,
  });
  const pants = new THREE.MeshStandardMaterial({
    color: look.pants ?? "#2c3e50",
    roughness: 0.82,
  });
  const shoes = new THREE.MeshStandardMaterial({
    color: look.shoes ?? "#1a1206",
    roughness: 0.88,
  });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 8), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), skin);
  head.position.y = 1.58;
  head.castShadow = true;
  group.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hair,
  );
  hairCap.position.set(0, 1.66, 0);
  group.add(hairCap);

  for (const side of [-1, 1] as const) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 3, 6), shirt);
    arm.position.set(side * 0.3, 1.05, 0);
    arm.rotation.z = side * 0.12;
    arm.castShadow = true;
    group.add(arm);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.38, 3, 6), pants);
    leg.position.set(side * 0.11, 0.48, 0);
    leg.castShadow = true;
    group.add(leg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.22), shoes);
    foot.position.set(side * 0.11, 0.06, 0.04);
    group.add(foot);
  }

  return group;
}

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}
