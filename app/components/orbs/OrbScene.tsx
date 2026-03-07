"use client";

import { useEffect, useRef, useCallback } from "react";
import type { OrbData } from "./types";
import { getOrbHexColor } from "./types";

interface OrbSceneProps {
  orbs: OrbData[];
  activeOrbId?: string;
  onOrbClick?: (orbId: string) => void;
}

/**
 * Three.js canvas that renders floating expert orbs.
 *
 * Each orb is a sphere with emissive glow. The active orb is enlarged
 * with a white ring around it. All orbs gently float using sine waves.
 *
 * No React Three Fiber — raw Three.js with useEffect for minimal deps.
 */
export function OrbScene({ orbs, activeOrbId, onOrbClick }: OrbSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!canvasRef.current || !onOrbClick || orbs.length === 0) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      // Simple horizontal hit test: divide canvas equally among orbs
      const index = Math.floor(((x + 1) / 2) * orbs.length);
      const clamped = Math.max(0, Math.min(orbs.length - 1, index));
      onOrbClick(orbs[clamped].id);
    },
    [orbs, onOrbClick]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || orbs.length === 0) return;

    // Dynamic import to avoid SSR issues
    let active = true;
    let animId: number;

    import("three").then(
      ({
        WebGLRenderer,
        Scene,
        PerspectiveCamera,
        SphereGeometry,
        MeshStandardMaterial,
        Mesh,
        PointLight,
        AmbientLight,
        RingGeometry,
        MeshBasicMaterial,
      }) => {
        if (!active || !canvas) return;

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        // Renderer
        const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);

        // Scene + Camera
        const scene = new Scene();
        const camera = new PerspectiveCamera(60, width / height, 0.1, 100);
        camera.position.set(0, 0, 8);

        // Lighting
        const ambient = new AmbientLight(0xffffff, 0.3);
        scene.add(ambient);
        const fill = new PointLight(0xffffff, 2, 30);
        fill.position.set(0, 5, 5);
        scene.add(fill);

        // Orb geometry (shared)
        const geo = new SphereGeometry(0.7, 32, 32);

        // Spread orbs horizontally
        const spacing = Math.min(3, 12 / Math.max(orbs.length, 1));
        const totalWidth = spacing * (orbs.length - 1);

        const meshes = orbs.map((orb, i) => {
          const color = getOrbHexColor(orb.confidence, orb.status);
          const mat = new MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.4,
            roughness: 0.2,
            metalness: 0.6,
          });
          const mesh = new Mesh(geo, mat);
          const isActive = orb.id === activeOrbId;
          const scale = isActive ? 1.4 : 1.0;
          mesh.scale.setScalar(scale);
          mesh.position.set(-totalWidth / 2 + i * spacing, 0, 0);
          scene.add(mesh);

          // White ring for active orb
          let ring: Mesh | null = null;
          if (isActive) {
            const ringGeo = new RingGeometry(0.9, 1.05, 48);
            const ringMat = new MeshBasicMaterial({ color: 0xffffff, side: 2 });
            ring = new Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            mesh.add(ring);
          }

          return { mesh, ring, orb, baseY: 0 };
        });

        const clock = { start: Date.now() };

        function animate() {
          if (!active) return;
          animId = requestAnimationFrame(animate);

          const t = (Date.now() - clock.start) / 1000;

          for (let i = 0; i < meshes.length; i++) {
            const { mesh, orb } = meshes[i];
            // Float: each orb at different phase
            mesh.position.y = Math.sin(t * 0.8 + i * 1.2) * 0.15;

            // Update color if confidence changed
            const mat = mesh.material as MeshStandardMaterial;
            const newColor = getOrbHexColor(orb.confidence, orb.status);
            mat.color.setHex(newColor);
            mat.emissive.setHex(newColor);

            // Building orbs spin
            if (orb.status === "building") {
              mesh.rotation.y = t * 1.5;
            }
          }

          renderer.render(scene, camera);
        }

        animate();

        // Handle resize
        function onResize() {
          if (!canvas) return;
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
        window.addEventListener("resize", onResize);

        cleanupRef.current = () => {
          active = false;
          cancelAnimationFrame(animId);
          renderer.dispose();
          window.removeEventListener("resize", onResize);
          for (const { mesh } of meshes) {
            scene.remove(mesh);
          }
        };
      }
    );

    canvas.addEventListener("click", handleClick);

    return () => {
      active = false;
      if (animId) cancelAnimationFrame(animId);
      cleanupRef.current?.();
      canvas.removeEventListener("click", handleClick);
    };
  }, [orbs, activeOrbId, handleClick]);

  if (orbs.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">
          Assembling your expert committee…
        </p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      style={{ display: "block" }}
    />
  );
}
