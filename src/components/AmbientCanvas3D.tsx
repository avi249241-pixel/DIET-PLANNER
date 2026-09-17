import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function AmbientCanvas3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let animId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      // 1. Scene setup
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 24;

      // 2. Renderer setup (with alpha transparency)
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      mount.appendChild(renderer.domElement);

      // 3. Ambient lighting & geometric visual elements
      const ambientLight = new THREE.AmbientLight(0x064e3b, 0.6);
      scene.add(ambientLight);

      const pointLight = new THREE.PointLight(0x10b981, 1.2, 50);
      pointLight.position.set(10, 10, 10);
      scene.add(pointLight);

      const secondaryLight = new THREE.PointLight(0x06b6d4, 0.8, 50);
      secondaryLight.position.set(-10, -10, 5);
      scene.add(secondaryLight);

      // 4. Central Geometric Wireframe Mesh (Icosahedron)
      const geometry = new THREE.IcosahedronGeometry(7, 1);
      const wireframeGeometry = new THREE.WireframeGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.18,
        linewidth: 1
      });
      const wireframe = new THREE.LineSegments(wireframeGeometry, lineMaterial);
      scene.add(wireframe);

      // 5. Ambient Floating Particle Points (representing micro-nutrients & energy nodes)
      const particleCount = 120;
      const particleGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 45;
        positions[i + 1] = (Math.random() - 0.5) * 45;
        positions[i + 2] = (Math.random() - 0.5) * 20;
      }
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particleMaterial = new THREE.PointsMaterial({
        color: 0x34d399,
        size: 0.18,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // 6. Subtle cursor interaction
      let mouseX = 0;
      let mouseY = 0;
      const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 0.5;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 0.5;
      };
      window.addEventListener('mousemove', onMouseMove, { passive: true });

      // 7. Responsive resize listener
      const onResize = () => {
        if (!renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', onResize);

      // 8. Animation loop
      let clock = new THREE.Clock();
      const animate = () => {
        animId = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Smooth non-blocking ambient rotation
        wireframe.rotation.x = elapsedTime * 0.04 + mouseY * 0.2;
        wireframe.rotation.y = elapsedTime * 0.06 + mouseX * 0.2;

        particles.rotation.y = -elapsedTime * 0.015;
        particles.rotation.x = elapsedTime * 0.01;

        if (renderer) {
          renderer.render(scene, camera);
        }
      };
      animate();

      // Cleanup on unmount
      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
        if (renderer && renderer.domElement && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
          renderer.dispose();
        }
        geometry.dispose();
        lineMaterial.dispose();
        particleGeometry.dispose();
        particleMaterial.dispose();
      };
    } catch (e) {
      console.warn('Three.js ambient layer disabled (WebGL unavailable or non-critical error):', e);
    }
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none"
      aria-hidden="true"
    />
  );
}
