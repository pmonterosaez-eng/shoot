import * as THREE from 'three';

export interface RetroTextureSet {
  techWall: THREE.CanvasTexture;
  techWallNormal: THREE.DataTexture;
  techWallRoughness: THREE.DataTexture;
  hellWall: THREE.CanvasTexture;
  hellWallNormal: THREE.DataTexture;
  hellWallRoughness: THREE.DataTexture;
  reactorWall: THREE.CanvasTexture;
  reactorWallNormal: THREE.DataTexture;
  reactorWallRoughness: THREE.DataTexture;
  rustWall: THREE.CanvasTexture;
  rustWallNormal: THREE.DataTexture;
  rustWallRoughness: THREE.DataTexture;
  obsidianWall: THREE.CanvasTexture;
  obsidianWallNormal: THREE.DataTexture;
  obsidianWallRoughness: THREE.DataTexture;
  cyberWall: THREE.CanvasTexture;
  cyberWallNormal: THREE.DataTexture;
  cyberWallRoughness: THREE.DataTexture;
  doorTech: THREE.CanvasTexture;
  doorTechNormal: THREE.DataTexture;
  doorTechRoughness: THREE.DataTexture;
  doorLocked: THREE.CanvasTexture;
  doorLockedNormal: THREE.DataTexture;
  floorGrate: THREE.CanvasTexture;
  floorGrateNormal: THREE.DataTexture;
  floorGrateRoughness: THREE.DataTexture;
  floorStone: THREE.CanvasTexture;
  floorStoneNormal: THREE.DataTexture;
  floorStoneRoughness: THREE.DataTexture;
  floorMetal: THREE.CanvasTexture;
  floorMetalNormal: THREE.DataTexture;
  floorMetalRoughness: THREE.DataTexture;
  floorObsidian: THREE.CanvasTexture;
  floorObsidianNormal: THREE.DataTexture;
  floorObsidianRoughness: THREE.DataTexture;
  ceilingTech: THREE.CanvasTexture;
  ceilingTechNormal: THREE.DataTexture;
  lavaFloor: THREE.CanvasTexture;
  lavaFloorNormal: THREE.DataTexture;
  acidFloor: THREE.CanvasTexture;
  acidFloorNormal: THREE.DataTexture;
  crateTex: THREE.CanvasTexture;
  crateNormal: THREE.DataTexture;
  crateRoughness: THREE.DataTexture;
  barrelTex: THREE.CanvasTexture;
  barrelNormal: THREE.DataTexture;
  barrelRoughness: THREE.DataTexture;
  pillarTex: THREE.CanvasTexture;
  pillarNormal: THREE.DataTexture;
  pillarRoughness: THREE.DataTexture;
  demonSkin: THREE.CanvasTexture;
  demonSkinNormal: THREE.DataTexture;
  demonChitin: THREE.CanvasTexture;
  demonChitinNormal: THREE.DataTexture;
  softParticleTex: THREE.CanvasTexture;
  decalScorchTex: THREE.CanvasTexture;
  decalBloodTex: THREE.CanvasTexture;
  dispose: () => void;
}

const TEX_SIZE = 512;
const SCALE = TEX_SIZE / 64;

function makeCanvas(w = TEX_SIZE, h = TEX_SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return [canvas, ctx];
}

function finalizeSmoothTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
  clamp = false,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(16, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function hash2(x: number, y: number, seed = 13): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Tileable periodic value noise so seamless textures show zero seam artifacts.
 */
function tileNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const wx0 = ((x0 % period) + period) % period;
  const wy0 = ((y0 % period) + period) % period;
  const wx1 = (wx0 + 1) % period;
  const wy1 = (wy0 + 1) % period;

  const n00 = hash2(wx0, wy0, seed);
  const n10 = hash2(wx1, wy0, seed);
  const n01 = hash2(wx0, wy1, seed);
  const n11 = hash2(wx1, wy1, seed);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function tileFbm(u: number, v: number, basePeriod: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = basePeriod;
  for (let i = 0; i < octaves; i++) {
    sum += tileNoise(u, v, freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/**
 * Generates paired Tangent-Space Normal Map and Linear Roughness Map from a source canvas
 * plus an optional roughness canvas/bias. Leaves both in linear NoColorSpace.
 */
function buildNormalAndRoughness(
  albedoCanvas: HTMLCanvasElement,
  maxAnisotropy: number,
  options: {
    normalStrength?: number;
    repeatX?: number;
    repeatY?: number;
    baseRoughness?: number;
    roughnessContrast?: number;
    invertRoughness?: boolean;
    wetStreaks?: boolean;
  } = {},
): { normal: THREE.DataTexture; roughness: THREE.DataTexture } {
  const {
    normalStrength = 2.6,
    repeatX = 1,
    repeatY = 1,
    baseRoughness = 0.55,
    roughnessContrast = 0.35,
    invertRoughness = true,
    wetStreaks = false,
  } = options;

  const w = albedoCanvas.width;
  const h = albedoCanvas.height;
  const src = albedoCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const normalBuf = new Uint8Array(w * h * 4);
  const roughBuf = new Uint8Array(w * h * 4);

  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    lum[i] = (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) / 255;
  }

  const sampleH = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return lum[wy * w + wx];
  };

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const c = lum[y * w + x];
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * normalStrength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * normalStrength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * w + x) * 4;
      normalBuf[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normalBuf[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalBuf[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalBuf[idx + 3] = 255;

      // Roughness variation from luminance + optional damp/oily patches
      const centered = (invertRoughness ? 0.5 - c : c - 0.5) * roughnessContrast;
      let rough = baseRoughness + centered;
      if (wetStreaks) {
        const damp = tileFbm(u, v, 6, 3, 404);
        if (damp > 0.58) {
          rough -= (damp - 0.58) * 1.15;
        }
      }
      const rByte = Math.round(THREE.MathUtils.clamp(rough, 0.08, 0.96) * 255);
      roughBuf[idx] = rByte;
      roughBuf[idx + 1] = rByte;
      roughBuf[idx + 2] = rByte;
      roughBuf[idx + 3] = 255;
    }
  }

  const configureDataTex = (buf: Uint8Array): THREE.DataTexture => {
    const tex = new THREE.DataTexture(buf, w, h, THREE.RGBAFormat);
    tex.colorSpace = THREE.NoColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = Math.min(16, maxAnisotropy);
    tex.needsUpdate = true;
    return tex;
  };

  return {
    normal: configureDataTex(normalBuf),
    roughness: configureDataTex(roughBuf),
  };
}

/**
 * Applies multi-octave organic weathering, brushed metal anisotropy or stone pitting directly on pixel buffer.
 */
function applyOrganicWeathering(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  options: {
    seed: number;
    grainStrength?: number;
    brushed?: boolean;
    verticalGrime?: number;
    rustSpots?: number;
  },
): void {
  const { seed, grainStrength = 18, brushed = false, verticalGrime = 0.16, rustSpots = 0 } = options;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  for (let y = 0; y < h; y++) {
    const v = y / h;
    // Ambient occlusion / grime darkening near floor & ceiling seams
    const edgeProx = Math.min(v, 1 - v);
    const edgeAo = edgeProx < 0.14 ? 1 - ((0.14 - edgeProx) / 0.14) * verticalGrime : 1;

    for (let x = 0; x < w; x++) {
      const u = x / w;
      const idx = (y * w + x) * 4;
      const n = brushed
        ? tileFbm(u * 0.28, v * 2.5, 10, 3, seed)
        : tileFbm(u, v, 8, 4, seed);
      const fine = hash2(x, y, seed + 5) - 0.5;
      const delta = (n - 0.5) * grainStrength * 2 + fine * grainStrength * 0.55;

      let r = d[idx] + delta;
      let g = d[idx + 1] + delta;
      let b = d[idx + 2] + delta;

      if (rustSpots > 0) {
        const rust = tileFbm(u, v, 5, 3, seed + 99);
        if (rust > 1 - rustSpots) {
          const amt = Math.min(1, (rust - (1 - rustSpots)) * 3.8);
          r = r * (1 - amt) + 96 * amt;
          g = g * (1 - amt) + 46 * amt;
          b = b * (1 - amt) + 24 * amt;
        }
      }

      d[idx] = Math.max(0, Math.min(255, r * edgeAo));
      d[idx + 1] = Math.max(0, Math.min(255, g * edgeAo));
      d[idx + 2] = Math.max(0, Math.min(255, b * edgeAo));
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function createRetroTextures(maxAnisotropy: number): RetroTextureSet {
  // 1. Tech Bulkhead Wall (#) - Armored titanium/steel plates with beveled seams, rivets & warning vents
  const [cTech, gTech] = makeCanvas();
  {
    const grad = gTech.createLinearGradient(0, 0, 0, TEX_SIZE);
    grad.addColorStop(0, '#505967');
    grad.addColorStop(0.45, '#3b424f');
    grad.addColorStop(0.86, '#2a2f39');
    grad.addColorStop(1, '#1d2027');
    gTech.fillStyle = grad;
    gTech.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    gTech.save();
    gTech.scale(SCALE, SCALE);
    // Panel seam grooves & specular top bevels
    gTech.fillStyle = '#15181f';
    gTech.fillRect(0, 0, 64, 2);
    gTech.fillRect(0, 62, 64, 2);
    gTech.fillRect(0, 0, 1.5, 64);
    gTech.fillRect(31, 0, 2, 64);
    gTech.fillRect(62.5, 0, 1.5, 64);
    gTech.fillStyle = 'rgba(220,235,255,0.22)';
    gTech.fillRect(2, 2, 29, 0.9);
    gTech.fillRect(33, 2, 29, 0.9);

    // Machined corner bolts with highlight/shadow ring
    for (const rx of [4.8, 28.2, 35.8, 59.2]) {
      for (const ry of [4.8, 49.5]) {
        gTech.fillStyle = '#181c23';
        gTech.beginPath();
        gTech.arc(rx, ry, 1.45, 0, Math.PI * 2);
        gTech.fill();
        gTech.fillStyle = '#8b95a8';
        gTech.beginPath();
        gTech.arc(rx - 0.15, ry - 0.15, 0.95, 0, Math.PI * 2);
        gTech.fill();
      }
    }

    // Diagonal hazard stripe kickplate
    gTech.save();
    gTech.beginPath();
    gTech.rect(2, 54, 60, 5.5);
    gTech.clip();
    gTech.fillStyle = '#17181c';
    gTech.fillRect(2, 54, 60, 5.5);
    gTech.fillStyle = '#d48d1d';
    for (let sx = -8; sx < 72; sx += 8) {
      gTech.beginPath();
      gTech.moveTo(sx, 59.5);
      gTech.lineTo(sx + 4, 59.5);
      gTech.lineTo(sx + 7, 54);
      gTech.lineTo(sx + 3, 54);
      gTech.closePath();
      gTech.fill();
    }
    gTech.restore();

    // Recessed acoustic/cooling louver bays
    for (const bx of [7.5, 37.5]) {
      gTech.fillStyle = '#101318';
      gTech.fillRect(bx, 15, 19, 25);
      gTech.strokeStyle = 'rgba(255,255,255,0.12)';
      gTech.lineWidth = 0.6;
      gTech.strokeRect(bx, 15, 19, 25);
      for (let vy = 17.5; vy < 38.5; vy += 3.5) {
        const lGrad = gTech.createLinearGradient(0, vy, 0, vy + 2);
        lGrad.addColorStop(0, '#444c5d');
        lGrad.addColorStop(1, '#1d222b');
        gTech.fillStyle = lGrad;
        gTech.fillRect(bx + 1.5, vy, 16, 2);
      }
    }

    // Recessed amber telemetry indicator strips
    for (const lx of [26.5, 56.5]) {
      const glow = gTech.createRadialGradient(lx, 9.5, 0.4, lx, 9.5, 5.5);
      glow.addColorStop(0, 'rgba(255,155,55,0.95)');
      glow.addColorStop(1, 'rgba(255,80,10,0)');
      gTech.fillStyle = glow;
      gTech.fillRect(lx - 5.5, 4, 11, 11);
      gTech.fillStyle = '#ffaa44';
      gTech.fillRect(lx - 2.2, 8.2, 4.4, 2.6);
    }
    gTech.restore();

    applyOrganicWeathering(gTech, TEX_SIZE, TEX_SIZE, {
      seed: 1,
      grainStrength: 16,
      brushed: true,
      verticalGrime: 0.25,
      rustSpots: 0.16,
    });
  }

  // 2. Hellstone / Volcanic Masonry Wall (%)
  const [cHell, gHell] = makeCanvas();
  {
    gHell.fillStyle = '#160b0a';
    gHell.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    gHell.save();
    gHell.scale(SCALE, SCALE);
    const brickH = 12.8;
    const brickW = 21.33;
    for (let row = 0; row < 5; row++) {
      const offset = (row % 2) * (brickW * 0.5);
      for (let col = -1; col < 4; col++) {
        const bx = col * brickW + offset;
        const by = row * brickH;
        const tone = hash2(col + 11, row + 3, 2);
        const r = Math.floor(62 + tone * 34);
        const g = Math.floor(26 + tone * 15);
        const b = Math.floor(22 + tone * 12);
        const bGrad = gHell.createLinearGradient(bx, by, bx, by + brickH);
        bGrad.addColorStop(0, `rgb(${r + 22},${g + 12},${b + 9})`);
        bGrad.addColorStop(0.25, `rgb(${r},${g},${b})`);
        bGrad.addColorStop(1, `rgb(${Math.max(12, r - 24)},${Math.max(7, g - 11)},${Math.max(7, b - 11)})`);
        gHell.fillStyle = bGrad;
        gHell.fillRect(bx + 0.9, by + 0.9, brickW - 1.8, brickH - 1.8);
      }
    }
    gHell.restore();

    applyOrganicWeathering(gHell, TEX_SIZE, TEX_SIZE, {
      seed: 9,
      grainStrength: 24,
      verticalGrime: 0.34,
      rustSpots: 0.12,
    });

    gHell.save();
    gHell.scale(SCALE, SCALE);
    const crossGlow = gHell.createRadialGradient(32, 32, 1.5, 32, 32, 18);
    crossGlow.addColorStop(0, 'rgba(255,95,28,0.68)');
    crossGlow.addColorStop(1, 'rgba(255,30,10,0)');
    gHell.fillStyle = crossGlow;
    gHell.fillRect(14, 14, 36, 36);
    gHell.fillStyle = '#3a0c08';
    gHell.fillRect(29, 19, 6, 26);
    gHell.fillRect(21, 27, 22, 6);
    gHell.fillStyle = '#ff4b22';
    gHell.fillRect(30.2, 20.5, 3.6, 23);
    gHell.fillRect(22.5, 28.2, 19, 3.6);
    gHell.fillStyle = '#ffd56b';
    gHell.fillRect(31, 29, 2, 2);
    gHell.restore();
  }

  // 3. Reactor Conduit Wall (&)
  const [cReact, gReact] = makeCanvas();
  {
    const grad = gReact.createLinearGradient(0, 0, TEX_SIZE, 0);
    grad.addColorStop(0, '#1d2027');
    grad.addColorStop(0.5, '#343945');
    grad.addColorStop(1, '#1d2027');
    gReact.fillStyle = grad;
    gReact.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    gReact.save();
    gReact.scale(SCALE, SCALE);
    // Heat-sink fins across background
    for (let y = 4; y < 60; y += 4) {
      gReact.fillStyle = '#15171d';
      gReact.fillRect(2, y, 60, 1.5);
    }
    // Recessed plasma pipe channels
    gReact.fillStyle = '#0e1015';
    gReact.fillRect(9, 2, 14, 60);
    gReact.fillRect(41, 2, 14, 60);
    for (const cx of [16, 48]) {
      const tubeGrad = gReact.createLinearGradient(cx - 4.5, 0, cx + 4.5, 0);
      tubeGrad.addColorStop(0, '#6a1204');
      tubeGrad.addColorStop(0.3, '#ff5b14');
      tubeGrad.addColorStop(0.5, '#ffe188');
      tubeGrad.addColorStop(0.7, '#ff5b14');
      tubeGrad.addColorStop(1, '#6a1204');
      gReact.fillStyle = tubeGrad;
      gReact.fillRect(cx - 4.5, 4, 9, 56);
    }
    gReact.fillStyle = '#4e5666';
    for (let y = 12; y < 58; y += 16) {
      gReact.fillRect(7.5, y, 17, 4.5);
      gReact.fillRect(39.5, y, 17, 4.5);
      gReact.fillStyle = '#8b95aa';
      gReact.fillRect(7.5, y, 17, 0.9);
      gReact.fillRect(39.5, y, 17, 0.9);
      gReact.fillStyle = '#4e5666';
    }
    gReact.restore();
    applyOrganicWeathering(gReact, TEX_SIZE, TEX_SIZE, {
      seed: 4,
      grainStrength: 15,
      brushed: true,
      verticalGrime: 0.24,
    });
  }

  // 4. Corroded Rust / Olive Bunker Wall ($)
  const [cRust, gRust] = makeCanvas();
  {
    const grad = gRust.createLinearGradient(0, 0, 0, TEX_SIZE);
    grad.addColorStop(0, '#5a503e');
    grad.addColorStop(0.5, '#473e2f');
    grad.addColorStop(1, '#2f271d');
    gRust.fillStyle = grad;
    gRust.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    gRust.save();
    gRust.scale(SCALE, SCALE);
    gRust.fillStyle = '#241d15';
    gRust.fillRect(0, 20, 64, 2.5);
    gRust.fillRect(0, 44, 64, 2.5);
    gRust.fillRect(20, 0, 2.5, 64);
    gRust.fillRect(44, 0, 2.5, 64);
    gRust.fillStyle = '#6c8736';
    gRust.fillRect(3.5, 49.5, 14, 6.5);
    gRust.fillRect(25, 49.5, 14, 6.5);
    gRust.fillRect(46.5, 49.5, 14, 6.5);
    gRust.restore();

    applyOrganicWeathering(gRust, TEX_SIZE, TEX_SIZE, {
      seed: 55,
      grainStrength: 24,
      verticalGrime: 0.3,
      rustSpots: 0.28,
    });
  }

  // 5. Obsidian Arcane Wall (@)
  const [cObs, gObs] = makeCanvas();
  {
    const grad = gObs.createLinearGradient(0, 0, TEX_SIZE, TEX_SIZE);
    grad.addColorStop(0, '#221a2e');
    grad.addColorStop(0.5, '#15101f');
    grad.addColorStop(1, '#0d0914');
    gObs.fillStyle = grad;
    gObs.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    gObs.save();
    gObs.scale(SCALE, SCALE);
    // Carved basalt blocks
    gObs.strokeStyle = '#07040b';
    gObs.lineWidth = 1.6;
    gObs.strokeRect(2, 2, 60, 28);
    gObs.strokeRect(2, 34, 60, 28);

    gObs.fillStyle = '#6e1930';
    gObs.fillRect(0, 30, 64, 4);
    gObs.fillStyle = '#d9385a';
    gObs.fillRect(12, 12, 3.5, 40);
    gObs.fillRect(48.5, 12, 3.5, 40);
    for (const rx of [13.75, 50.25]) {
      const rGlow = gObs.createRadialGradient(rx, 32, 0.5, rx, 32, 8.5);
      rGlow.addColorStop(0, 'rgba(255,155,125,0.95)');
      rGlow.addColorStop(1, 'rgba(217,56,90,0)');
      gObs.fillStyle = rGlow;
      gObs.fillRect(rx - 8.5, 23.5, 17, 17);
    }
    gObs.fillStyle = '#ffaa88';
    gObs.fillRect(12.8, 28, 2, 8);
    gObs.fillRect(49.2, 28, 2, 8);
    gObs.restore();

    applyOrganicWeathering(gObs, TEX_SIZE, TEX_SIZE, {
      seed: 71,
      grainStrength: 20,
      verticalGrime: 0.28,
    });
  }

  // 6. Cyber Vault Wall (=)
  const [cCyb, gCyb] = makeCanvas();
  {
    const grad = gCyb.createLinearGradient(0, 0, 0, TEX_SIZE);
    grad.addColorStop(0, '#273242');
    grad.addColorStop(1, '#141b25');
    gCyb.fillStyle = grad;
    gCyb.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    gCyb.save();
    gCyb.scale(SCALE, SCALE);
    gCyb.fillStyle = '#2d394b';
    gCyb.fillRect(4, 4, 56, 56);
    gCyb.fillStyle = '#111720';
    gCyb.fillRect(10, 10, 44, 44);
    gCyb.fillStyle = '#0e7490';
    gCyb.fillRect(16, 16, 32, 3.5);
    gCyb.fillRect(16, 44.5, 32, 3.5);
    gCyb.fillRect(16, 19.5, 3.5, 25);
    gCyb.fillRect(44.5, 19.5, 3.5, 25);
    const cGlow = gCyb.createRadialGradient(32, 32, 1, 32, 32, 13);
    cGlow.addColorStop(0, 'rgba(72,240,255,0.95)');
    cGlow.addColorStop(1, 'rgba(14,116,144,0)');
    gCyb.fillStyle = cGlow;
    gCyb.fillRect(19, 19, 26, 26);
    gCyb.fillStyle = '#66f3ff';
    gCyb.fillRect(28, 28, 8, 8);
    gCyb.restore();

    applyOrganicWeathering(gCyb, TEX_SIZE, TEX_SIZE, {
      seed: 83,
      grainStrength: 13,
      brushed: true,
      verticalGrime: 0.2,
    });
  }

  // 7. Tech Blast Door
  const [cDoor, gDoor] = makeCanvas();
  {
    const grad = gDoor.createLinearGradient(0, 0, 0, TEX_SIZE);
    grad.addColorStop(0, '#545f71');
    grad.addColorStop(1, '#2c323d');
    gDoor.fillStyle = grad;
    gDoor.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    gDoor.save();
    gDoor.scale(SCALE, SCALE);
    gDoor.fillStyle = '#191d24';
    gDoor.fillRect(3.5, 3.5, 57, 57);
    const pGrad = gDoor.createLinearGradient(0, 8, 0, 56);
    pGrad.addColorStop(0, '#667388');
    pGrad.addColorStop(1, '#3c4553');
    gDoor.fillStyle = pGrad;
    gDoor.fillRect(7, 7, 23, 50);
    gDoor.fillRect(34, 7, 23, 50);
    gDoor.fillStyle = '#15181e';
    gDoor.fillRect(30, 3.5, 4, 57);
    // Hydraulic lock bars
    gDoor.fillStyle = '#252b35';
    gDoor.fillRect(7, 28, 50, 8);
    gDoor.fillStyle = '#22ff88';
    gDoor.fillRect(15, 29, 7, 6);
    gDoor.fillRect(42, 29, 7, 6);
    gDoor.restore();

    applyOrganicWeathering(gDoor, TEX_SIZE, TEX_SIZE, {
      seed: 11,
      grainStrength: 14,
      brushed: true,
      verticalGrime: 0.22,
    });
  }

  // 8. Locked Crimson Keycard Door
  const [cLock, gLock] = makeCanvas();
  {
    gLock.drawImage(cDoor, 0, 0);
    gLock.save();
    gLock.scale(SCALE, SCALE);
    const barGrad = gLock.createLinearGradient(0, 22, 0, 42);
    barGrad.addColorStop(0, '#c81f1f');
    barGrad.addColorStop(0.5, '#8c1414');
    barGrad.addColorStop(1, '#5c0b0b');
    gLock.fillStyle = barGrad;
    gLock.fillRect(0, 22, 64, 20);
    gLock.fillStyle = '#ff4444';
    gLock.fillRect(15, 27, 7, 10);
    gLock.fillRect(42, 27, 7, 10);
    gLock.fillStyle = '#ffbb33';
    gLock.fillRect(26, 27, 12, 10);
    gLock.fillStyle = '#1a0808';
    gLock.fillRect(30, 30, 4, 4);
    gLock.restore();
  }

  // 9. Floor Grate (with deep under-floor recess shadow)
  const [cFloorG, gFloorG] = makeCanvas();
  {
    gFloorG.fillStyle = '#0d0f14';
    gFloorG.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    gFloorG.save();
    gFloorG.scale(SCALE, SCALE);
    for (let i = 0; i < 64; i += 8) {
      const gH = gFloorG.createLinearGradient(i, 0, i + 3.2, 0);
      gH.addColorStop(0, '#222731');
      gH.addColorStop(0.5, '#4b5566');
      gH.addColorStop(1, '#1d212b');
      gFloorG.fillStyle = gH;
      gFloorG.fillRect(i, 0, 3.2, 64);

      const gV = gFloorG.createLinearGradient(0, i, 0, i + 3.2);
      gV.addColorStop(0, '#222731');
      gV.addColorStop(0.5, '#4b5566');
      gV.addColorStop(1, '#1d212b');
      gFloorG.fillStyle = gV;
      gFloorG.fillRect(0, i, 64, 3.2);
    }
    gFloorG.restore();
    applyOrganicWeathering(gFloorG, TEX_SIZE, TEX_SIZE, {
      seed: 7,
      grainStrength: 15,
      brushed: true,
      verticalGrime: 0.05,
      rustSpots: 0.14,
    });
  }

  // 10. Damp Chiseled Floor Stone
  const [cFloorS, gFloorS] = makeCanvas();
  {
    gFloorS.fillStyle = '#181211';
    gFloorS.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    gFloorS.save();
    gFloorS.scale(SCALE, SCALE);
    for (let y = 0; y < 64; y += 16) {
      for (let x = 0; x < 64; x += 16) {
        const shade = Math.floor(38 + hash2(x, y, 19) * 20);
        const sGrad = gFloorS.createLinearGradient(x, y, x + 16, y + 16);
        sGrad.addColorStop(0, `rgb(${shade + 14},${shade + 7},${shade + 4})`);
        sGrad.addColorStop(1, `rgb(${shade - 2},${shade - 6},${shade - 8})`);
        gFloorS.fillStyle = sGrad;
        gFloorS.fillRect(x + 0.9, y + 0.9, 14.2, 14.2);
      }
    }
    gFloorS.restore();
    applyOrganicWeathering(gFloorS, TEX_SIZE, TEX_SIZE, {
      seed: 23,
      grainStrength: 22,
      verticalGrime: 0.05,
    });
  }

  // 11. Brushed Industrial Floor Metal Plate
  const [cFloorM, gFloorM] = makeCanvas();
  {
    gFloorM.fillStyle = '#1b2028';
    gFloorM.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    gFloorM.save();
    gFloorM.scale(SCALE, SCALE);
    const plates: [number, number, string, string][] = [
      [1.5, 1.5, '#424b5c', '#2a303b'],
      [33.5, 33.5, '#424b5c', '#2a303b'],
      [33.5, 1.5, '#353d4b', '#222731'],
      [1.5, 33.5, '#353d4b', '#222731'],
    ];
    for (const [px, py, c1, c2] of plates) {
      const mGrad = gFloorM.createLinearGradient(px, py, px + 29, py + 29);
      mGrad.addColorStop(0, c1);
      mGrad.addColorStop(1, c2);
      gFloorM.fillStyle = mGrad;
      gFloorM.fillRect(px, py, 29, 29);
    }
    for (let y = 7; y < 64; y += 16) {
      for (let x = 7; x < 64; x += 16) {
        gFloorM.fillStyle = '#161a21';
        gFloorM.beginPath();
        gFloorM.arc(x + 1.5, y + 1, 1.8, 0, Math.PI * 2);
        gFloorM.fill();
        gFloorM.fillStyle = '#6c7992';
        gFloorM.beginPath();
        gFloorM.arc(x + 1.3, y + 0.8, 1.3, 0, Math.PI * 2);
        gFloorM.fill();
      }
    }
    gFloorM.restore();
    applyOrganicWeathering(gFloorM, TEX_SIZE, TEX_SIZE, {
      seed: 29,
      grainStrength: 14,
      brushed: true,
      verticalGrime: 0.04,
      rustSpots: 0.1,
    });
  }

  // 12. Floor Obsidian Cracked
  const [cFloorO, gFloorO] = makeCanvas();
  {
    gFloorO.fillStyle = '#110e17';
    gFloorO.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    gFloorO.save();
    gFloorO.scale(SCALE, SCALE);
    for (let y = 0; y < 64; y += 16) {
      for (let x = 0; x < 64; x += 16) {
        const s = Math.floor(24 + hash2(x, y, 91) * 15);
        const oGrad = gFloorO.createLinearGradient(x, y, x + 16, y + 16);
        oGrad.addColorStop(0, `rgb(${s + 12},${s + 6},${s + 16})`);
        oGrad.addColorStop(1, `rgb(${s},${s - 2},${s + 4})`);
        gFloorO.fillStyle = oGrad;
        gFloorO.fillRect(x + 0.9, y + 0.9, 14.2, 14.2);
      }
    }
    gFloorO.fillStyle = '#8b2432';
    gFloorO.fillRect(0, 31, 64, 1.6);
    gFloorO.fillRect(31, 0, 1.6, 64);
    gFloorO.restore();
    applyOrganicWeathering(gFloorO, TEX_SIZE, TEX_SIZE, {
      seed: 91,
      grainStrength: 18,
      verticalGrime: 0.04,
    });
  }

  // 13. Coffered Ceiling Tech
  const [cCeil, gCeil] = makeCanvas();
  {
    gCeil.fillStyle = '#14171d';
    gCeil.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    gCeil.save();
    gCeil.scale(SCALE, SCALE);
    gCeil.fillStyle = '#222731';
    gCeil.fillRect(3, 3, 58, 58);
    gCeil.fillStyle = '#0e1116';
    gCeil.fillRect(9, 9, 46, 46);
    const lightGlow = gCeil.createRadialGradient(32, 32, 2, 32, 32, 22);
    lightGlow.addColorStop(0, 'rgba(185,220,255,0.45)');
    lightGlow.addColorStop(1, 'rgba(75,94,122,0)');
    gCeil.fillStyle = lightGlow;
    gCeil.fillRect(10, 10, 44, 44);
    gCeil.fillStyle = '#3f4f66';
    gCeil.fillRect(23, 15, 18, 34);
    gCeil.fillStyle = '#b4d0f5';
    gCeil.fillRect(27, 19, 10, 26);
    gCeil.restore();
    applyOrganicWeathering(gCeil, TEX_SIZE, TEX_SIZE, {
      seed: 37,
      grainStrength: 12,
      brushed: true,
      verticalGrime: 0.04,
    });
  }

  // 14. Molten Magma / Lava Floor (with dark cooled crust islands)
  const [cLava, gLava] = makeCanvas();
  {
    const img = gLava.createImageData(TEX_SIZE, TEX_SIZE);
    const data = img.data;
    for (let y = 0; y < TEX_SIZE; y++) {
      const v = y / TEX_SIZE;
      for (let x = 0; x < TEX_SIZE; x++) {
        const u = x / TEX_SIZE;
        const n = tileFbm(u, v, 5, 4, 177);
        const crust = tileFbm(u + 0.13, v + 0.27, 8, 3, 211);
        const t = THREE.MathUtils.clamp(n * 0.72 + crust * 0.28, 0, 1);
        const idx = (y * TEX_SIZE + x) * 4;
        if (t > 0.62) {
          const k = (t - 0.62) / 0.38;
          data[idx] = 255;
          data[idx + 1] = Math.round(140 + k * 110);
          data[idx + 2] = Math.round(20 + k * 90);
        } else if (t > 0.44) {
          const k = (t - 0.44) / 0.18;
          data[idx] = Math.round(145 + k * 110);
          data[idx + 1] = Math.round(28 + k * 112);
          data[idx + 2] = 10;
        } else {
          // Dark basalt crust floating on magma
          const k = t / 0.44;
          data[idx] = Math.round(28 + k * 80);
          data[idx + 1] = Math.round(12 + k * 18);
          data[idx + 2] = Math.round(10 + k * 8);
        }
        data[idx + 3] = 255;
      }
    }
    gLava.putImageData(img, 0, 0);
  }

  // 15. Viscous Acid Sludge Floor
  const [cAcid, gAcid] = makeCanvas();
  {
    const img = gAcid.createImageData(TEX_SIZE, TEX_SIZE);
    const data = img.data;
    for (let y = 0; y < TEX_SIZE; y++) {
      const v = y / TEX_SIZE;
      for (let x = 0; x < TEX_SIZE; x++) {
        const u = x / TEX_SIZE;
        const n = tileFbm(u, v, 5, 4, 303);
        const swirl = tileFbm(u + n * 0.2, v - n * 0.2, 8, 3, 331);
        const t = THREE.MathUtils.clamp(n * 0.6 + swirl * 0.4, 0, 1);
        const idx = (y * TEX_SIZE + x) * 4;
        if (t > 0.66) {
          const k = (t - 0.66) / 0.34;
          data[idx] = Math.round(125 + k * 85);
          data[idx + 1] = 255;
          data[idx + 2] = Math.round(45 + k * 55);
        } else if (t > 0.4) {
          const k = (t - 0.4) / 0.26;
          data[idx] = Math.round(24 + k * 100);
          data[idx + 1] = Math.round(118 + k * 130);
          data[idx + 2] = 22;
        } else {
          const k = t / 0.4;
          data[idx] = Math.round(8 + k * 16);
          data[idx + 1] = Math.round(35 + k * 83);
          data[idx + 2] = 12;
        }
        data[idx + 3] = 255;
      }
    }
    gAcid.putImageData(img, 0, 0);
  }

  // 16. Military Wood & Steel Crate Texture
  const [cCrate, gCrate] = makeCanvas();
  {
    const grad = gCrate.createLinearGradient(0, 0, TEX_SIZE, TEX_SIZE);
    grad.addColorStop(0, '#856139');
    grad.addColorStop(1, '#583d20');
    gCrate.fillStyle = grad;
    gCrate.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    gCrate.save();
    gCrate.scale(SCALE, SCALE);
    // Plank lines
    gCrate.fillStyle = '#3c2914';
    for (let y = 14; y < 56; y += 11) {
      gCrate.fillRect(6, y, 52, 0.9);
    }
    gCrate.fillStyle = '#4a3319';
    gCrate.fillRect(0, 0, 64, 6);
    gCrate.fillRect(0, 58, 64, 6);
    gCrate.fillRect(0, 0, 6, 64);
    gCrate.fillRect(58, 0, 6, 64);
    gCrate.strokeStyle = '#462e16';
    gCrate.lineWidth = 5;
    gCrate.beginPath();
    gCrate.moveTo(6, 6);
    gCrate.lineTo(58, 58);
    gCrate.stroke();
    // Stamped steel latch plate
    gCrate.fillStyle = '#c49645';
    gCrate.fillRect(24, 24, 16, 16);
    gCrate.fillStyle = '#282c34';
    gCrate.fillRect(28, 28, 8, 8);
    gCrate.restore();
    applyOrganicWeathering(gCrate, TEX_SIZE, TEX_SIZE, {
      seed: 61,
      grainStrength: 18,
      brushed: true,
      verticalGrime: 0.14,
    });
  }

  // 17. Explosive Hazard Drum Texture
  const [cBarrel, gBarrel] = makeCanvas();
  {
    const grad = gBarrel.createLinearGradient(0, 0, 0, TEX_SIZE);
    grad.addColorStop(0, '#5a6370');
    grad.addColorStop(0.5, '#3e444f');
    grad.addColorStop(1, '#252930');
    gBarrel.fillStyle = grad;
    gBarrel.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    gBarrel.save();
    gBarrel.scale(SCALE, SCALE);
    const redBand = gBarrel.createLinearGradient(0, 12, 0, 52);
    redBand.addColorStop(0, '#d93224');
    redBand.addColorStop(0.5, '#a82016');
    redBand.addColorStop(1, '#6e110b');
    gBarrel.fillStyle = redBand;
    gBarrel.fillRect(0, 12, 64, 40);
    gBarrel.fillStyle = '#ecbf2a';
    gBarrel.fillRect(0, 26, 64, 12);
    gBarrel.fillStyle = '#18181b';
    for (let x = 4; x < 64; x += 16) {
      gBarrel.fillRect(x, 28, 8, 8);
    }
    gBarrel.restore();
    applyOrganicWeathering(gBarrel, TEX_SIZE, TEX_SIZE, {
      seed: 44,
      grainStrength: 16,
      verticalGrime: 0.25,
      rustSpots: 0.16,
    });
  }

  // 18. Fluted Reinforced Column Pillar Texture
  const [cPillar, gPillar] = makeCanvas();
  {
    gPillar.fillStyle = '#2c303a';
    gPillar.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    gPillar.save();
    gPillar.scale(SCALE, SCALE);
    for (let x = 2; x < 64; x += 10) {
      const pGrad = gPillar.createLinearGradient(x, 0, x + 7.5, 0);
      pGrad.addColorStop(0, '#363c48');
      pGrad.addColorStop(0.4, '#5e6678');
      pGrad.addColorStop(0.8, '#292d36');
      pGrad.addColorStop(1, '#191b22');
      gPillar.fillStyle = pGrad;
      gPillar.fillRect(x, 0, 7.5, 64);
    }
    gPillar.fillStyle = '#cf4320';
    gPillar.fillRect(0, 5, 64, 3.5);
    gPillar.fillRect(0, 55.5, 64, 3.5);
    gPillar.restore();
    applyOrganicWeathering(gPillar, TEX_SIZE, TEX_SIZE, {
      seed: 19,
      grainStrength: 17,
      verticalGrime: 0.28,
      rustSpots: 0.1,
    });
  }

  // 19. Organic Demon Sinew / Scarred Flesh Texture
  const [cDemonSkin, gDemonSkin] = makeCanvas(256, 256);
  {
    const img = gDemonSkin.createImageData(256, 256);
    const d = img.data;
    for (let y = 0; y < 256; y++) {
      const v = y / 256;
      for (let x = 0; x < 256; x++) {
        const u = x / 256;
        const muscle = tileFbm(u * 1.4, v * 0.7, 6, 4, 501);
        const vein = Math.abs(tileFbm(u, v, 8, 3, 521) - 0.5);
        const veinDark = vein < 0.065 ? (0.065 - vein) * 11 : 0;
        const idx = (y * 256 + x) * 4;
        d[idx] = Math.max(0, Math.min(255, 165 + (muscle - 0.5) * 95 - veinDark * 55));
        d[idx + 1] = Math.max(0, Math.min(255, 58 + (muscle - 0.5) * 42 - veinDark * 30));
        d[idx + 2] = Math.max(0, Math.min(255, 48 + (muscle - 0.5) * 35 - veinDark * 25));
        d[idx + 3] = 255;
      }
    }
    gDemonSkin.putImageData(img, 0, 0);
  }

  // 20. Dark Chitin / Horn / Obsidian Carapace Texture
  const [cChitin, gChitin] = makeCanvas(256, 256);
  {
    const img = gChitin.createImageData(256, 256);
    const d = img.data;
    for (let y = 0; y < 256; y++) {
      const v = y / 256;
      for (let x = 0; x < 256; x++) {
        const u = x / 256;
        const ridges = Math.sin(v * Math.PI * 16 + tileFbm(u, v, 5, 3, 601) * 4) * 0.5 + 0.5;
        const grain = tileFbm(u, v, 10, 3, 613);
        const idx = (y * 256 + x) * 4;
        const base = 36 + ridges * 34 + (grain - 0.5) * 28;
        d[idx] = Math.max(0, Math.min(255, base * 1.15));
        d[idx + 1] = Math.max(0, Math.min(255, base * 0.92));
        d[idx + 2] = Math.max(0, Math.min(255, base * 1.05));
        d[idx + 3] = 255;
      }
    }
    gChitin.putImageData(img, 0, 0);
  }

  // 21. Soft Radial Glow / Dust / Smoke Particle Sprite
  const [cSoftP, gSoftP] = makeCanvas(128, 128);
  {
    const grad = gSoftP.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.28, 'rgba(255,255,255,0.72)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    gSoftP.fillStyle = grad;
    gSoftP.fillRect(0, 0, 128, 128);
  }

  // 22. Scorch Blast Decal
  const [cScorch, gScorch] = makeCanvas(128, 128);
  {
    const grad = gScorch.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(8,6,6,0.92)');
    grad.addColorStop(0.45, 'rgba(18,12,10,0.68)');
    grad.addColorStop(0.8, 'rgba(24,16,12,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    gScorch.fillStyle = grad;
    gScorch.fillRect(0, 0, 128, 128);
  }

  // 23. Organic Blood Splatter Decal
  const [cBlood, gBlood] = makeCanvas(128, 128);
  {
    const grad = gBlood.createRadialGradient(64, 64, 4, 64, 64, 46);
    grad.addColorStop(0, 'rgba(110,10,12,0.92)');
    grad.addColorStop(0.55, 'rgba(80,6,8,0.75)');
    grad.addColorStop(1, 'rgba(60,4,6,0)');
    gBlood.fillStyle = grad;
    gBlood.fillRect(0, 0, 128, 128);
    // Satellite droplets
    for (let i = 0; i < 14; i++) {
      const ang = hash2(i, 3, 77) * Math.PI * 2;
      const dist = 24 + hash2(i, 9, 77) * 30;
      const rad = 3 + hash2(i, 15, 77) * 7;
      gBlood.fillStyle = 'rgba(95,8,10,0.78)';
      gBlood.beginPath();
      gBlood.arc(64 + Math.cos(ang) * dist, 64 + Math.sin(ang) * dist, rad, 0, Math.PI * 2);
      gBlood.fill();
    }
  }

  const techWall = finalizeSmoothTexture(cTech, maxAnisotropy);
  const techMaps = buildNormalAndRoughness(cTech, maxAnisotropy, {
    normalStrength: 2.5,
    baseRoughness: 0.44,
    roughnessContrast: 0.36,
    wetStreaks: true,
  });

  const hellWall = finalizeSmoothTexture(cHell, maxAnisotropy);
  const hellMaps = buildNormalAndRoughness(cHell, maxAnisotropy, {
    normalStrength: 3.1,
    baseRoughness: 0.72,
    roughnessContrast: 0.34,
    wetStreaks: true,
  });

  const reactorWall = finalizeSmoothTexture(cReact, maxAnisotropy);
  const reactorMaps = buildNormalAndRoughness(cReact, maxAnisotropy, {
    normalStrength: 2.4,
    baseRoughness: 0.4,
    roughnessContrast: 0.38,
  });

  const rustWall = finalizeSmoothTexture(cRust, maxAnisotropy);
  const rustMaps = buildNormalAndRoughness(cRust, maxAnisotropy, {
    normalStrength: 2.7,
    baseRoughness: 0.76,
    roughnessContrast: 0.32,
    wetStreaks: true,
  });

  const obsidianWall = finalizeSmoothTexture(cObs, maxAnisotropy);
  const obsidianMaps = buildNormalAndRoughness(cObs, maxAnisotropy, {
    normalStrength: 2.8,
    baseRoughness: 0.38,
    roughnessContrast: 0.4,
    wetStreaks: true,
  });

  const cyberWall = finalizeSmoothTexture(cCyb, maxAnisotropy);
  const cyberMaps = buildNormalAndRoughness(cCyb, maxAnisotropy, {
    normalStrength: 2.2,
    baseRoughness: 0.32,
    roughnessContrast: 0.35,
  });

  const doorTech = finalizeSmoothTexture(cDoor, maxAnisotropy);
  const doorMaps = buildNormalAndRoughness(cDoor, maxAnisotropy, {
    normalStrength: 2.6,
    baseRoughness: 0.34,
    roughnessContrast: 0.35,
  });

  const doorLocked = finalizeSmoothTexture(cLock, maxAnisotropy);
  const doorLockedMaps = buildNormalAndRoughness(cLock, maxAnisotropy, {
    normalStrength: 2.6,
    baseRoughness: 0.34,
    roughnessContrast: 0.35,
  });

  const floorGrate = finalizeSmoothTexture(cFloorG, maxAnisotropy, 17, 16);
  const floorGrateMaps = buildNormalAndRoughness(cFloorG, maxAnisotropy, {
    normalStrength: 2.5,
    repeatX: 17,
    repeatY: 16,
    baseRoughness: 0.42,
    roughnessContrast: 0.38,
    wetStreaks: true,
  });

  const floorStone = finalizeSmoothTexture(cFloorS, maxAnisotropy, 17, 16);
  const floorStoneMaps = buildNormalAndRoughness(cFloorS, maxAnisotropy, {
    normalStrength: 2.8,
    repeatX: 17,
    repeatY: 16,
    baseRoughness: 0.68,
    roughnessContrast: 0.35,
    wetStreaks: true,
  });

  const floorMetal = finalizeSmoothTexture(cFloorM, maxAnisotropy, 17, 16);
  const floorMetalMaps = buildNormalAndRoughness(cFloorM, maxAnisotropy, {
    normalStrength: 2.4,
    repeatX: 17,
    repeatY: 16,
    baseRoughness: 0.38,
    roughnessContrast: 0.38,
    wetStreaks: true,
  });

  const floorObsidian = finalizeSmoothTexture(cFloorO, maxAnisotropy, 17, 16);
  const floorObsidianMaps = buildNormalAndRoughness(cFloorO, maxAnisotropy, {
    normalStrength: 2.7,
    repeatX: 17,
    repeatY: 16,
    baseRoughness: 0.35,
    roughnessContrast: 0.4,
    wetStreaks: true,
  });

  const ceilingTech = finalizeSmoothTexture(cCeil, maxAnisotropy, 17, 16);
  const ceilingMaps = buildNormalAndRoughness(cCeil, maxAnisotropy, {
    normalStrength: 2.2,
    repeatX: 17,
    repeatY: 16,
    baseRoughness: 0.62,
    roughnessContrast: 0.3,
  });

  const lavaFloor = finalizeSmoothTexture(cLava, maxAnisotropy, 1, 1);
  const lavaMaps = buildNormalAndRoughness(cLava, maxAnisotropy, {
    normalStrength: 2.0,
    baseRoughness: 0.3,
    roughnessContrast: 0.3,
  });

  const acidFloor = finalizeSmoothTexture(cAcid, maxAnisotropy, 1, 1);
  const acidMaps = buildNormalAndRoughness(cAcid, maxAnisotropy, {
    normalStrength: 1.6,
    baseRoughness: 0.14,
    roughnessContrast: 0.16,
  });

  const crateTex = finalizeSmoothTexture(cCrate, maxAnisotropy);
  const crateMaps = buildNormalAndRoughness(cCrate, maxAnisotropy, {
    normalStrength: 2.6,
    baseRoughness: 0.68,
    roughnessContrast: 0.32,
  });

  const barrelTex = finalizeSmoothTexture(cBarrel, maxAnisotropy);
  const barrelMaps = buildNormalAndRoughness(cBarrel, maxAnisotropy, {
    normalStrength: 2.2,
    baseRoughness: 0.42,
    roughnessContrast: 0.36,
  });

  const pillarTex = finalizeSmoothTexture(cPillar, maxAnisotropy);
  const pillarMaps = buildNormalAndRoughness(cPillar, maxAnisotropy, {
    normalStrength: 2.8,
    baseRoughness: 0.46,
    roughnessContrast: 0.35,
  });

  const demonSkin = finalizeSmoothTexture(cDemonSkin, maxAnisotropy);
  const demonSkinMaps = buildNormalAndRoughness(cDemonSkin, maxAnisotropy, {
    normalStrength: 2.4,
    baseRoughness: 0.48,
    roughnessContrast: 0.25,
  });

  const demonChitin = finalizeSmoothTexture(cChitin, maxAnisotropy);
  const demonChitinMaps = buildNormalAndRoughness(cChitin, maxAnisotropy, {
    normalStrength: 2.8,
    baseRoughness: 0.34,
    roughnessContrast: 0.25,
  });

  const softParticleTex = finalizeSmoothTexture(cSoftP, maxAnisotropy, 1, 1, true);
  const decalScorchTex = finalizeSmoothTexture(cScorch, maxAnisotropy, 1, 1, true);
  const decalBloodTex = finalizeSmoothTexture(cBlood, maxAnisotropy, 1, 1, true);

  return {
    techWall,
    techWallNormal: techMaps.normal,
    techWallRoughness: techMaps.roughness,
    hellWall,
    hellWallNormal: hellMaps.normal,
    hellWallRoughness: hellMaps.roughness,
    reactorWall,
    reactorWallNormal: reactorMaps.normal,
    reactorWallRoughness: reactorMaps.roughness,
    rustWall,
    rustWallNormal: rustMaps.normal,
    rustWallRoughness: rustMaps.roughness,
    obsidianWall,
    obsidianWallNormal: obsidianMaps.normal,
    obsidianWallRoughness: obsidianMaps.roughness,
    cyberWall,
    cyberWallNormal: cyberMaps.normal,
    cyberWallRoughness: cyberMaps.roughness,
    doorTech,
    doorTechNormal: doorMaps.normal,
    doorTechRoughness: doorMaps.roughness,
    doorLocked,
    doorLockedNormal: doorLockedMaps.normal,
    floorGrate,
    floorGrateNormal: floorGrateMaps.normal,
    floorGrateRoughness: floorGrateMaps.roughness,
    floorStone,
    floorStoneNormal: floorStoneMaps.normal,
    floorStoneRoughness: floorStoneMaps.roughness,
    floorMetal,
    floorMetalNormal: floorMetalMaps.normal,
    floorMetalRoughness: floorMetalMaps.roughness,
    floorObsidian,
    floorObsidianNormal: floorObsidianMaps.normal,
    floorObsidianRoughness: floorObsidianMaps.roughness,
    ceilingTech,
    ceilingTechNormal: ceilingMaps.normal,
    lavaFloor,
    lavaFloorNormal: lavaMaps.normal,
    acidFloor,
    acidFloorNormal: acidMaps.normal,
    crateTex,
    crateNormal: crateMaps.normal,
    crateRoughness: crateMaps.roughness,
    barrelTex,
    barrelNormal: barrelMaps.normal,
    barrelRoughness: barrelMaps.roughness,
    pillarTex,
    pillarNormal: pillarMaps.normal,
    pillarRoughness: pillarMaps.roughness,
    demonSkin,
    demonSkinNormal: demonSkinMaps.normal,
    demonChitin,
    demonChitinNormal: demonChitinMaps.normal,
    softParticleTex,
    decalScorchTex,
    decalBloodTex,
    dispose: () => {
      techWall.dispose();
      techMaps.normal.dispose();
      techMaps.roughness.dispose();
      hellWall.dispose();
      hellMaps.normal.dispose();
      hellMaps.roughness.dispose();
      reactorWall.dispose();
      reactorMaps.normal.dispose();
      reactorMaps.roughness.dispose();
      rustWall.dispose();
      rustMaps.normal.dispose();
      rustMaps.roughness.dispose();
      obsidianWall.dispose();
      obsidianMaps.normal.dispose();
      obsidianMaps.roughness.dispose();
      cyberWall.dispose();
      cyberMaps.normal.dispose();
      cyberMaps.roughness.dispose();
      doorTech.dispose();
      doorMaps.normal.dispose();
      doorMaps.roughness.dispose();
      doorLocked.dispose();
      doorLockedMaps.normal.dispose();
      doorLockedMaps.roughness.dispose();
      floorGrate.dispose();
      floorGrateMaps.normal.dispose();
      floorGrateMaps.roughness.dispose();
      floorStone.dispose();
      floorStoneMaps.normal.dispose();
      floorStoneMaps.roughness.dispose();
      floorMetal.dispose();
      floorMetalMaps.normal.dispose();
      floorMetalMaps.roughness.dispose();
      floorObsidian.dispose();
      floorObsidianMaps.normal.dispose();
      floorObsidianMaps.roughness.dispose();
      ceilingTech.dispose();
      ceilingMaps.normal.dispose();
      ceilingMaps.roughness.dispose();
      lavaFloor.dispose();
      lavaMaps.normal.dispose();
      lavaMaps.roughness.dispose();
      acidFloor.dispose();
      acidMaps.normal.dispose();
      acidMaps.roughness.dispose();
      crateTex.dispose();
      crateMaps.normal.dispose();
      crateMaps.roughness.dispose();
      barrelTex.dispose();
      barrelMaps.normal.dispose();
      barrelMaps.roughness.dispose();
      pillarTex.dispose();
      pillarMaps.normal.dispose();
      pillarMaps.roughness.dispose();
      demonSkin.dispose();
      demonSkinMaps.normal.dispose();
      demonSkinMaps.roughness.dispose();
      demonChitin.dispose();
      demonChitinMaps.normal.dispose();
      demonChitinMaps.roughness.dispose();
      softParticleTex.dispose();
      decalScorchTex.dispose();
      decalBloodTex.dispose();
    },
  };
}
