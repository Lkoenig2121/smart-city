import * as THREE from "three";
import type { WeatherKind } from "@/lib/city/types";

/** Rain streaks and snow flakes that follow the first-person camera. */
export class StreetWeatherFx {
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments;
  private snow: THREE.Points;
  private rainPos: Float32Array;
  private snowPos: Float32Array;

  constructor() {
    const rainCount = 700;
    this.rainPos = new Float32Array(rainCount * 6);
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(
      rainGeo,
      new THREE.LineBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0.42 }),
    );
    this.group.add(this.rain);

    const snowCount = 420;
    this.snowPos = new Float32Array(snowCount * 3);
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute("position", new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85 }),
    );
    this.group.add(this.snow);
    this.seed();
  }

  private seed() {
    for (let i = 0; i < this.rainPos.length; i += 6) {
      const x = (Math.random() - 0.5) * 28;
      const y = Math.random() * 16;
      const z = (Math.random() - 0.5) * 28;
      this.rainPos[i] = x;
      this.rainPos[i + 1] = y;
      this.rainPos[i + 2] = z;
      this.rainPos[i + 3] = x + 0.08;
      this.rainPos[i + 4] = y - 0.55;
      this.rainPos[i + 5] = z + 0.04;
    }
    for (let i = 0; i < this.snowPos.length; i += 3) {
      this.snowPos[i] = (Math.random() - 0.5) * 26;
      this.snowPos[i + 1] = Math.random() * 14;
      this.snowPos[i + 2] = (Math.random() - 0.5) * 26;
    }
  }

  update(dt: number, camera: THREE.Camera, kind: WeatherKind) {
    this.rain.visible = kind === "rain";
    this.snow.visible = kind === "snow";
    this.group.position.copy(camera.position);

    if (kind === "rain") {
      for (let i = 0; i < this.rainPos.length; i += 6) {
        this.rainPos[i + 1] -= dt * 18;
        this.rainPos[i + 4] -= dt * 18;
        if (this.rainPos[i + 1] < -2) {
          const y = 12 + Math.random() * 4;
          this.rainPos[i + 1] = y;
          this.rainPos[i + 4] = y - 0.55;
        }
      }
      (this.rain.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }

    if (kind === "snow") {
      for (let i = 0; i < this.snowPos.length; i += 3) {
        this.snowPos[i + 1] -= dt * 1.6;
        this.snowPos[i] += Math.sin(this.snowPos[i + 2] + this.snowPos[i + 1]) * dt * 0.4;
        if (this.snowPos[i + 1] < -1) this.snowPos[i + 1] = 12;
      }
      (this.snow.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.rain.geometry.dispose();
    (this.rain.material as THREE.Material).dispose();
    this.snow.geometry.dispose();
    (this.snow.material as THREE.Material).dispose();
  }
}
