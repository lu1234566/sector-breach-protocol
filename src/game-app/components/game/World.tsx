// @ts-nocheck
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { ASSETS } from '../../game/assets';

interface MapProps {
  mapData: number[][];
  cellSize: number;
}

function configureTexture(texture: THREE.Texture, repeatX = 1, repeatY = 1) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function World({ mapData, cellSize }: MapProps) {
  const textureMap = useTexture({
    floor: ASSETS.textures.floor,
    wall: ASSETS.textures.wall,
    wallAlt: ASSETS.textures.wallAlt,
    crate: ASSETS.textures.crate,
    barrel: ASSETS.textures.barrel,
    sectorDecal: ASSETS.decals.sector,
    warningDecal: ASSETS.decals.warning,
  });

  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  const textures = useMemo(() => {
    configureTexture(textureMap.floor, mapData[0].length / 2, mapData.length / 2);
    configureTexture(textureMap.wall, 1, 1);
    configureTexture(textureMap.wallAlt, 1, 1);
    configureTexture(textureMap.crate, 1, 1);
    configureTexture(textureMap.barrel, 1, 1);
    configureTexture(textureMap.sectorDecal, 1, 1);
    configureTexture(textureMap.warningDecal, 1, 1);
    return textureMap;
  }, [textureMap, mapData]);

  const wallMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    map: textures.wall,
    roughness: 0.78,
    metalness: 0.18,
  }), [textures.wall]);

  const wallAltMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    map: textures.wallAlt,
    roughness: 0.78,
    metalness: 0.18,
  }), [textures.wallAlt]);

  const wallTrimMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#164e63',
    emissive: '#0891b2',
    emissiveIntensity: 0.14,
    metalness: 0.35,
    roughness: 0.55,
  }), []);

  const floorMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#dbeafe',
    map: textures.floor,
    metalness: 0.08,
    roughness: 0.9,
  }), [textures.floor]);

  const crateMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    map: textures.crate,
    metalness: 0.2,
    roughness: 0.68,
  }), [textures.crate]);

  const barrelMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    map: textures.barrel,
    metalness: 0.32,
    roughness: 0.56,
  }), [textures.barrel]);

  const barrelEnergyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: '#f97316',
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0.1,
  }), []);

  const frameMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.42,
    roughness: 0.5,
  }), []);

  const warningMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    emissive: '#f59e0b',
    emissiveIntensity: 0.08,
    roughness: 0.5,
    metalness: 0.2,
  }), []);

  const sectorDecalMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: textures.sectorDecal,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [textures.sectorDecal]);

  const warningDecalMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: textures.warningDecal,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [textures.warningDecal]);

  const cells = useMemo(() => {
    const geometry: React.ReactNode[] = [];
    const decalGeometry: React.ReactNode[] = [];

    mapData.forEach((row, y) => {
      row.forEach((cell, x) => {
        const posX = x * cellSize + cellSize / 2;
        const posZ = y * cellSize + cellSize / 2;

        if (cell === 0 && x > 1 && y > 1 && x < row.length - 2 && y < mapData.length - 2) {
          if ((x + y) % 11 === 0) {
            decalGeometry.push(
              <mesh key={`sector-decal-${x}-${y}`} rotation={[-Math.PI / 2, 0, ((x + y) % 4) * Math.PI / 2]} position={[posX, 0.018, posZ]} material={sectorDecalMaterial}>
                <planeGeometry args={[cellSize * 0.72, cellSize * 0.72]} />
              </mesh>
            );
          } else if ((x * 3 + y) % 17 === 0) {
            decalGeometry.push(
              <mesh key={`warning-decal-${x}-${y}`} rotation={[-Math.PI / 2, 0, x % 2 ? Math.PI / 2 : 0]} position={[posX, 0.02, posZ]} material={warningDecalMaterial}>
                <planeGeometry args={[cellSize * 0.82, cellSize * 0.34]} />
              </mesh>
            );
          }
        }

        if (cell === 1) {
          const material = (x + y) % 2 === 0 ? wallMaterial : wallAltMaterial;
          geometry.push(
            <group key={`wall-${x}-${y}`} position={[posX, cellSize / 2, posZ]}>
              <mesh receiveShadow material={material}>
                <boxGeometry args={[cellSize * 0.98, cellSize, cellSize * 0.98]} />
              </mesh>
              <mesh position={[0, cellSize * 0.34, cellSize * 0.506]} material={wallTrimMaterial}>
                <boxGeometry args={[cellSize * 0.48, 0.024, 0.02]} />
              </mesh>
            </group>
          );
        } else if (cell === 2) {
          geometry.push(
            <group key={`crate-${x}-${y}`} position={[posX, cellSize * 0.38, posZ]}>
              <mesh receiveShadow material={crateMaterial}>
                <boxGeometry args={[cellSize * 0.78, cellSize * 0.74, cellSize * 0.78]} />
              </mesh>
              <mesh position={[0, cellSize * 0.39, 0]} material={frameMaterial}>
                <boxGeometry args={[cellSize * 0.82, 0.06, cellSize * 0.82]} />
              </mesh>
              <mesh position={[0, 0, cellSize * 0.398]} material={warningMaterial}>
                <boxGeometry args={[cellSize * 0.42, cellSize * 0.075, 0.012]} />
              </mesh>
            </group>
          );
        } else if (cell === 3) {
          geometry.push(
            <group key={`barrel-${x}-${y}`} position={[posX, cellSize * 0.34, posZ]}>
              <mesh material={barrelMaterial}>
                <cylinderGeometry args={[cellSize * 0.26, cellSize * 0.26, cellSize * 0.68, 12]} />
              </mesh>
              <mesh position={[0, 0, cellSize * 0.265]} material={barrelEnergyMaterial}>
                <boxGeometry args={[cellSize * 0.15, cellSize * 0.42, 0.018]} />
              </mesh>
            </group>
          );
        }
      });
    });

    return [...decalGeometry, ...geometry];
  }, [mapData, cellSize, wallMaterial, wallAltMaterial, wallTrimMaterial, barrelMaterial, barrelEnergyMaterial, crateMaterial, frameMaterial, warningMaterial, sectorDecalMaterial, warningDecalMaterial]);

  return (
    <group position={[-mapWidth / 2, 0, -mapHeight / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[mapWidth / 2, -0.01, mapHeight / 2]} receiveShadow material={floorMaterial}>
        <planeGeometry args={[mapWidth, mapHeight]} />
      </mesh>

      <group position={[mapWidth / 2, 0.004, mapHeight / 2]}>
        <gridHelper args={[Math.max(mapWidth, mapHeight), 18, 0x334155, 0x1e293b]} />
      </group>

      {cells}
    </group>
  );
}