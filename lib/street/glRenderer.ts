import * as THREE from "three";

/**
 * A plain WebGL2 context. Naming a power preference makes Chrome refuse the
 * context on a Mac with one GPU, and after that refusal every context in the
 * browser reports GL_RENDERER = Disabled until Chrome is quit and reopened.
 */
export function createGlRenderer(canvas: HTMLCanvasElement) {
  return new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    stencil: false,
    failIfMajorPerformanceCaveat: false,
  });
}

export function releaseGlRenderer(renderer: THREE.WebGLRenderer) {
  renderer.dispose();
}
