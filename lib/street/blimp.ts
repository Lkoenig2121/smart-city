import * as THREE from "three";

export interface Blimp {
  group: THREE.Group;
  /** Night glow on the banner + nav lights. */
  setNight(night: boolean): void;
  setBanner(text: string, accent: string): void;
  dispose(): void;
}

/** Stylised airship with a lit side banner, ~26 m long. */
export function buildBlimp(): Blimp {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  const hullGeo = new THREE.SphereGeometry(1, 32, 18);
  const hullMat = new THREE.MeshLambertMaterial({ color: "#e9edf2" });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.scale.set(13, 4.2, 4.2);
  group.add(hull);
  disposables.push(hullGeo, hullMat);

  const gondolaGeo = new THREE.BoxGeometry(4.2, 1.3, 1.6);
  const gondolaMat = new THREE.MeshLambertMaterial({ color: "#2a3140" });
  const gondola = new THREE.Mesh(gondolaGeo, gondolaMat);
  gondola.position.set(1.2, -4.6, 0);
  group.add(gondola);
  disposables.push(gondolaGeo, gondolaMat);

  const finGeo = new THREE.BoxGeometry(3.2, 0.25, 3.6);
  const finMat = new THREE.MeshLambertMaterial({ color: "#c0392b" });
  disposables.push(finGeo, finMat);
  for (const [rx, y, z] of [
    [0, 0, 2.6],
    [0, 0, -2.6],
    [Math.PI / 2, 2.6, 0],
    [Math.PI / 2, -2.6, 0],
  ] as const) {
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(-11.4, y, z);
    fin.rotation.x = rx;
    group.add(fin);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const bannerMat = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.25,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const bannerGeo = new THREE.PlaneGeometry(16, 4);
  disposables.push(texture, bannerMat, bannerGeo);
  for (const side of [1, -1]) {
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0.6, 0.2, side * 4.25);
    banner.rotation.y = side === 1 ? 0 : Math.PI;
    group.add(banner);
  }

  const navGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const navMats = [
    new THREE.MeshBasicMaterial({ color: "#ff3b3b", toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: "#3bff6a", toneMapped: false }),
  ];
  disposables.push(navGeo, ...navMats);
  const navLights = [
    new THREE.Mesh(navGeo, navMats[0]),
    new THREE.Mesh(navGeo, navMats[1]),
  ];
  navLights[0].position.set(1.2, -5.3, -0.9);
  navLights[1].position.set(1.2, -5.3, 0.9);
  group.add(...navLights);

  const drawBanner = (text: string, accent: string) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 60);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    let size = 104;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    while (size > 40 && ctx.measureText(text).width > canvas.width - 90) {
      size -= 4;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6);
    texture.needsUpdate = true;
  };
  drawBanner("WORLD SERIES", "#1f4d8c");

  return {
    group,
    setNight(night) {
      bannerMat.emissiveIntensity = night ? 1.3 : 0.25;
      hullMat.emissive.set(night ? "#2a3446" : "#000000");
      for (const light of navLights) light.visible = night;
    },
    setBanner(text, accent) {
      drawBanner(text, accent);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
