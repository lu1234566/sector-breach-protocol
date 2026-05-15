// @ts-nocheck
import React, { useMemo } from 'react';
import * as THREE from 'three';

interface MapProps {
  mapData: number[][];
  cellSize: number;
}

const NEON_CYAN = '#22d3ee';
const NEON_MAGENTA = '#e879f9';
const NEON_AMBER = '#fbbf24';

export function World({ mapData, cellSize }: MapProps) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  /* ----------------------------- Materials ----------------------------- */
  const mats = useMemo(() => {
    return {
      wallDark: new THREE.MeshStandardMaterial({
        color: '#0f1626',
        metalness: 0.55,
        roughness: 0.55,
      }),
      wallMid: new THREE.MeshStandardMaterial({
        color: '#1e293b',
        metalness: 0.5,
        roughness: 0.6,
      }),
      panel: new THREE.MeshStandardMaterial({
        color: '#252e44',
        metalness: 0.45,
        roughness: 0.55,
      }),
      neonCyan: new THREE.MeshStandardMaterial({
        color: NEON_CYAN,
        emissive: NEON_CYAN,
        emissiveIntensity: 1.4,
      }),
      neonMagenta: new THREE.MeshStandardMaterial({
        color: NEON_MAGENTA,
        emissive: NEON_MAGENTA,
        emissiveIntensity: 1.2,
      }),
      neonAmber: new THREE.MeshStandardMaterial({
        color: NEON_AMBER,
        emissive: NEON_AMBER,
        emissiveIntensity: 1.0,
      }),
      neonHazard: new THREE.MeshStandardMaterial({
        color: NEON_MAGENTA,
        emissive: NEON_MAGENTA,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      floor: new THREE.MeshStandardMaterial({
        color: '#0a0f1a',
        metalness: 0.3,
        roughness: 0.85,
      }),
      crateBody: new THREE.MeshStandardMaterial({
        color: '#1a2236',
        metalness: 0.5,
        roughness: 0.55,
      }),
      crateTrim: new THREE.MeshStandardMaterial({
        color: '#0a0f1a',
        metalness: 0.7,
        roughness: 0.4,
      }),
      barrelBody: new THREE.MeshStandardMaterial({
        color: '#1a2236',
        metalness: 0.6,
        roughness: 0.4,
      }),
      pipe: new THREE.MeshStandardMaterial({
        color: '#0f1626',
        metalness: 0.6,
        roughness: 0.45,
      }),
    };
  }, []);

  /* ----------------------------- Geometry ----------------------------- */
  const cells = useMemo(() => {
    const out: React.ReactNode[] = [];

    mapData.forEach((row, y) => {
      row.forEach((cell, x) => {
        const posX = x * cellSize + cellSize / 2;
        const posZ = y * cellSize + cellSize / 2;

        // Hazard floor decals on open cells (deterministic pattern)
        if (cell === 0 && x > 0 && y > 0 && x < row.length - 1 && y < mapData.length - 1) {
          if ((x + y) % 13 === 0) {
            // Sector mark
            out.push(
              <mesh
                key={`sec-${x}-${y}`}
                position={[posX, 0.02, posZ]}
                rotation={[-Math.PI / 2, 0, ((x + y) % 4) * (Math.PI / 2)]}
                material={mats.neonHazard}
              >
                <ringGeometry args={[cellSize * 0.22, cellSize * 0.3, 24]} />
              </mesh>,
            );
          } else if ((x * 3 + y * 5) % 19 === 0) {
            // Hazard stripe
            out.push(
              <mesh
                key={`haz-${x}-${y}`}
                position={[posX, 0.02, posZ]}
                rotation={[-Math.PI / 2, 0, x % 2 ? Math.PI / 2 : 0]}
                material={mats.neonHazard}
              >
                <planeGeometry args={[cellSize * 0.7, cellSize * 0.18]} />
              </mesh>,
            );
          }
        }

        if (cell === 1) {
          // Wall module — central panel + frame + cyan top trim + magenta accent on alternating walls
          const isAlt = (x + y) % 2 === 0;
          const accent = isAlt ? mats.neonCyan : mats.neonMagenta;
          out.push(
            <group key={`wall-${x}-${y}`} position={[posX, cellSize / 2, posZ]}>
              {/* Outer frame (dark) */}
              <mesh material={mats.wallDark}>
                <boxGeometry args={[cellSize * 0.99, cellSize, cellSize * 0.99]} />
              </mesh>
              {/* Inset panel — slightly inset on all 4 vertical faces */}
              {[
                { rot: [0, 0, 0], pos: [0, 0, cellSize * 0.495] },
                { rot: [0, Math.PI, 0], pos: [0, 0, -cellSize * 0.495] },
                { rot: [0, Math.PI / 2, 0], pos: [cellSize * 0.495, 0, 0] },
                { rot: [0, -Math.PI / 2, 0], pos: [-cellSize * 0.495, 0, 0] },
              ].map((f, i) => (
                <group key={i} position={f.pos as any} rotation={f.rot as any}>
                  <mesh position={[0, 0, 0.005]} material={mats.panel}>
                    <planeGeometry args={[cellSize * 0.78, cellSize * 0.78]} />
                  </mesh>
                  {/* Top neon trim line */}
                  <mesh position={[0, cellSize * 0.4, 0.012]} material={accent}>
                    <planeGeometry args={[cellSize * 0.78, cellSize * 0.025]} />
                  </mesh>
                  {/* Bottom neon trim line */}
                  <mesh position={[0, -cellSize * 0.4, 0.012]} material={accent}>
                    <planeGeometry args={[cellSize * 0.78, cellSize * 0.012]} />
                  </mesh>
                  {/* Center vertical seam (dark) */}
                  <mesh position={[0, 0, 0.011]} material={mats.wallDark}>
                    <planeGeometry args={[cellSize * 0.04, cellSize * 0.78]} />
                  </mesh>
                </group>
              ))}
            </group>,
          );
        } else if (cell === 2) {
          // Crate (container)
          const variant = (x + y * 2) % 2;
          out.push(
            <group key={`crate-${x}-${y}`} position={[posX, cellSize * 0.32, posZ]}>
              <mesh material={mats.crateBody}>
                <boxGeometry args={[cellSize * 0.78, cellSize * 0.64, cellSize * 0.78]} />
              </mesh>
              {/* Trim frame on top */}
              <mesh position={[0, cellSize * 0.34, 0]} material={mats.crateTrim}>
                <boxGeometry args={[cellSize * 0.82, 0.05, cellSize * 0.82]} />
              </mesh>
              {/* Cyan/Amber stripes per variant */}
              <mesh
                position={[0, 0, cellSize * 0.395]}
                material={variant === 0 ? mats.neonCyan : mats.neonAmber}
              >
                <boxGeometry args={[cellSize * 0.5, cellSize * 0.04, 0.012]} />
              </mesh>
              <mesh
                position={[0, 0, -cellSize * 0.395]}
                material={variant === 0 ? mats.neonCyan : mats.neonAmber}
              >
                <boxGeometry args={[cellSize * 0.5, cellSize * 0.04, 0.012]} />
              </mesh>
              {/* Corner LEDs */}
              {[-1, 1].flatMap((dx) =>
                [-1, 1].map((dz) => (
                  <mesh
                    key={`${dx}-${dz}`}
                    position={[dx * cellSize * 0.36, cellSize * 0.31, dz * cellSize * 0.36]}
                    material={mats.neonCyan}
                  >
                    <sphereGeometry args={[0.04, 6, 6]} />
                  </mesh>
                )),
              )}
            </group>,
          );
        } else if (cell === 3) {
          // Energy barrel — segmented cylinder w/ amber core
          out.push(
            <group key={`bar-${x}-${y}`} position={[posX, cellSize * 0.34, posZ]}>
              {/* Bottom segment */}
              <mesh position={[0, -cellSize * 0.22, 0]} material={mats.barrelBody}>
                <cylinderGeometry args={[cellSize * 0.26, cellSize * 0.28, cellSize * 0.2, 14]} />
              </mesh>
              {/* Middle (amber glow) */}
              <mesh material={mats.neonAmber}>
                <cylinderGeometry args={[cellSize * 0.24, cellSize * 0.24, cellSize * 0.18, 14]} />
              </mesh>
              {/* Top segment */}
              <mesh position={[0, cellSize * 0.22, 0]} material={mats.barrelBody}>
                <cylinderGeometry args={[cellSize * 0.28, cellSize * 0.26, cellSize * 0.2, 14]} />
              </mesh>
              {/* Cyan top cap */}
              <mesh position={[0, cellSize * 0.34, 0]} material={mats.neonCyan}>
                <cylinderGeometry args={[cellSize * 0.1, cellSize * 0.1, cellSize * 0.04, 12]} />
              </mesh>
              {/* Amber point light */}
              <pointLight color={NEON_AMBER} intensity={0.6} distance={cellSize * 2} />
            </group>,
          );
        }
      });
    });

    return out;
  }, [mapData, cellSize, mats]);

  /* ----------------------------- Floor + grid ----------------------------- */
  return (
    <group position={[-mapWidth / 2, 0, -mapHeight / 2]}>
      {/* Solid floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[mapWidth / 2, -0.01, mapHeight / 2]}
        receiveShadow
        material={mats.floor}
      >
        <planeGeometry args={[mapWidth, mapHeight]} />
      </mesh>

      {/* Cyan grid overlay */}
      <group position={[mapWidth / 2, 0.005, mapHeight / 2]}>
        <gridHelper
          args={[Math.max(mapWidth, mapHeight), mapData[0].length, NEON_CYAN, '#1e293b']}
        />
      </group>

      {/* Magenta corner spot lights for arena ambience */}
      <pointLight
        color={NEON_MAGENTA}
        intensity={1.0}
        distance={mapWidth * 0.6}
        position={[mapWidth * 0.2, cellSize * 1.2, mapHeight * 0.2]}
      />
      <pointLight
        color={NEON_MAGENTA}
        intensity={1.0}
        distance={mapWidth * 0.6}
        position={[mapWidth * 0.8, cellSize * 1.2, mapHeight * 0.8]}
      />
      <pointLight
        color={NEON_CYAN}
        intensity={1.2}
        distance={mapWidth * 0.7}
        position={[mapWidth * 0.5, cellSize * 1.5, mapHeight * 0.5]}
      />

      {cells}
    </group>
  );
}
