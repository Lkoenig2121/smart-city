"use client";

import type { OwnedVehicle } from "@/lib/city/vehicles";
import { carLookKey, disposeCarMesh, makePlayerCarMesh } from "@/lib/street/playerCar";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Slowly spinning 3D model of a car; drag to turn it by hand. */
export function CarTurntable({ car }: { car: OwnedVehicle }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ root: THREE.Group; mesh: THREE.Object3D | null; key: string } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(6.2, 3.1, 7.4);
    camera.lookAt(0, 0.6, 0);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a2420, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 8, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc98a, 1.1);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    const floorGeo = new THREE.CircleGeometry(3.6, 48);
    const floorMat = new THREE.MeshStandardMaterial({ color: "#2a2620", roughness: 0.85 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const root = new THREE.Group();
    scene.add(root);
    sceneRef.current = { root, mesh: null, key: "" };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let dragging = false;
    let lastX = 0;
    let spin = 0.5;
    const down = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      host.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      root.rotation.y += (event.clientX - lastX) * 0.012;
      lastX = event.clientX;
    };
    const up = () => {
      dragging = false;
    };
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spin = dragging ? 0 : Math.min(0.5, spin + dt * 0.5);
      root.rotation.y += spin * dt;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      const current = sceneRef.current;
      if (current?.mesh) disposeCarMesh(current.mesh);
      sceneRef.current = null;
      floorGeo.dispose();
      floorMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const current = sceneRef.current;
    if (!current) return;
    const next = carLookKey(car);
    if (current.key === next) return;
    if (current.mesh) {
      current.root.remove(current.mesh);
      disposeCarMesh(current.mesh);
    }
    const mesh = makePlayerCarMesh(car);
    current.root.add(mesh);
    current.mesh = mesh;
    current.key = next;
  });

  return <div ref={hostRef} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />;
}
