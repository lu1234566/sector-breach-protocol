// @ts-nocheck
import * as THREE from 'three';

/**
 * Procedural Texture Generator for Tactical 3D Pass
 * Provides fallbacks since tool generation hit quota.
 */
export const createTacticalFloorTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base Plate
  ctx.fillStyle = '#1e293b'; // Slate 800
  ctx.fillRect(0, 0, 512, 512);

  // Panel Lines
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 512, 512);
  
  // Secondary Lines
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 256); ctx.lineTo(512, 256);
  ctx.moveTo(256, 0); ctx.lineTo(256, 512);
  ctx.stroke();

  // Corner Screws/Details
  ctx.fillStyle = '#020617';
  [ [40, 40], [472, 40], [40, 472], [472, 472] ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Subtle Cyan Tech Accent
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 472, 472);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
};

export const createTacticalWallTexture = (alt = false) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base
  ctx.fillStyle = alt ? '#0f172a' : '#1a202c';
  ctx.fillRect(0, 0, 512, 512);

  // Bevel Look
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 502);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.strokeRect(15, 15, 482, 482);

  // Technical Lines
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 40]);
  ctx.beginPath();
  ctx.moveTo(0, 100); ctx.lineTo(512, 100);
  ctx.moveTo(0, 412); ctx.lineTo(512, 412);
  ctx.stroke();

  // Rivets
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
       ctx.beginPath();
       ctx.arc(64 + i * 128, 64 + j * 128, 4, 0, Math.PI * 2);
       ctx.fill();
    }
  }

  return new THREE.CanvasTexture(canvas);
};

export const createTacticalCrateTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
  
    // Base Box
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);
  
    // Reinforced Edges
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 40);
    ctx.fillRect(0, 472, 512, 40);
    ctx.fillRect(0, 0, 40, 512);
    ctx.fillRect(472, 0, 40, 512);
    
    // Warning Stripes (Small corner)
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(400, 40); ctx.lineTo(440, 40); ctx.lineTo(472, 72); ctx.lineTo(472, 112); ctx.fill();
  
    return new THREE.CanvasTexture(canvas);
};

export const createTacticalBarrelTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
  
    // Base Steel
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);
  
    // Hazard Band
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 180, 512, 152);
    
    // Stripes over band
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 60, 180);
        ctx.lineTo(i * 60 + 30, 180);
        ctx.lineTo(i * 60 + 60, 332);
        ctx.lineTo(i * 60 + 30, 332);
        ctx.fill();
    }
  
    return new THREE.CanvasTexture(canvas);
};

export const createPickupTexture = (type: 'health' | 'ammo') => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 128);
  
  if (type === 'health') {
    // Medical Cross Style
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(54, 20, 20, 88);
    ctx.fillRect(20, 54, 88, 20);
    
    // Outer Frame
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 108, 108);
  } else {
    // Ammo / Bullet Icon
    ctx.fillStyle = '#fbbf24';
    // Three bullet silhouettes
    [32, 64, 96].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x - 10, 100);
      ctx.lineTo(x + 10, 100);
      ctx.lineTo(x + 10, 40);
      ctx.quadraticCurveTo(x, 10, x - 10, 40);
      ctx.closePath();
      ctx.fill();
    });
  }

  return new THREE.CanvasTexture(canvas);
};

export const createEnemyEmblemTexture = (type: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 128);
  ctx.lineWidth = 12;
  
  if (type === 'rusher') {
    ctx.strokeStyle = '#ff3434';
    ctx.beginPath();
    ctx.moveTo(20, 20); ctx.lineTo(108, 64); ctx.lineTo(20, 108); ctx.lineTo(40, 64); ctx.closePath();
    ctx.stroke();
  } else if (type === 'rifleman') {
    ctx.strokeStyle = '#eab308';
    ctx.strokeRect(30, 30, 68, 68);
    ctx.strokeRect(50, 50, 28, 28);
  } else if (type === 'sniper') {
    ctx.strokeStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(64, 64, 40, 0, Math.PI * 2);
    ctx.moveTo(20, 64); ctx.lineTo(108, 64);
    ctx.moveTo(64, 20); ctx.lineTo(64, 108);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(64, 20); ctx.lineTo(108, 40); ctx.lineTo(108, 88); ctx.lineTo(64, 108); ctx.lineTo(20, 88); ctx.lineTo(20, 40); ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(54, 54, 20, 20);
  }

  return new THREE.CanvasTexture(canvas);
};