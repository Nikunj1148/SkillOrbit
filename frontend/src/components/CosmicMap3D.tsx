import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import type { LessonSummary } from '../services/api';

export interface CosmicMap3DProps {
  curriculum: LessonSummary[];
  onSelectLesson: (id: string) => void;
  activePath: string;
  language: string;
}

export const CosmicMap3D: React.FC<CosmicMap3DProps> = ({
  curriculum,
  onSelectLesson,
  activePath,
  language: _language,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [webglSupported, setWebglSupported] = useState(true);
  const [hoveredLesson, setHoveredLesson] = useState<LessonSummary | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const foundations = useMemo(() => curriculum.filter(l => l.type === 'foundation'), [curriculum]);
  const missions = useMemo(() => curriculum.filter(l => l.type === 'mission'), [curriculum]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setViewMode('2d');
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (viewMode !== '3d' || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 650;
    const height = 480;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch {
      setWebglSupported(false);
      setViewMode('2d');
      return;
    }

    container.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 12, 18);
    camera.lookAt(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x2a3366, 1.8);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0x00e5ff, 3.5, 30);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    const dirLight = new THREE.DirectionalLight(0x7c4dff, 1.5);
    dirLight.position.set(10, 15, 10);
    scene.add(dirLight);

    // Central Star (AI Core)
    const sunGeo = new THREE.SphereGeometry(1.6, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);

    // Sun Glow Halo
    const glowGeo = new THREE.SphereGeometry(2.1, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // Particle Starfield
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 50;
      starPos[i + 1] = (Math.random() - 0.5) * 30;
      starPos[i + 2] = (Math.random() - 0.5) * 50;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x9fa8da, size: 0.15, transparent: true, opacity: 0.7 });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // Orbit Rings
    const createOrbitRing = (radius: number, color: number) => {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
      const points = curve.getPoints(64);
      const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
      const ringLine = new THREE.Line(ringGeo, ringMat);
      scene.add(ringLine);
    };

    createOrbitRing(5.5, 0x00e5ff); // Foundations orbit
    createOrbitRing(9.5, 0xffd740); // Missions orbit

    // Planet Meshes map
    const clickableMeshes: { mesh: THREE.Mesh; lesson: LessonSummary; baseScale: number }[] = [];

    // Inner Planets (Foundations)
    const fRadius = 5.5;
    foundations.forEach((l, idx) => {
      const angle = (idx / Math.max(1, foundations.length)) * Math.PI * 2;
      const x = Math.cos(angle) * fRadius;
      const z = Math.sin(angle) * fRadius;

      const pGeo = new THREE.SphereGeometry(0.75, 24, 24);
      let pColor = 0x3949ab;
      let emissive = 0x000000;
      if (l.progress.completed) {
        pColor = 0x00e676;
        emissive = 0x00a854;
      } else if (!l.is_locked) {
        pColor = 0x00e5ff;
        emissive = 0x007c91;
      }

      const pMat = new THREE.MeshStandardMaterial({
        color: pColor,
        emissive,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.6,
      });

      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(x, 0, z);
      pMesh.userData = { lessonId: l.id };
      scene.add(pMesh);
      clickableMeshes.push({ mesh: pMesh, lesson: l, baseScale: 1.0 });

      // Ring for in-progress or selected
      if (!l.is_locked && !l.progress.completed) {
        const haloGeo = new THREE.TorusGeometry(1.0, 0.03, 8, 32);
        haloGeo.rotateX(Math.PI / 2);
        const haloMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        pMesh.add(halo);
      }
    });

    // Outer Planets (Missions)
    const mRadius = 9.5;
    missions.forEach((l, idx) => {
      const angle = (idx / Math.max(1, missions.length)) * Math.PI * 2 + Math.PI * 0.25;
      const x = Math.cos(angle) * mRadius;
      const z = Math.sin(angle) * mRadius;

      const pGeo = new THREE.SphereGeometry(1.0, 24, 24);
      let pColor = 0x3949ab;
      let emissive = 0x000000;
      if (l.progress.completed) {
        pColor = 0x00e676;
        emissive = 0x00a854;
      } else if (!l.is_locked) {
        pColor = 0xffa000;
        emissive = 0xff6f00;
      }

      const pMat = new THREE.MeshStandardMaterial({
        color: pColor,
        emissive,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.5,
      });

      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(x, 0, z);
      pMesh.userData = { lessonId: l.id };
      scene.add(pMesh);
      clickableMeshes.push({ mesh: pMesh, lesson: l, baseScale: 1.2 });
    });

    // Raycasting for mouse interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isDragging = false;
    let prevMouseX = 0;
    let sceneRotationY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        sceneRotationY += deltaX * 0.006;
        prevMouseX = e.clientX;
      }

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableMeshes.map(c => c.mesh));

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const target = clickableMeshes.find(c => c.mesh === hitMesh);
        if (target) {
          setHoveredLesson(target.lesson);
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          renderer.domElement.style.cursor = target.lesson.is_locked ? 'not-allowed' : 'pointer';
        }
      } else {
        setHoveredLesson(null);
        renderer.domElement.style.cursor = isDragging ? 'grabbing' : 'grab';
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableMeshes.map(c => c.mesh));
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const target = clickableMeshes.find(c => c.mesh === hitMesh);
        if (target && !target.lesson.is_locked) {
          onSelectLesson(target.lesson.id);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('click', onClick);

    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Auto rotation when not dragging
      if (!isDragging) {
        sceneRotationY += delta * 0.12;
      }

      scene.rotation.y = sceneRotationY;

      // Sun pulsing glow
      const sunPulse = 1.6 + Math.sin(elapsed * 2.5) * 0.08;
      sunMesh.scale.set(sunPulse, sunPulse, sunPulse);
      glowMesh.scale.set(sunPulse * 1.3, sunPulse * 1.3, sunPulse * 1.3);

      // Starfield subtle rotation
      starPoints.rotation.y = elapsed * 0.02;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('click', onClick);
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
      renderer.dispose();
      sunGeo.dispose();
      sunMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      starGeo.dispose();
      starMat.dispose();
    };
  }, [viewMode, foundations, missions, onSelectLesson]);

  return (
    <div className="cosmic-map-container" style={{ position: 'relative', width: '100%' }}>
      {/* View Mode Toggle Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Orbit Visualization:</span>
          <div style={{ display: 'inline-flex', background: 'var(--bg-glass)', borderRadius: 20, padding: 3, border: 'var(--border-glass)' }}>
            <button
              onClick={() => setViewMode('3d')}
              className="btn btn-ghost"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                minHeight: 'auto',
                borderRadius: 16,
                background: viewMode === '3d' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === '3d' ? '#000' : 'var(--text-secondary)',
                fontWeight: viewMode === '3d' ? 700 : 500,
              }}
              disabled={!webglSupported}
            >
              🌌 3D Solar Orbit
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className="btn btn-ghost"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                minHeight: 'auto',
                borderRadius: 16,
                background: viewMode === '2d' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === '2d' ? '#000' : 'var(--text-secondary)',
                fontWeight: viewMode === '2d' ? 700 : 500,
              }}
            >
              🗺️ 2D Constellation Grid
            </button>
          </div>
        </div>

        {viewMode === '3d' && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            🖱️ Drag to orbit · Click unlocked planet to launch
          </span>
        )}
      </div>

      {/* 3D Mode Canvas */}
      {viewMode === '3d' ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 480,
            borderRadius: 'var(--border-radius-lg)',
            overflow: 'hidden',
            background: 'radial-gradient(ellipse at center, rgba(20, 26, 70, 0.7) 0%, rgba(10, 14, 39, 0.95) 100%)',
            border: 'var(--border-glass)',
          }}
        >
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

          {/* Interactive Tooltip Card */}
          {hoveredLesson && tooltipPos && (
            <div
              role="tooltip"
              style={{
                position: 'absolute',
                left: Math.min(tooltipPos.x + 15, 380),
                top: Math.max(tooltipPos.y - 60, 20),
                background: 'rgba(17, 22, 64, 0.95)',
                border: hoveredLesson.is_locked
                  ? '1px solid rgba(255, 255, 255, 0.2)'
                  : hoveredLesson.progress.completed
                    ? '1px solid var(--success)'
                    : '1px solid var(--accent-primary)',
                padding: '10px 14px',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                pointerEvents: 'none',
                maxWidth: 240,
                zIndex: 20,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <span className="chip" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                  {hoveredLesson.type === 'foundation' ? 'Foundation' : 'Mission'}
                </span>
                {hoveredLesson.progress.completed ? (
                  <span style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>Completed ✓</span>
                ) : hoveredLesson.is_locked ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Locked 🔒</span>
                ) : (
                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600 }}>Ready to Start 🚀</span>
                )}
              </div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '2px 0 4px', color: 'var(--text-primary)' }}>
                {hoveredLesson.title}
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                ~{hoveredLesson.estimated_duration_minutes} min · +{hoveredLesson.progress.total_xp || 50} XP
              </p>
            </div>
          )}

          {/* Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              display: 'flex',
              gap: 12,
              background: 'rgba(10, 14, 39, 0.8)',
              padding: '6px 12px',
              borderRadius: 20,
              border: 'var(--border-glass)',
              fontSize: '0.75rem',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
              Completed
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)' }} />
              Available
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3949ab' }} />
              Locked
            </span>
          </div>
        </div>
      ) : (
        /* 2D Fallback Constellation Grid */
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Foundation Nodes */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: 'var(--accent-primary)' }}>
              🏗️ Core Foundations (Shared)
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {foundations.map((l, i) => (
                <div
                  key={l.id}
                  onClick={() => !l.is_locked && onSelectLesson(l.id)}
                  style={{
                    width: 100,
                    textAlign: 'center',
                    cursor: l.is_locked ? 'default' : 'pointer',
                    opacity: l.is_locked ? 0.4 : 1,
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => !l.is_locked && (e.currentTarget.style.transform = 'scale(1.06)')}
                  onMouseLeave={e => !l.is_locked && (e.currentTarget.style.transform = 'scale(1.0)')}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      margin: '0 auto 8px',
                      background: l.progress.completed
                        ? 'var(--success)'
                        : l.is_locked
                          ? 'var(--bg-glass)'
                          : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      boxShadow: l.progress.completed
                        ? 'var(--glow-success)'
                        : l.is_locked ? 'none' : 'var(--glow-primary)',
                      border: l.progress.attempt_count > 0 && !l.progress.completed ? '3px solid var(--accent-primary)' : 'none',
                    }}
                  >
                    {l.progress.completed ? '✅' : l.is_locked ? '🔒' : `F${i + 1}`}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {l.title.slice(0, 26)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ~{l.estimated_duration_minutes} min
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mission Nodes */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: 'var(--accent-warm)' }}>
              🎯 Path Missions — {activePath.toUpperCase()}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {missions.map((l, i) => (
                <div
                  key={l.id}
                  onClick={() => !l.is_locked && onSelectLesson(l.id)}
                  style={{
                    width: 110,
                    textAlign: 'center',
                    cursor: l.is_locked ? 'default' : 'pointer',
                    opacity: l.is_locked ? 0.4 : 1,
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => !l.is_locked && (e.currentTarget.style.transform = 'scale(1.06)')}
                  onMouseLeave={e => !l.is_locked && (e.currentTarget.style.transform = 'scale(1.0)')}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      margin: '0 auto 8px',
                      background: l.progress.completed
                        ? 'var(--success)'
                        : l.is_locked
                          ? 'var(--bg-glass)'
                          : 'linear-gradient(135deg, var(--accent-warm), var(--accent-gold))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      boxShadow: l.progress.completed
                        ? 'var(--glow-success)'
                        : l.is_locked ? 'none' : '0 0 20px rgba(255, 110, 64, 0.35)',
                    }}
                  >
                    {l.progress.completed ? '✅' : l.is_locked ? '🔒' : `M${i + 1}`}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {l.title.slice(0, 28)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ~{l.estimated_duration_minutes} min
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CosmicMap3D;
