// @ts-nocheck
import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

function colorDistanceSq(a: number[], r: number, g: number, b: number) {
  const dr = a[0] - r;
  const dg = a[1] - g;
  const db = a[2] - b;
  return dr * dr + dg * dg + db * db;
}

function keyFor(r: number, g: number, b: number) {
  // Quantize enough to group checkerboard compression noise without eating object details.
  return `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`;
}

function isProbablyNeutralBackground(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 18 && max > 35 && max < 235;
}

function buildBackgroundPalette(data: Uint8ClampedArray, width: number, height: number) {
  const counts = new Map<string, number>();
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10 || isProbablyNeutralBackground(r, g, b)) {
      const key = keyFor(r, g, b);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  };

  const step = Math.max(1, Math.floor(Math.min(width, height) / 96));
  for (let x = 0; x < width; x += step) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    add(0, y);
    add(width - 1, y);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key]) => key.split(',').map(Number));
}

function removeConnectedCheckerboardBackground(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap) {
  const width = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const height = 'naturalHeight' in image ? image.naturalHeight : image.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image as CanvasImageSource, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const palette = buildBackgroundPalette(data, width, height);
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const thresholdSq = 34 * 34;

  const isBackground = (idx: number) => {
    const i = idx * 4;
    const a = data[i + 3];
    if (a < 16) return true;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return palette.some((p) => colorDistanceSq(p, r, g, b) < thresholdSq);
  };

  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx] || !isBackground(idx)) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const i = idx * 4;
    data[i + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function useEdgeTransparentTexture(path: string) {
  const sourceTexture = useTexture(path);

  return useMemo(() => {
    const image = sourceTexture.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
    if (!image) return sourceTexture;

    const cleanedCanvas = removeConnectedCheckerboardBackground(image);
    if (!cleanedCanvas) return sourceTexture;

    const texture = new THREE.CanvasTexture(cleanedCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }, [sourceTexture]);
}