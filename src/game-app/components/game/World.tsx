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
const NEON_DANGER = '#ef4444';
const NEON_PURPLE = '#a855f7';

// Deterministic 0..1 hash from cell coords + salt
const h = (x: number, y: number, salt = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

const isWall = (c?: number) => c === 1; // visual occluder

export function World({ mapData, cellSize }: MapProps) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  /* ----------------------------- Materials ----------------------------- */
  const mats = useMemo(
    () => ({
      wallDark: new THREE.MeshStandardMaterial({
        color: '#0d1422',
        metalness: 0.55,
        roughness: 0.55,
      }),
      wallMid: new THREE.MeshStandardMaterial({
        color: '#1a2335',
        metalness: 0.5,
        roughness: 0.55,
      }),
      panelA: new THREE.MeshStandardMaterial({
        color: '#222c44',
        metalness: 0.5,
        roughness: 0.55,
      }),
      panelB: new THREE.MeshStandardMaterial({
        color: '#1d2742',
        metalness: 0.55,
        roughness: 0.5,
      }),
      panelTrim: new THREE.MeshStandardMaterial({
        color: '#0a1020',
        metalness: 0.8,
        roughness: 0.3,
      }),
      neonCyan: new THREE.MeshStandardMaterial({
        color: NEON_CYAN,
        emissive: NEON_CYAN,
        emissiveIntensity: 1.6,
      }),
      neonCyanDim: new THREE.MeshStandardMaterial({
        color: NEON_CYAN,
        emissive: NEON_CYAN,
        emissiveIntensity: 0.8,
      }),
      neonMagenta: new THREE.MeshStandardMaterial({
        color: NEON_MAGENTA,
        emissive: NEON_MAGENTA,
        emissiveIntensity: 1.3,
      }),
      neonAmber: new THREE.MeshStandardMaterial({
        color: NEON_AMBER,
        emissive: NEON_AMBER,
        emissiveIntensity: 1.1,
      }),
      neonDanger: new THREE.MeshStandardMaterial({
        color: NEON_DANGER,
        emissive: NEON_DANGER,
        emissiveIntensity: 1.0,
      }),
      neonPurple: new THREE.MeshStandardMaterial({
        color: NEON_PURPLE,
        emissive: NEON_PURPLE,
        emissiveIntensity: 0.9,
      }),
      contamFloor: new THREE.MeshStandardMaterial({
        color: NEON_PURPLE,
        emissive: NEON_PURPLE,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      hazardFloor: new THREE.MeshStandardMaterial({
        color: NEON_AMBER,
        emissive: NEON_AMBER,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      pathFloor: new THREE.MeshStandardMaterial({
        color: NEON_CYAN,
        emissive: NEON_CYAN,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      dangerFloor: new THREE.MeshStandardMaterial({
        color: NEON_DANGER,
        emissive: NEON_DANGER,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      scuff: new THREE.MeshStandardMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      tilePlate: new THREE.MeshStandardMaterial({
        color: '#0f1726',
        metalness: 0.35,
        roughness: 0.8,
      }),
      tilePlateAlt: new THREE.MeshStandardMaterial({
        color: '#121a2d',
        metalness: 0.4,
        roughness: 0.75,
      }),
      floor: new THREE.MeshStandardMaterial({
        color: '#080c16',
        metalness: 0.3,
        roughness: 0.9,
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
      cable: new THREE.MeshStandardMaterial({
        color: '#0a0f1a',
        metalness: 0.4,
        roughness: 0.6,
      }),
      terminalBody: new THREE.MeshStandardMaterial({
        color: '#161e2f',
        metalness: 0.55,
        roughness: 0.45,
      }),
    }),
    [],
  );

  /* ----------------------------- Face decoration ----------------------------- */
  const wallFaceDecor = (x: number, y: number, faceSalt: number, accent: THREE.Material) => {
    const variant = Math.floor(h(x, y, faceSalt) * 4); // 0..3
    const ledSide = h(x, y, faceSalt + 1) > 0.5 ? 1 : -1;
    const items: React.ReactNode[] = [];

    // Inset panel (always)
    items.push(
      <mesh key="p" position={[0, 0, 0.005]} material={mats.panelA}>
        <planeGeometry args={[cellSize * 0.82, cellSize * 0.82]} />
      </mesh>,
    );
    // Top neon trim (always — gives skyline)
    items.push(
      <mesh key="t" position={[0, cellSize * 0.42, 0.012]} material={accent}>
        <planeGeometry args={[cellSize * 0.82, cellSize * 0.022]} />
      </mesh>,
    );
    // Horizontal seam
    items.push(
      <mesh key="s" position={[0, -cellSize * 0.05, 0.011]} material={mats.panelTrim}>
        <planeGeometry args={[cellSize * 0.82, cellSize * 0.015]} />
      </mesh>,
    );

    if (variant === 0) {
      // Centered indicator dot + corner LEDs
      items.push(
        <mesh
          key="led1"
          position={[ledSide * cellSize * 0.3, cellSize * 0.18, 0.015]}
          material={mats.neonCyanDim}
        >
          <circleGeometry args={[cellSize * 0.018, 10]} />
        </mesh>,
      );
      items.push(
        <mesh
          key="led2"
          position={[-ledSide * cellSize * 0.34, -cellSize * 0.28, 0.015]}
          material={mats.neonAmber}
        >
          <circleGeometry args={[cellSize * 0.012, 8]} />
        </mesh>,
      );
    } else if (variant === 1) {
      // Vertical hazard stripe (amber/black) on one side
      const side = ledSide;
      items.push(
        <mesh
          key="haz"
          position={[side * cellSize * 0.35, 0, 0.013]}
          material={mats.neonAmber}
        >
          <planeGeometry args={[cellSize * 0.045, cellSize * 0.62]} />
        </mesh>,
      );
      items.push(
        <mesh
          key="hazshadow"
          position={[side * cellSize * 0.3, 0, 0.012]}
          material={mats.panelTrim}
        >
          <planeGeometry args={[cellSize * 0.04, cellSize * 0.62]} />
        </mesh>,
      );
    } else if (variant === 2) {
      // Bottom red warning bar + corner LEDs
      items.push(
        <mesh
          key="warn"
          position={[0, -cellSize * 0.4, 0.013]}
          material={mats.neonDanger}
        >
          <planeGeometry args={[cellSize * 0.6, cellSize * 0.02]} />
        </mesh>,
      );
      items.push(
        <mesh
          key="ledc"
          position={[ledSide * cellSize * 0.36, cellSize * 0.32, 0.015]}
          material={mats.neonDanger}
        >
          <circleGeometry args={[cellSize * 0.016, 10]} />
        </mesh>,
      );
    } else {
      // Secondary inset panel (asymmetric)
      items.push(
        <mesh
          key="sub"
          position={[ledSide * cellSize * 0.22, cellSize * 0.05, 0.011]}
          material={mats.panelB}
        >
          <planeGeometry args={[cellSize * 0.32, cellSize * 0.5]} />
        </mesh>,
      );
      items.push(
        <mesh
          key="ledd"
          position={[ledSide * cellSize * 0.22, cellSize * 0.22, 0.016]}
          material={mats.neonCyan}
        >
          <planeGeometry args={[cellSize * 0.18, cellSize * 0.012]} />
        </mesh>,
      );
    }
    return items;
  };

  /* ----------------------------- Cells ----------------------------- */
  const cells = useMemo(() => {
    const out: React.ReactNode[] = [];
    const rows = mapData.length;
    const cols = mapData[0].length;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = mapData[y][x];
        const posX = x * cellSize + cellSize / 2;
        const posZ = y * cellSize + cellSize / 2;

        /* ---------- Floor decoration on open cells ---------- */
        if (cell === 0) {
          const r = h(x, y, 1);
          // Slight per-cell tile shade (no aligned grid lines — the offset makes it organic)
          if (r < 0.55) {
            const useAlt = h(x, y, 2) > 0.5;
            const off = (h(x, y, 3) - 0.5) * cellSize * 0.06;
            out.push(
              <mesh
                key={`tile-${x}-${y}`}
                position={[posX + off, 0.005, posZ - off]}
                rotation={[-Math.PI / 2, 0, 0]}
                material={useAlt ? mats.tilePlateAlt : mats.tilePlate}
              >
                <planeGeometry args={[cellSize * 0.92, cellSize * 0.92]} />
              </mesh>,
            );
          }

          // Sparse functional decals
          const d = h(x, y, 7);
          if (d < 0.05) {
            // Cyan path arrow (chevron)
            const rot = Math.floor(h(x, y, 8) * 4) * (Math.PI / 2);
            out.push(
              <group
                key={`arrow-${x}-${y}`}
                position={[posX, 0.015, posZ]}
                rotation={[-Math.PI / 2, 0, rot]}
              >
                <mesh
                  position={[0, cellSize * 0.05, 0]}
                  material={mats.pathFloor}
                >
                  <planeGeometry args={[cellSize * 0.32, cellSize * 0.05]} />
                </mesh>
                <mesh material={mats.pathFloor}>
                  <planeGeometry args={[cellSize * 0.42, cellSize * 0.05]} />
                </mesh>
                <mesh
                  position={[0, -cellSize * 0.05, 0]}
                  material={mats.pathFloor}
                >
                  <planeGeometry args={[cellSize * 0.32, cellSize * 0.05]} />
                </mesh>
              </group>,
            );
          } else if (d < 0.09) {
            // Sector ring + center dot
            out.push(
              <group key={`sec-${x}-${y}`} position={[posX, 0.012, posZ]}>
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  material={mats.hazardFloor}
                >
                  <ringGeometry args={[cellSize * 0.24, cellSize * 0.3, 28]} />
                </mesh>
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  material={mats.neonAmber}
                >
                  <circleGeometry args={[cellSize * 0.04, 16]} />
                </mesh>
              </group>,
            );
          } else if (d < 0.12) {
            // Purple contamination splotch
            out.push(
              <mesh
                key={`contam-${x}-${y}`}
                position={[posX, 0.011, posZ]}
                rotation={[-Math.PI / 2, 0, h(x, y, 9) * Math.PI]}
                material={mats.contamFloor}
              >
                <circleGeometry args={[cellSize * 0.38, 18]} />
              </mesh>,
            );
          } else if (d < 0.18) {
            // Scuff / wear mark
            out.push(
              <mesh
                key={`scuff-${x}-${y}`}
                position={[
                  posX + (h(x, y, 4) - 0.5) * cellSize * 0.3,
                  0.008,
                  posZ + (h(x, y, 5) - 0.5) * cellSize * 0.3,
                ]}
                rotation={[-Math.PI / 2, 0, h(x, y, 6) * Math.PI]}
                material={mats.scuff}
              >
                <planeGeometry args={[cellSize * 0.45, cellSize * 0.18]} />
              </mesh>,
            );
          } else if (d < 0.22) {
            // Hazard double stripe
            const rot = h(x, y, 10) > 0.5 ? 0 : Math.PI / 2;
            out.push(
              <group
                key={`stripe-${x}-${y}`}
                position={[posX, 0.012, posZ]}
                rotation={[-Math.PI / 2, 0, rot]}
              >
                <mesh
                  position={[0, cellSize * 0.07, 0]}
                  material={mats.hazardFloor}
                >
                  <planeGeometry args={[cellSize * 0.7, cellSize * 0.05]} />
                </mesh>
                <mesh
                  position={[0, -cellSize * 0.07, 0]}
                  material={mats.hazardFloor}
                >
                  <planeGeometry args={[cellSize * 0.7, cellSize * 0.05]} />
                </mesh>
              </group>,
            );
          }
        }

        /* ---------- Walls ---------- */
        if (cell === 1) {
          // Solid base box (full cell — preserves visual occlusion same as before)
          // Detect exposed faces (neighbors that are NOT walls get decorated)
          const faces = [
            {
              exposed: !isWall(mapData[y]?.[x + 1]),
              pos: [cellSize * 0.495, 0, 0],
              rot: [0, -Math.PI / 2, 0],
              salt: 11,
            },
            {
              exposed: !isWall(mapData[y]?.[x - 1]),
              pos: [-cellSize * 0.495, 0, 0],
              rot: [0, Math.PI / 2, 0],
              salt: 12,
            },
            {
              exposed: !isWall(mapData[y + 1]?.[x]),
              pos: [0, 0, cellSize * 0.495],
              rot: [0, 0, 0],
              salt: 13,
            },
            {
              exposed: !isWall(mapData[y - 1]?.[x]),
              pos: [0, 0, -cellSize * 0.495],
              rot: [0, Math.PI, 0],
              salt: 14,
            },
          ];
          const cellHash = h(x, y, 0);
          const accent =
            cellHash < 0.6 ? mats.neonCyan : cellHash < 0.85 ? mats.neonMagenta : mats.neonAmber;

          out.push(
            <group key={`wall-${x}-${y}`} position={[posX, cellSize / 2, posZ]}>
              <mesh material={mats.wallDark}>
                <boxGeometry args={[cellSize * 0.99, cellSize, cellSize * 0.99]} />
              </mesh>
              {/* Capstone strip on top */}
              <mesh position={[0, cellSize * 0.48, 0]} material={mats.wallMid}>
                <boxGeometry args={[cellSize * 1.02, cellSize * 0.06, cellSize * 1.02]} />
              </mesh>
              {faces.map((f, i) =>
                f.exposed ? (
                  <group key={i} position={f.pos as any} rotation={f.rot as any}>
                    {wallFaceDecor(x, y, f.salt, accent)}
                  </group>
                ) : null,
              )}
            </group>,
          );

          // Small wall-base light bollard against random exposed face (rare)
          if (h(x, y, 20) < 0.08) {
            const exposed = faces.find((f) => f.exposed);
            if (exposed) {
              const [fx, , fz] = exposed.pos as number[];
              const ox = posX + (fx / Math.abs(fx || 1)) * cellSize * 0.62 || posX;
              const oz = posZ + ((fz || 0) / Math.abs(fz || 1)) * cellSize * 0.62 || posZ;
              // Place against exposed face, slightly off-center
              const bx = posX + fx * 1.3;
              const bz = posZ + fz * 1.3;
              out.push(
                <group key={`bol-${x}-${y}`} position={[bx, cellSize * 0.12, bz]}>
                  <mesh material={mats.terminalBody}>
                    <cylinderGeometry args={[cellSize * 0.045, cellSize * 0.06, cellSize * 0.22, 8]} />
                  </mesh>
                  <mesh position={[0, cellSize * 0.12, 0]} material={mats.neonCyan}>
                    <cylinderGeometry args={[cellSize * 0.05, cellSize * 0.05, cellSize * 0.02, 10]} />
                  </mesh>
                </group>,
              );
            }
          }

          // Wall-mounted terminal (very rare)
          if (h(x, y, 21) < 0.04) {
            const exposed = faces.find((f) => f.exposed);
            if (exposed) {
              const [fx, , fz] = exposed.pos as number[];
              const tx = posX + fx * 1.08;
              const tz = posZ + fz * 1.08;
              out.push(
                <group
                  key={`term-${x}-${y}`}
                  position={[tx, cellSize * 0.42, tz]}
                  rotation={exposed.rot as any}
                >
                  <mesh material={mats.terminalBody}>
                    <boxGeometry args={[cellSize * 0.28, cellSize * 0.22, cellSize * 0.06]} />
                  </mesh>
                  <mesh position={[0, 0, cellSize * 0.035]} material={mats.neonCyan}>
                    <planeGeometry args={[cellSize * 0.2, cellSize * 0.14]} />
                  </mesh>
                  <mesh position={[0, -cellSize * 0.13, cellSize * 0.035]} material={mats.neonAmber}>
                    <planeGeometry args={[cellSize * 0.08, cellSize * 0.012]} />
                  </mesh>
                </group>,
              );
            }
          }
        } else if (cell === 2) {
          // Crate
          const variant = (x + y * 2) % 2;
          out.push(
            <group key={`crate-${x}-${y}`} position={[posX, cellSize * 0.32, posZ]}>
              <mesh material={mats.crateBody}>
                <boxGeometry args={[cellSize * 0.78, cellSize * 0.64, cellSize * 0.78]} />
              </mesh>
              <mesh position={[0, cellSize * 0.34, 0]} material={mats.crateTrim}>
                <boxGeometry args={[cellSize * 0.82, 0.05, cellSize * 0.82]} />
              </mesh>
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
          // Energy barrel
          out.push(
            <group key={`bar-${x}-${y}`} position={[posX, cellSize * 0.34, posZ]}>
              <mesh position={[0, -cellSize * 0.22, 0]} material={mats.barrelBody}>
                <cylinderGeometry args={[cellSize * 0.26, cellSize * 0.28, cellSize * 0.2, 14]} />
              </mesh>
              <mesh material={mats.neonAmber}>
                <cylinderGeometry args={[cellSize * 0.24, cellSize * 0.24, cellSize * 0.18, 14]} />
              </mesh>
              <mesh position={[0, cellSize * 0.22, 0]} material={mats.barrelBody}>
                <cylinderGeometry args={[cellSize * 0.28, cellSize * 0.26, cellSize * 0.2, 14]} />
              </mesh>
              <mesh position={[0, cellSize * 0.34, 0]} material={mats.neonCyan}>
                <cylinderGeometry args={[cellSize * 0.1, cellSize * 0.1, cellSize * 0.04, 12]} />
              </mesh>
              <pointLight color={NEON_AMBER} intensity={0.6} distance={cellSize * 2} />
            </group>,
          );
        }
      }
    }

    /* ----------------------------- Scattered ambient lights ----------------------------- */
    // ~6 lights deterministically chosen in open cells across the map.
    const lightSpots: { px: number; pz: number; color: string }[] = [];
    let lightAttempt = 0;
    while (lightSpots.length < 6 && lightAttempt < 60) {
      const cx = Math.floor(h(lightAttempt, 0, 30) * cols);
      const cy = Math.floor(h(0, lightAttempt, 31) * rows);
      if (mapData[cy]?.[cx] === 0) {
        const colorPick = h(cx, cy, 32);
        lightSpots.push({
          px: cx * cellSize + cellSize / 2,
          pz: cy * cellSize + cellSize / 2,
          color: colorPick < 0.55 ? NEON_CYAN : colorPick < 0.85 ? NEON_MAGENTA : NEON_PURPLE,
        });
      }
      lightAttempt++;
    }
    lightSpots.forEach((s, i) => {
      out.push(
        <pointLight
          key={`amb-${i}`}
          position={[s.px, cellSize * 0.9, s.pz]}
          color={s.color}
          intensity={0.55}
          distance={cellSize * 6}
        />,
      );
      // Tiny floor light disc to motivate the glow visually
      out.push(
        <mesh
          key={`amb-disc-${i}`}
          position={[s.px, 0.02, s.pz]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[cellSize * 0.06, cellSize * 0.1, 18]} />
          <meshStandardMaterial
            color={s.color}
            emissive={s.color}
            emissiveIntensity={1.2}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>,
      );
    });

    return out;
  }, [mapData, cellSize, mats]);

  /* ----------------------------- Final scene ----------------------------- */
  return (
    <group position={[-mapWidth / 2, 0, -mapHeight / 2]}>
      {/* Base floor — single dark plane (no grid lines) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[mapWidth / 2, -0.01, mapHeight / 2]}
        receiveShadow
        material={mats.floor}
      >
        <planeGeometry args={[mapWidth, mapHeight]} />
      </mesh>

      {/* Arena-wide accent lights */}
      <pointLight
        color={NEON_CYAN}
        intensity={0.9}
        distance={mapWidth * 0.7}
        position={[mapWidth * 0.5, cellSize * 1.6, mapHeight * 0.5]}
      />
      <pointLight
        color={NEON_MAGENTA}
        intensity={0.7}
        distance={mapWidth * 0.55}
        position={[mapWidth * 0.18, cellSize * 1.2, mapHeight * 0.18]}
      />
      <pointLight
        color={NEON_PURPLE}
        intensity={0.55}
        distance={mapWidth * 0.5}
        position={[mapWidth * 0.82, cellSize * 1.2, mapHeight * 0.82]}
      />

      {cells}
    </group>
  );
}
