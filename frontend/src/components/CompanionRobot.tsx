import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface CompanionRobotProps {
  mood?: 'idle' | 'happy' | 'thinking' | 'celebrating';
  size?: number;
  speechText?: string;
  onClick?: () => void;
  className?: string;
}

export const CompanionRobot: React.FC<CompanionRobotProps> = ({
  mood = 'idle',
  size = 110,
  speechText,
  onClick,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const [showSpeech, setShowSpeech] = useState(false);
  const [speechMessage, setSpeechMessage] = useState(speechText || '');
  const isCelebrating = mood === 'happy' || mood === 'celebrating';

  // Check reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (speechText) {
      setSpeechMessage(speechText);
      setShowSpeech(true);
      const timer = setTimeout(() => setShowSpeech(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [speechText]);

  useEffect(() => {
    if (prefersReducedMotion || !mountRef.current) {
      setWebglSupported(false);
      return;
    }

    const container = mountRef.current;
    const width = size;
    const height = size;

    // Test WebGL support
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    } catch {
      setWebglSupported(false);
      return;
    }

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0.2, 3.8);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xdde5ff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00e5ff, 2.5);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7c4dff, 3.0);
    rimLight.position.set(-3, -2, -2);
    scene.add(rimLight);

    const visorLight = new THREE.PointLight(0x00e5ff, 2.0, 3);
    visorLight.position.set(0, 0.1, 1.2);
    scene.add(visorLight);

    // Robot assembly
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // Head (metallic cosmic sphere)
    const headGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x141a45,
      metalness: 0.85,
      roughness: 0.15,
      envMapIntensity: 1.0,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    robotGroup.add(headMesh);

    // Visor (curved dark screen with cyan glow)
    const visorGeo = new THREE.SphereGeometry(0.86, 32, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.3);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x001025,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.9,
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    robotGroup.add(visorMesh);

    // Eyes (two glowing expressive horizontal pills/orbs)
    const eyeGeo = new THREE.CapsuleGeometry(0.08, 0.18, 12, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.rotation.z = Math.PI / 2;
    leftEye.position.set(-0.28, 0.05, 0.82);
    robotGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.rotation.z = Math.PI / 2;
    rightEye.position.set(0.28, 0.05, 0.82);
    robotGroup.add(rightEye);

    // Antenna
    const stemGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.35, 12);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x7c4dff, metalness: 0.9, roughness: 0.2 });
    const antennaStem = new THREE.Mesh(stemGeo, stemMat);
    antennaStem.position.set(0, 0.95, 0);
    robotGroup.add(antennaStem);

    const tipGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x64ffda,
      emissive: 0x64ffda,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });
    const antennaTip = new THREE.Mesh(tipGeo, tipMat);
    antennaTip.position.set(0, 1.15, 0);
    robotGroup.add(antennaTip);

    // Orbiting satellite ring & moonlet
    const ringGeo = new THREE.TorusGeometry(1.25, 0.02, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x7c4dff,
      emissive: 0x7c4dff,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.6,
    });
    const orbitRing = new THREE.Mesh(ringGeo, ringMat);
    orbitRing.rotation.x = Math.PI * 0.4;
    robotGroup.add(orbitRing);

    const moonletGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const moonletMat = new THREE.MeshStandardMaterial({
      color: 0xffd740,
      emissive: 0xffd740,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    });
    const moonlet = new THREE.Mesh(moonletGeo, moonletMat);
    robotGroup.add(moonlet);

    let animationFrameId: number;
    let clock = new THREE.Clock();
    let spinVelocity = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Floating bobbing motion
      robotGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.1;

      // Subtle breath tilt
      robotGroup.rotation.y = Math.sin(elapsedTime * 0.8) * 0.15 + spinVelocity;
      robotGroup.rotation.x = Math.cos(elapsedTime * 1.1) * 0.05;

      // Orbiting moonlet along the tilted ring
      const orbitAngle = elapsedTime * 2.5;
      moonlet.position.x = Math.cos(orbitAngle) * 1.25;
      moonlet.position.y = Math.sin(orbitAngle) * 0.4;
      moonlet.position.z = Math.sin(orbitAngle) * 1.0;

      // Antenna pulsing glow
      const pulse = Math.sin(elapsedTime * 4.0) * 0.5 + 1.2;
      tipMat.emissiveIntensity = isCelebrating ? 3.0 : pulse;

      // Mood effects
      if (mood === 'thinking') {
        visorMat.emissiveIntensity = 0.3 + Math.sin(elapsedTime * 6.0) * 0.4;
        eyeMat.color.setHex(0xffd740);
      } else if (isCelebrating) {
        visorMat.emissiveIntensity = 1.2;
        eyeMat.color.setHex(0x69f0ae);
        robotGroup.position.y = Math.sin(elapsedTime * 6.0) * 0.2;
      } else {
        visorMat.emissiveIntensity = 0.6;
        eyeMat.color.setHex(0x00e5ff);
      }

      // Spin dampening after poke/click
      if (spinVelocity > 0.01) {
        spinVelocity *= 0.94;
      } else {
        spinVelocity = 0;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handlePointerDown = () => {
      spinVelocity = Math.PI * 0.8;
      const tips = [
        "Orbit-1 online! Be specific with your AI goals! 🚀",
        "Add context and constraints for crystal-clear results! 🎯",
        "Always verify unexpected facts before sharing! 🔍",
        "Great progress, cosmic explorer! ⭐",
      ];
      setSpeechMessage(tips[Math.floor(Math.random() * tips.length)]);
      setShowSpeech(true);
      setTimeout(() => setShowSpeech(false), 4500);
      if (onClick) onClick();
    };

    container.addEventListener('pointerdown', handlePointerDown);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('pointerdown', handlePointerDown);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      headGeo.dispose();
      headMat.dispose();
      visorGeo.dispose();
      visorMat.dispose();
      eyeGeo.dispose();
      eyeMat.dispose();
      stemGeo.dispose();
      stemMat.dispose();
      tipGeo.dispose();
      tipMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      moonletGeo.dispose();
      moonletMat.dispose();
    };
  }, [mood, size, prefersReducedMotion, isCelebrating, onClick]);

  const handle2DPoke = () => {
    const tips = [
      "Orbit-1 online! Be specific with your AI goals! 🚀",
      "Add context and constraints for crystal-clear results! 🎯",
      "Always verify unexpected facts before sharing! 🔍",
      "Great progress, cosmic explorer! ⭐",
    ];
    setSpeechMessage(tips[Math.floor(Math.random() * tips.length)]);
    setShowSpeech(true);
    setTimeout(() => setShowSpeech(false), 4500);
    if (onClick) onClick();
  };

  return (
    <div
      className={`companion-robot-wrapper ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      title="Orbit-1: Your Cosmic AI Companion (Click to interact)"
    >
      {/* Speech Bubble */}
      {showSpeech && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            bottom: '100%',
            marginBottom: 8,
            background: 'rgba(17, 22, 64, 0.95)',
            border: '1px solid var(--accent-primary)',
            color: 'var(--text-primary)',
            padding: '8px 12px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            lineHeight: 1.3,
            maxWidth: 220,
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0, 229, 255, 0.3)',
            zIndex: 50,
            pointerEvents: 'none',
            whiteSpace: 'normal',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {speechMessage}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--accent-primary)',
            }}
          />
        </div>
      )}

      {/* 3D Canvas Mount or 2D Accessible Fallback */}
      {webglSupported ? (
        <div
          ref={mountRef}
          style={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      ) : (
        /* Accessible 2D Fallback for no-WebGL or prefers-reduced-motion */
        <div
          onClick={handle2DPoke}
          style={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
          aria-label="Orbit-1 Companion Robot"
        >
          <svg width={size * 0.85} height={size * 0.85} viewBox="0 0 100 100">
            {/* Outer Orbit Ring */}
            <ellipse cx="50" cy="50" rx="42" ry="18" fill="none" stroke="#7c4dff" strokeWidth="2" opacity="0.6" transform="rotate(-20 50 50)" />
            <circle cx="16" cy="38" r="4" fill="#ffd740" />
            {/* Robot Head */}
            <circle cx="50" cy="52" r="32" fill="#141a45" stroke="#00e5ff" strokeWidth="2" />
            {/* Antenna */}
            <line x1="50" y1="20" x2="50" y2="10" stroke="#7c4dff" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="8" r="5" fill="#64ffda" />
            {/* Visor */}
            <rect x="26" y="44" width="48" height="18" rx="9" fill="#001025" stroke="#00e5ff" strokeWidth="1.5" />
            {/* Eyes */}
            <rect x="34" y="49" width="12" height="7" rx="3.5" fill={isCelebrating ? '#69f0ae' : '#00e5ff'} />
            <rect x="54" y="49" width="12" height="7" rx="3.5" fill={isCelebrating ? '#69f0ae' : '#00e5ff'} />
          </svg>
        </div>
      )}
    </div>
  );
};

export default CompanionRobot;
