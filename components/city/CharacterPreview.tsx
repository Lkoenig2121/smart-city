"use client";

import { clothingById, outfitLook, wornSlots, type OutfitSlots } from "@/lib/city/clothing";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  slots: OutfitSlots;
  previewId?: string | null;
}

export function CharacterPreview({ slots, previewId }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const look = outfitLook(slots, previewId);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x1a2433, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#243044");
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
    camera.position.set(0, 1.35, 4.2);
    camera.lookAt(0, 1.05, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a4658, 1.05));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
    sun.position.set(2.2, 5, 3.4);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9ec4ff, 0.45);
    fill.position.set(-3, 2, -1);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 32),
      new THREE.MeshLambertMaterial({ color: "#151c26" }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const root = new THREE.Group();
    scene.add(root);

    const resize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      renderer.setSize(w, h, false);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const clearRoot = () => {
      while (root.children.length) {
        const child = root.children[0];
        root.remove(child);
        child.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry.dispose();
            const mat = node.material;
            if (Array.isArray(mat)) mat.forEach((item) => item.dispose());
            else mat.dispose();
          }
        });
      }
    };

    const add = (mesh: THREE.Mesh) => {
      root.add(mesh);
    };

    const paint = () => {
      clearRoot();
      const worn = wornSlots(slots, previewId);
      const skin = new THREE.MeshLambertMaterial({ color: "#e2c4a6" });
      const hair = new THREE.MeshLambertMaterial({ color: "#3a2a22" });

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), skin);
      head.position.y = 1.68;
      add(head);
      const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
      hairCap.position.set(0, 1.78, 0);
      add(hairCap);

      const hat = clothingById(worn.head ?? "");
      if (hat) {
        const brim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.04, 18),
          new THREE.MeshLambertMaterial({ color: hat.color }),
        );
        brim.position.y = 1.88;
        add(brim);
        const crown = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.22, 0.16, 16),
          new THREE.MeshLambertMaterial({ color: hat.accent }),
        );
        crown.position.y = 1.98;
        add(crown);
      }

      const top = clothingById(worn.upper ?? "");
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.68, 0.4),
        new THREE.MeshLambertMaterial({ color: top?.color ?? "#cbb7a0" }),
      );
      torso.position.y = 1.18;
      add(torso);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.18, 0.42),
        new THREE.MeshLambertMaterial({ color: top?.accent ?? "#2f5d4a" }),
      );
      stripe.position.set(0, 1.28, 0);
      add(stripe);

      const armMat = new THREE.MeshLambertMaterial({ color: top?.accent ?? "#c4a882" });
      for (const x of [-0.5, 0.5]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), armMat);
        arm.position.set(x, 1.14, 0);
        add(arm);
      }

      const bottom = clothingById(worn.lower ?? "");
      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.78, 0.34),
        new THREE.MeshLambertMaterial({ color: bottom?.color ?? "#2a3140" }),
      );
      legs.position.y = 0.48;
      add(legs);

      const shoes = clothingById(worn.feet ?? "");
      const feet = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.16, 0.4),
        new THREE.MeshLambertMaterial({ color: shoes?.color ?? "#ece8e0" }),
      );
      feet.position.y = 0.08;
      add(feet);
      if (shoes) {
        const toe = new THREE.Mesh(
          new THREE.BoxGeometry(0.56, 0.06, 0.12),
          new THREE.MeshLambertMaterial({ color: shoes.accent }),
        );
        toe.position.set(0, 0.08, 0.16);
        add(toe);
      }

      const bag = clothingById(worn.accessory ?? "");
      if (bag) {
        const pack = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.32, 0.14),
          new THREE.MeshLambertMaterial({ color: bag.color, emissive: new THREE.Color(bag.accent), emissiveIntensity: 0.08 }),
        );
        pack.position.set(0.42, 1.12, 0);
        add(pack);
      }
    };
    paint();

    let frame = 0;
    const loop = () => {
      root.rotation.y += 0.01;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      clearRoot();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, [slots.head, slots.upper, slots.lower, slots.feet, slots.accessory, previewId]);

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-[22rem] w-full overflow-hidden rounded-xl bg-[#243044]"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pb-3 pt-10">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-amber-300/90">Looks like</p>
        <p className="mt-1 text-sm font-medium leading-snug text-white">{look.headline}</p>
        <p className="mt-0.5 text-[0.7rem] text-slate-300">{look.extras}</p>
        <p className="mt-1 text-[0.65rem] leading-snug text-slate-400">{look.detail}</p>
      </div>
    </div>
  );
}
