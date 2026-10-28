/**
 * Procedural textures for the v2 shape library — canvas-drawn, no external
 * assets, fully offline. Mirrors the art direction of the legacy scenes.
 */
import { CanvasTexture, SRGBColorSpace } from 'three';

function noiseBlobs(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  colors: string[],
  rMin: number,
  rMax: number,
) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = rMin + Math.random() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = colors[Math.floor(Math.random() * colors.length)];
    g.addColorStop(0, c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Equirectangular planet surface (day side; Earth gets baked city lights). */
export function planetTexture(target: string): CanvasTexture {
  const w = 2048;
  const h = 1024;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const band = (colors: string[]) => {
    const step = h / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, i * step, w, step + 1);
    });
  };
  switch (target) {
    case 'mars': {
      band(['#8C3B1E', '#B3502B', '#C25E33', '#A9461F', '#8C3B1E', '#C26842']);
      noiseBlobs(ctx, w, h, 300, ['#7A3016', '#D98A5E', '#5E2410'], 8, 46);
      ctx.fillStyle = '#E8D9C8';
      ctx.fillRect(0, 0, w, 16);
      ctx.fillRect(0, h - 14, w, 14);
      break;
    }
    case 'jupiter': {
      band(['#C9A97A', '#E8DCC0', '#B58A5A', '#F0E6D2', '#A67848', '#DCC49C', '#8F6A40', '#E8DCC0']);
      ctx.fillStyle = '#B8543A';
      ctx.beginPath();
      ctx.ellipse(w * 0.62, h * 0.62, 90, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'europa': {
      band(['#E7EDF5', '#DDE7F2', '#EFF4FA', '#D5E1EF']);
      ctx.strokeStyle = 'rgba(150,100,70,0.5)';
      for (let i = 0; i < 240; i++) {
        ctx.beginPath();
        ctx.lineWidth = 1 + Math.random() * 2.5;
        const y = Math.random() * h;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 80, w * 0.7, y - (Math.random() - 0.5) * 80, w, y + (Math.random() - 0.5) * 40);
        ctx.stroke();
      }
      break;
    }
    case 'moon': {
      ctx.fillStyle = '#9A9A9E';
      ctx.fillRect(0, 0, w, h);
      noiseBlobs(ctx, w, h, 320, ['#7E7E84', '#B4B4B8', '#6E6E74'], 6, 40);
      break;
    }
    case 'venus': {
      band(['#E8C56A', '#DCB45C', '#F0D488', '#D4A94F', '#E8C56A', '#DFBB60']);
      noiseBlobs(ctx, w, h, 180, ['#F5DFA0', '#C99B3E', '#EFD07E'], 16, 80);
      break;
    }
    case 'eros': {
      ctx.fillStyle = '#8A836F';
      ctx.fillRect(0, 0, w, h);
      noiseBlobs(ctx, w, h, 360, ['#6E6857', '#A39B84', '#57523F'], 5, 34);
      break;
    }
    case 'titan': {
      band(['#D98E3D', '#E8A34C', '#C97F35', '#F0B45E', '#D2853A', '#E0963F']);
      noiseBlobs(ctx, w, h, 120, ['#B96F2C', '#F2C07A', '#A65F22'], 30, 120);
      break;
    }
    default: {
      // earth + leo/gto/geo
      band(['#0B2E5C', '#0E3A70', '#0B2E5C', '#0A2A52']);
      noiseBlobs(ctx, w, h, 210, ['#1E7A3C', '#2B8F4A', '#6B8F3A', '#1E6B38'], 14, 70);
      noiseBlobs(ctx, w, h, 84, ['#C9B27A', '#A89060'], 6, 26);
      ctx.fillStyle = '#EAF2FF';
      ctx.fillRect(0, 0, w, 14);
      ctx.fillRect(0, h - 12, w, 12);
      // city lights
      ctx.fillStyle = 'rgba(255,214,140,0.85)';
      for (let i = 0; i < 900; i++) {
        ctx.fillRect(Math.random() * w, h * 0.15 + Math.random() * h * 0.7, 1.6, 1.6);
      }
      break;
    }
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

/** Soft drifting cloud alpha map (Earth-like shells). */
export function cloudTexture(): CanvasTexture {
  const w = 1024;
  const h = 512;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * w;
    const y = h * 0.06 + Math.random() * h * 0.88;
    const r = 5 + Math.random() * 44;
    const a = 0.08 + Math.random() * 0.24;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`;
    ctx.fillRect(0, h * 0.1 + Math.random() * h * 0.8, w, 1 + Math.random() * 3);
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

/** Hex-line pattern used by the shield bubble (transparent background). */
export function hexTexture(cells = 14): CanvasTexture {
  const s = 512;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const ctx = cv.getContext('2d')!;
  const r = s / cells / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  const hStep = r * 1.5;
  const wStep = Math.sqrt(3) * r;
  for (let col = -1; col < cells + 2; col++) {
    for (let row = -1; row < cells + 2; row++) {
      const cx = col * wStep + (row % 2 ? wStep / 2 : 0);
      const cy = row * hStep;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = 1000; // RepeatWrapping
  return tex;
}
