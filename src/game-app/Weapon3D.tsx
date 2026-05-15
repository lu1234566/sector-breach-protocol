// @ts-nocheck
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

export function Weapon3D({ type, isReloading, isAds, recoilOffset, lastShotTime }: { type: string, isReloading: boolean, isAds: boolean, recoilOffset: number, lastShotTime: number }) {
  return (
    <div style={{ position: 'absolute', bottom: 0, right: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} style={{ pointerEvents: 'none' }}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <WeaponModel type={type} isReloading={isReloading} isAds={isAds} recoilOffset={recoilOffset} lastShotTime={lastShotTime} />
      </Canvas>
    </div>
  );
}

export function WeaponModel({ type, isReloading, isAds, recoilOffset, lastShotTime }: { type: string, isReloading: boolean, isAds: boolean, recoilOffset: number, lastShotTime: number }) {
  const group = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const flashMeshRef = useRef<THREE.Mesh>(null);

  // Tactical Materials (Refined for Phase 3)
  const matBody = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#64748b', // Slate 400
    metalness: 0.4, 
    roughness: 0.6 
  }), []);
  
  const matDetail = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#1e293b', // Slate 800
    metalness: 0.7, 
    roughness: 0.3 
  }), []);

  const matGrip = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#0f172a', // Slate 900
    metalness: 0.1, 
    roughness: 0.9 
  }), []);

  const matCyan = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#22d3ee', 
    emissive: '#22d3ee', 
    emissiveIntensity: 0.8 
  }), []);

  const matYellow = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#f59e0b', 
    emissive: '#f59e0b', 
    emissiveIntensity: 0.6 
  }), []);
  
  useFrame((state, delta) => {
    if (group.current) {
      const t = state.clock.getElapsedTime();
      
      const targetX = isAds ? 0 : 0.9; // Moved slightly more to the left
      const targetY = isAds ? -0.4 : -1.2; 
      const targetZ = isAds ? 2.5 : 1.2;
      
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, targetX, 0.15);
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, targetY + Math.sin(t * 1.5) * 0.01, 0.1);
      group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, targetZ + recoilOffset * 0.4, 0.15);
      
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, recoilOffset * 0.2, 0.1);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, isAds ? 0 : -0.12, 0.1);
      
      if (isReloading) {
        group.current.rotation.x += delta * 6;
      }
    }

    if (flashRef.current && flashMeshRef.current) {
        const timeSinceShot = Date.now() - lastShotTime;
        if (timeSinceShot < 40 && !isReloading) {
            flashRef.current.intensity = 15;
            flashMeshRef.current.visible = true;
            flashMeshRef.current.scale.setScalar(0.6 + Math.random() * 0.4);
            flashMeshRef.current.rotation.z = Math.random() * Math.PI;
        } else {
            flashRef.current.intensity = 0;
            flashMeshRef.current.visible = false;
        }
    }
  });

  return (
    <group ref={group}>
      <pointLight ref={flashRef} color="#fb923c" intensity={0} distance={5} position={[0, 0.2, -2.5]} />
      <mesh ref={flashMeshRef} position={[0, 0.2, -2.4]} visible={false}>
          <boxGeometry args={[0.3, 0.3, 0.1]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
      </mesh>

      {type === 'pistol' && (
          <group scale={0.75}>
            {/* P-99 Tactical Chassis */}
            <mesh castShadow position={[0, 0.2, 0.2]} material={matBody}>
              <boxGeometry args={[0.18, 0.25, 0.9]} />
            </mesh>
            {/* Slide Top Section */}
            <mesh position={[0, 0.32, 0.2]} material={matDetail}>
              <boxGeometry args={[0.2, 0.05, 0.85]} />
            </mesh>
            {/* Lower Frame */}
            <mesh position={[0, 0.1, 0.3]} material={matBody}>
              <boxGeometry args={[0.16, 0.15, 0.7]} />
            </mesh>
            {/* Tactical Grip */}
            <mesh position={[0, -0.2, 0.5]} rotation={[-0.2, 0, 0]} material={matGrip}>
              <boxGeometry args={[0.18, 0.6, 0.25]} />
            </mesh>
            {/* Cyan Indicator */}
            <mesh position={[0.1, 0.25, 0.1]} material={matCyan}>
              <boxGeometry args={[0.02, 0.02, 0.3]} />
            </mesh>
            {/* Muzzle Barrel */}
            <mesh position={[0, 0.25, -0.35]} rotation={[Math.PI/2, 0, 0]} material={matDetail}>
              <cylinderGeometry args={[0.05, 0.05, 0.2, 12]} />
            </mesh>
          </group>
        )}

        {type === 'rifle' && (
          <group scale={0.8}>
            {/* M4-A1 Main Body */}
            <mesh castShadow position={[0, 0.3, 0.4]} material={matBody}>
              <boxGeometry args={[0.22, 0.35, 1.0]} />
            </mesh>
            {/* Tactical Handguard */}
            <mesh position={[0, 0.3, -0.6]} material={matGrip}>
              <boxGeometry args={[0.24, 0.24, 0.9]} />
            </mesh>
            {/* Rail System */}
            {[0.14, 0.3, 0.46].map(y => (
               <mesh key={y} position={[0, y, -0.6]} material={matDetail}>
                 <boxGeometry args={[0.1, 0.02, 0.8]} />
               </mesh>
            ))}
            {/* Receiver Detail */}
            <mesh position={[0, 0.5, 0.2]} material={matDetail}>
              <boxGeometry args={[0.18, 0.08, 0.5]} />
            </mesh>
            {/* Extruded Barrel */}
            <mesh position={[0, 0.3, -1.3]} rotation={[Math.PI/2, 0, 0]} material={matDetail}>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 12]} />
            </mesh>
            {/* Muzzle Brake */}
            <mesh position={[0, 0.3, -1.75]} rotation={[Math.PI/2, 0, 0]} material={matBody}>
              <cylinderGeometry args={[0.08, 0.08, 0.2, 6]} />
            </mesh>
            {/* Rear Stock */}
            <mesh position={[0, 0.3, 1.2]} material={matBody}>
              <boxGeometry args={[0.18, 0.4, 0.7]} />
            </mesh>
            {/* Straight Mag */}
            <mesh position={[0, -0.2, 0.1]} rotation={[0.15, 0, 0]} material={matGrip}>
              <boxGeometry args={[0.16, 0.7, 0.28]} />
            </mesh>
            {/* Yellow Tech Decal */}
            <mesh position={[0.12, 0.4, 0.4]} material={matYellow}>
              <planeGeometry args={[0.05, 0.05]} />
            </mesh>
          </group>
        )}

        {type === 'shotgun' && (
          <group scale={1.05}>
            {/* KRM-262 Heavy Chassis */}
            <mesh castShadow position={[0, 0.2, 0.3]} material={matBody}>
              <boxGeometry args={[0.35, 0.45, 0.9]} />
            </mesh>
            {/* Massive Double-Tube Barrel */}
            <mesh position={[0, 0.32, -0.8]} rotation={[Math.PI/2, 0, 0]} material={matDetail}>
              <cylinderGeometry args={[0.13, 0.13, 1.6, 12]} />
            </mesh>
            {/* Pump Action Handle */}
            <mesh position={[0, 0.12, -0.5]} material={matGrip}>
              <boxGeometry args={[0.3, 0.28, 0.6]} />
            </mesh>
            {/* Pump Grip Ribs */}
            {[0.12, 0, -0.12].map(z => (
               <mesh key={z} position={[0, 0, -0.5 + z]} material={matDetail}>
                 <boxGeometry args={[0.32, 0.3, 0.04]} />
               </mesh>
            ))}
            {/* Amber Status Glow */}
            <mesh position={[0.18, 0.4, 0.1]} material={matYellow}>
              <boxGeometry args={[0.02, 0.05, 0.1]} />
            </mesh>
            {/* Heavy-Duty Stock */}
            <mesh position={[0, 0.15, 1.0]} rotation={[-0.1, 0, 0]} material={matBody}>
              <boxGeometry args={[0.2, 0.5, 0.6]} />
            </mesh>
          </group>
        )}

        {type === 'sniper' && (
          <group scale={1.1}>
            {/* DL-Q33 Precision Frame */}
            <mesh castShadow position={[0, 0.25, 0.6]} material={matBody}>
              <boxGeometry args={[0.2, 0.4, 1.3]} />
            </mesh>
            {/* Lightweight Long Barrel */}
            <mesh position={[0, 0.32, -1.1]} rotation={[Math.PI/2, 0, 0]} material={matDetail}>
              <cylinderGeometry args={[0.035, 0.035, 3.0, 8]} />
            </mesh>
            {/* Heavy Muzzle Device */}
            <mesh position={[0, 0.32, -2.6]} rotation={[Math.PI/2, 0, 0]} material={matBody}>
               <boxGeometry args={[0.15, 0.15, 0.2]} />
            </mesh>
            {/* Optical Scope Unit */}
            <group position={[0, 0.58, 0.3]}>
              <mesh rotation={[Math.PI/2, 0, 0]} material={matDetail}>
                <cylinderGeometry args={[0.15, 0.15, 0.9, 16]} />
              </mesh>
              {/* Scope Lens */}
              <mesh position={[0, 0, -0.46]} rotation={[Math.PI/2, 0, 0]}>
                <circleGeometry args={[0.12]} />
                <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} />
              </mesh>
              {/* Cyan Housing Detail */}
              <mesh position={[0, 0, -0.47]} material={matCyan}>
                <torusGeometry args={[0.14, 0.005, 8, 32]} />
              </mesh>
            </group>
            {/* Integrated Bipod (Folded) */}
            <mesh position={[0, 0.1, -0.7]} material={matDetail}>
              <boxGeometry args={[0.22, 0.06, 0.4]} />
            </mesh>
            {/* Ergonomic Sniper Grip */}
            <mesh position={[0, -0.3, 0.9]} rotation={[-0.2, 0, 0]} material={matGrip}>
              <boxGeometry args={[0.16, 0.55, 0.2]} />
            </mesh>
          </group>
        )}
    </group>
  );
}