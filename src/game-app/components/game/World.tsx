// @ts-nocheck
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useTexture } from "@react-three/drei";
import { PropModel } from "./PropModel";

const TEX_BASE = "/assets/textures";
const TEX_URLS = {
  wallA: `${TEX_BASE}/wall_blue.webp`,
  wallB: `${TEX_BASE}/wall_concrete.webp`,
  floorMain: `${TEX_BASE}/floor_concrete.webp`,
  floorAccent: `${TEX_BASE}/floor_rubber.webp`,
};

interface MapProps {
  mapData: number[][];
  cellSize: number;
  propsDensity?: number;
}

const NEON_CYAN = "#22d3ee";
const NEON_MAGENTA = "#e879f9";
const NEON_AMBER = "#fbbf24";
const NEON_DANGER = "#ef4444";
const NEON_PURPLE = "#a855f7";

// Deterministic 0..1 hash from cell coords + salt
const h = (x: number, y: number, salt = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

const isWall = (c?: number) => c === 1; // visual occluder

// World transform helper: bake a position+euler into a Matrix4.
const composeM = (px, py, pz, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(px, py, pz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  );

/**
 * Static arena geometry is merged per material: instead of ~800 individual
 * meshes (one per wall box, capstone, face panel, floor tile, decal…), every
 * piece that shares a material is baked into a single merged BufferGeometry =
 * one draw call. This is what cut Medium from ~830 draw calls to a couple of
 * dozen. GLB props and lights stay as separate nodes (they're few).
 */
export const World = React.memo(function World({ mapData, cellSize, propsDensity = 1 }: MapProps) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  const tex = useTexture(TEX_URLS) as Record<string, THREE.Texture>;
  useMemo(() => {
    for (const k of Object.keys(tex)) {
      const t = tex[k];
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (k.startsWith("floor")) t.repeat.set(mapWidth / 6, mapHeight / 6);
      else t.repeat.set(1.2, 1.2);
    }
  }, [tex, mapWidth, mapHeight]);

  /* ----------------------------- Materials ----------------------------- */
  const mats = useMemo(
    () => ({
      wallDark: new THREE.MeshStandardMaterial({
        color: "#e1e8f5",
        map: tex.wallA,
        metalness: 0.06,
        roughness: 0.82,
        emissive: "#9fb6da",
        emissiveMap: tex.wallA,
        emissiveIntensity: 0.42,
      }),
      wallMid: new THREE.MeshStandardMaterial({
        color: "#edf4ff",
        map: tex.wallA,
        metalness: 0.05,
        roughness: 0.78,
        emissive: "#a9c2e8",
        emissiveMap: tex.wallA,
        emissiveIntensity: 0.36,
      }),
      panelA: new THREE.MeshStandardMaterial({
        color: "#f0f6ff",
        map: tex.wallB,
        metalness: 0.04,
        roughness: 0.84,
        emissive: "#263a5f",
        emissiveIntensity: 0.2,
      }),
      panelB: new THREE.MeshStandardMaterial({
        color: "#dde8f7",
        map: tex.wallB,
        metalness: 0.05,
        roughness: 0.82,
        emissive: "#263a5f",
        emissiveIntensity: 0.18,
      }),
      panelTrim: new THREE.MeshStandardMaterial({
        color: "#0a1020",
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
      scuff: new THREE.MeshStandardMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      tilePlate: new THREE.MeshStandardMaterial({
        color: "#e2eaf6",
        map: tex.floorAccent,
        metalness: 0.04,
        roughness: 0.9,
        emissive: "#6f7f96",
        emissiveMap: tex.floorAccent,
        emissiveIntensity: 0.18,
      }),
      tilePlateAlt: new THREE.MeshStandardMaterial({
        color: "#d5e0ee",
        map: tex.floorAccent,
        metalness: 0.05,
        roughness: 0.88,
        emissive: "#5f7088",
        emissiveMap: tex.floorAccent,
        emissiveIntensity: 0.16,
      }),
      floor: new THREE.MeshStandardMaterial({
        color: "#d8e2f0",
        map: tex.floorMain,
        metalness: 0.03,
        roughness: 0.95,
        emissive: "#64758f",
        emissiveMap: tex.floorMain,
        emissiveIntensity: 0.16,
      }),
      terminalBody: new THREE.MeshStandardMaterial({
        color: "#161e2f",
        metalness: 0.55,
        roughness: 0.45,
      }),
    }),
    [tex],
  );

  /* ---------------- Build merged geometry + prop/light nodes ---------------- */
  const built = useMemo(() => {
    const buckets: Record<string, THREE.BufferGeometry[]> = {};
    const nodes: React.ReactNode[] = [];
    // Take ownership of geo, bake matrix, bucket by material key.
    const push = (key: string, geo: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
      geo.applyMatrix4(matrix);
      geo.deleteAttribute("uv2"); // keep attribute sets identical for merge
      (buckets[key] ||= []).push(geo);
    };

    // Wall-face decoration → pushes pieces using the face's world matrix.
    const wallFaceDecor = (
      x: number,
      y: number,
      faceSalt: number,
      accentKey: string,
      fm: THREE.Matrix4,
    ) => {
      const variant = Math.floor(h(x, y, faceSalt) * 4);
      const ledSide = h(x, y, faceSalt + 1) > 0.5 ? 1 : -1;
      const at = (lx, ly, lz, lrz = 0) => fm.clone().multiply(composeM(lx, ly, lz, 0, 0, lrz));

      push("panelA", new THREE.PlaneGeometry(cellSize * 0.82, cellSize * 0.82), at(0, 0, 0.005));
      push(
        accentKey,
        new THREE.PlaneGeometry(cellSize * 0.82, cellSize * 0.022),
        at(0, cellSize * 0.42, 0.012),
      );
      push(
        "panelTrim",
        new THREE.PlaneGeometry(cellSize * 0.82, cellSize * 0.015),
        at(0, -cellSize * 0.05, 0.011),
      );

      if (variant === 0) {
        push(
          "neonCyanDim",
          new THREE.CircleGeometry(cellSize * 0.018, 10),
          at(ledSide * cellSize * 0.3, cellSize * 0.18, 0.015),
        );
        push(
          "neonAmber",
          new THREE.CircleGeometry(cellSize * 0.012, 8),
          at(-ledSide * cellSize * 0.34, -cellSize * 0.28, 0.015),
        );
      } else if (variant === 1) {
        push(
          "neonAmber",
          new THREE.PlaneGeometry(cellSize * 0.045, cellSize * 0.62),
          at(ledSide * cellSize * 0.35, 0, 0.013),
        );
        push(
          "panelTrim",
          new THREE.PlaneGeometry(cellSize * 0.04, cellSize * 0.62),
          at(ledSide * cellSize * 0.3, 0, 0.012),
        );
      } else if (variant === 2) {
        push(
          "neonDanger",
          new THREE.PlaneGeometry(cellSize * 0.6, cellSize * 0.02),
          at(0, -cellSize * 0.4, 0.013),
        );
        push(
          "neonDanger",
          new THREE.CircleGeometry(cellSize * 0.016, 10),
          at(ledSide * cellSize * 0.36, cellSize * 0.32, 0.015),
        );
      } else {
        push(
          "panelB",
          new THREE.PlaneGeometry(cellSize * 0.32, cellSize * 0.5),
          at(ledSide * cellSize * 0.22, cellSize * 0.05, 0.011),
        );
        push(
          "neonCyan",
          new THREE.PlaneGeometry(cellSize * 0.18, cellSize * 0.012),
          at(ledSide * cellSize * 0.22, cellSize * 0.22, 0.016),
        );
      }
    };

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
          if (r < 0.55) {
            const useAlt = h(x, y, 2) > 0.5;
            const off = (h(x, y, 3) - 0.5) * cellSize * 0.06;
            push(
              useAlt ? "tilePlateAlt" : "tilePlate",
              new THREE.PlaneGeometry(cellSize * 0.92, cellSize * 0.92),
              composeM(posX + off, 0.005, posZ - off, -Math.PI / 2, 0, 0),
            );
          }

          const d = h(x, y, 7);
          if (d < 0.05) {
            const rot = Math.floor(h(x, y, 8) * 4) * (Math.PI / 2);
            const gm = composeM(posX, 0.015, posZ, -Math.PI / 2, 0, rot);
            push(
              "pathFloor",
              new THREE.PlaneGeometry(cellSize * 0.32, cellSize * 0.05),
              gm.clone().multiply(composeM(0, cellSize * 0.05, 0)),
            );
            push(
              "pathFloor",
              new THREE.PlaneGeometry(cellSize * 0.42, cellSize * 0.05),
              gm.clone(),
            );
            push(
              "pathFloor",
              new THREE.PlaneGeometry(cellSize * 0.32, cellSize * 0.05),
              gm.clone().multiply(composeM(0, -cellSize * 0.05, 0)),
            );
          } else if (d < 0.09) {
            const gm = composeM(posX, 0.012, posZ).multiply(composeM(0, 0, 0, -Math.PI / 2, 0, 0));
            push(
              "hazardFloor",
              new THREE.RingGeometry(cellSize * 0.24, cellSize * 0.3, 28),
              gm.clone(),
            );
            push("neonAmber", new THREE.CircleGeometry(cellSize * 0.04, 16), gm.clone());
          } else if (d < 0.12) {
            push(
              "contamFloor",
              new THREE.CircleGeometry(cellSize * 0.38, 18),
              composeM(posX, 0.011, posZ, -Math.PI / 2, 0, h(x, y, 9) * Math.PI),
            );
          } else if (d < 0.18) {
            push(
              "scuff",
              new THREE.PlaneGeometry(cellSize * 0.45, cellSize * 0.18),
              composeM(
                posX + (h(x, y, 4) - 0.5) * cellSize * 0.3,
                0.008,
                posZ + (h(x, y, 5) - 0.5) * cellSize * 0.3,
                -Math.PI / 2,
                0,
                h(x, y, 6) * Math.PI,
              ),
            );
          } else if (d < 0.22) {
            const rot = h(x, y, 10) > 0.5 ? 0 : Math.PI / 2;
            const gm = composeM(posX, 0.012, posZ, -Math.PI / 2, 0, rot);
            push(
              "hazardFloor",
              new THREE.PlaneGeometry(cellSize * 0.7, cellSize * 0.05),
              gm.clone().multiply(composeM(0, cellSize * 0.07, 0)),
            );
            push(
              "hazardFloor",
              new THREE.PlaneGeometry(cellSize * 0.7, cellSize * 0.05),
              gm.clone().multiply(composeM(0, -cellSize * 0.07, 0)),
            );
          }
        }

        /* ---------- Walls ---------- */
        if (cell === 1) {
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
          const accentKey =
            cellHash < 0.6 ? "neonCyan" : cellHash < 0.85 ? "neonMagenta" : "neonAmber";

          // Base box + capstone
          push(
            "wallDark",
            new THREE.BoxGeometry(cellSize * 0.99, cellSize, cellSize * 0.99),
            composeM(posX, cellSize / 2, posZ),
          );
          push(
            "wallMid",
            new THREE.BoxGeometry(cellSize * 1.02, cellSize * 0.06, cellSize * 1.02),
            composeM(posX, cellSize / 2 + cellSize * 0.48, posZ),
          );

          const wallM = composeM(posX, cellSize / 2, posZ);
          faces.forEach((f) => {
            if (!f.exposed) return;
            const fm = wallM
              .clone()
              .multiply(composeM(f.pos[0], f.pos[1], f.pos[2], f.rot[0], f.rot[1], f.rot[2]));
            wallFaceDecor(x, y, f.salt, accentKey, fm);
          });

          // Wall-base bollard (rare) — kept as a node (procedural, low count).
          if (h(x, y, 20) < 0.08 * propsDensity) {
            const exposed = faces.find((f) => f.exposed);
            if (exposed) {
              const [fx, , fz] = exposed.pos as number[];
              const bx = posX + fx * 1.3;
              const bz = posZ + fz * 1.3;
              nodes.push(
                <group key={`bol-${x}-${y}`} position={[bx, cellSize * 0.12, bz]}>
                  <mesh material={mats.terminalBody}>
                    <cylinderGeometry
                      args={[cellSize * 0.045, cellSize * 0.06, cellSize * 0.22, 8]}
                    />
                  </mesh>
                  <mesh position={[0, cellSize * 0.12, 0]} material={mats.neonCyan}>
                    <cylinderGeometry
                      args={[cellSize * 0.05, cellSize * 0.05, cellSize * 0.02, 10]}
                    />
                  </mesh>
                </group>,
              );
            }
          }

          // Wall-mounted terminal (GLB, rare)
          if (h(x, y, 21) < 0.05 * propsDensity) {
            const exposed = faces.find((f) => f.exposed);
            if (exposed) {
              const [fx, , fz] = exposed.pos as number[];
              nodes.push(
                <group
                  key={`term-${x}-${y}`}
                  position={[posX + fx * 0.6, 0, posZ + fz * 0.6]}
                  rotation={exposed.rot as any}
                >
                  <PropModel
                    modelKey="terminal"
                    cellSize={cellSize}
                    accentColor={NEON_CYAN}
                    flicker
                    emissiveBoost={0.25}
                  />
                </group>,
              );
            }
          }

          // Decorative wall panel (GLB)
          if (h(x, y, 22) < 0.18 * propsDensity) {
            const exposed = faces.find((f) => f.exposed);
            if (exposed) {
              const [fx, , fz] = exposed.pos as number[];
              nodes.push(
                <group
                  key={`wp-${x}-${y}`}
                  position={[posX + fx * 0.96, cellSize * 0.5, posZ + fz * 0.96]}
                  rotation={exposed.rot as any}
                >
                  <PropModel
                    modelKey="wallPanel"
                    cellSize={cellSize}
                    accentColor={NEON_CYAN}
                    emissiveBoost={0.18}
                    noFloorSnap
                  />
                </group>,
              );
            }
          }
        } else if (cell === 2) {
          nodes.push(
            <group key={`crate-${x}-${y}`} position={[posX, 0, posZ]}>
              <PropModel
                modelKey="crate"
                cellSize={cellSize}
                accentColor="#fbbf24"
                emissiveBoost={0.1}
              />
            </group>,
          );
        } else if (cell === 3) {
          nodes.push(
            <group key={`bar-${x}-${y}`} position={[posX, 0, posZ]}>
              <PropModel
                modelKey="barrel"
                cellSize={cellSize}
                accentColor={NEON_CYAN}
                pulse
                emissiveBoost={0}
                emissiveBase={0.08}
              />
            </group>,
          );
        }
      }
    }

    /* ----------------------------- Ambient lights ----------------------------- */
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
      nodes.push(
        <pointLight
          key={`amb-${i}`}
          position={[s.px, cellSize * 0.9, s.pz]}
          color={s.color}
          intensity={0.55}
          distance={cellSize * 6}
        />,
      );
      nodes.push(
        <mesh key={`amb-disc-${i}`} position={[s.px, 0.02, s.pz]} rotation={[-Math.PI / 2, 0, 0]}>
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

    /* ----------------------------- Merge per material ----------------------------- */
    const mergedMeshes: React.ReactNode[] = [];
    const mergedGeos: THREE.BufferGeometry[] = [];
    for (const key of Object.keys(buckets)) {
      const geos = buckets[key];
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (merged) {
        mergedGeos.push(merged);
        mergedMeshes.push(<mesh key={`m-${key}`} geometry={merged} material={mats[key]} />);
      }
    }

    return { mergedMeshes, nodes, mergedGeos };
  }, [mapData, cellSize, mats, propsDensity]);

  // Dispose merged geometries when the world rebuilds (arena change) or unmounts.
  const builtRef = useRef(built);
  builtRef.current = built;
  useEffect(() => {
    const geos = built.mergedGeos;
    return () => geos.forEach((g) => g.dispose());
  }, [built]);

  /* ----------------------------- Final scene ----------------------------- */
  return (
    <group position={[-mapWidth / 2, 0, -mapHeight / 2]}>
      {/* Base floor */}
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

      {built.mergedMeshes}
      {built.nodes}
    </group>
  );
});
