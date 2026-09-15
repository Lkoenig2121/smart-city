import * as THREE from "three";
import type { BuildingVolume } from "./buildCity";

const PAD = 0.22;
const AIM_MAX = 56;

const rimVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const rimFragment = /* glsl */ `
  uniform float intensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.35);
    float alpha = rim * intensity;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

/**
 * White rim + edge lines fitted to a building's world box, used to mark the
 * selected (or aimed-at) structure in Street View.
 */
export class BuildingGlow {
  readonly group = new THREE.Group();
  private rim: THREE.Mesh;
  private hull: THREE.Mesh;
  private edges: THREE.LineSegments;
  private rimMat: THREE.ShaderMaterial;
  private hullMat: THREE.MeshBasicMaterial;
  private edgeMat: THREE.LineBasicMaterial;
  private size = new THREE.Vector3();
  private center = new THREE.Vector3();
  private time = 0;

  constructor() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.rimMat = new THREE.ShaderMaterial({
      uniforms: { intensity: { value: 1.15 } },
      vertexShader: rimVertex,
      fragmentShader: rimFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    this.rim = new THREE.Mesh(geo, this.rimMat);

    this.hullMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.hull = new THREE.Mesh(geo, this.hullMat);
    this.hull.scale.setScalar(1.018);

    const edgeGeo = new THREE.EdgesGeometry(geo);
    this.edgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.edges = new THREE.LineSegments(edgeGeo, this.edgeMat);

    this.group.add(this.hull, this.rim, this.edges);
    this.group.visible = false;
    this.group.renderOrder = 8;
    this.group.frustumCulled = false;
  }

  pick(ray: THREE.Ray, volumes: BuildingVolume[], hit: THREE.Vector3) {
    let best: BuildingVolume | null = null;
    let bestD = AIM_MAX;
    let bestFootprint = Infinity;
    for (const volume of volumes) {
      const point = ray.intersectBox(volume.box, hit);
      if (!point) continue;
      const distance = point.distanceTo(ray.origin);
      if (distance < 0.08 || distance > AIM_MAX) continue;
      volume.box.getSize(this.size);
      const footprint = this.size.x * this.size.z;
      const closer = distance < bestD - 2.2;
      const similar = Math.abs(distance - bestD) <= 2.2;
      if (closer || (similar && footprint < bestFootprint) || (!best && distance < bestD)) {
        best = volume;
        bestD = distance;
        bestFootprint = footprint;
      }
    }
    return best;
  }

  show(volume: BuildingVolume | null, dt: number) {
    this.time += dt;
    if (!volume) {
      this.group.visible = false;
      return;
    }
    volume.box.getSize(this.size);
    volume.box.getCenter(this.center);
    this.group.position.copy(this.center);
    this.group.scale.set(this.size.x + PAD, this.size.y + PAD, this.size.z + PAD);
    this.group.visible = true;
    const pulse = 0.78 + 0.22 * Math.sin(this.time * 3.4);
    this.rimMat.uniforms.intensity.value = 1.05 + 0.4 * Math.sin(this.time * 3.4);
    this.hullMat.opacity = 0.16 + 0.1 * pulse;
    this.edgeMat.opacity = pulse;
  }

  hide() {
    this.group.visible = false;
  }

  dispose() {
    this.rim.geometry.dispose();
    this.edges.geometry.dispose();
    this.rimMat.dispose();
    this.hullMat.dispose();
    this.edgeMat.dispose();
  }
}
