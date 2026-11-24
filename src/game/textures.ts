import * as THREE from 'three';

export interface RetroTextureSet {
  techWall: THREE.CanvasTexture;
  hellWall: THREE.CanvasTexture;
  reactorWall: THREE.CanvasTexture;
  rustWall: THREE.CanvasTexture;
  obsidianWall: THREE.CanvasTexture;
  cyberWall: THREE.CanvasTexture;
  doorTech: THREE.CanvasTexture;
  doorLocked: THREE.CanvasTexture;
  floorGrate: THREE.CanvasTexture;
  floorStone: THREE.CanvasTexture;
  floorMetal: THREE.CanvasTexture;
  floorObsidian: THREE.CanvasTexture;
  ceilingTech: THREE.CanvasTexture;
  lavaFloor: THREE.CanvasTexture;
  acidFloor: THREE.CanvasTexture;
  crateTex: THREE.CanvasTexture;
  barrelTex: THREE.CanvasTexture;
  pillarTex: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w = 64, h = 64): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function finalizeRetroTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function hash2(x: number, y: number, seed = 13): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function createRetroTextures(maxAnisotropy: number): RetroTextureSet {
  // 1. Tech Bulkhead Wall (#)
  const [cTech, gTech] = makeCanvas(64, 64);
  gTech.fillStyle = '#383d47';
  gTech.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const n = hash2(x, y, 1);
      if (n > 0.72) {
        gTech.fillStyle = '#444b57';
        gTech.fillRect(x, y, 1, 1);
      } else if (n < 0.22) {
        gTech.fillStyle = '#282c34';
        gTech.fillRect(x, y, 1, 1);
      }
    }
  }
  gTech.fillStyle = '#1b1e24';
  gTech.fillRect(0, 0, 64, 2);
  gTech.fillRect(0, 62, 64, 2);
  gTech.fillRect(0, 0, 2, 64);
  gTech.fillRect(31, 0, 2, 64);
  gTech.fillStyle = '#5f6878';
  gTech.fillRect(2, 2, 29, 1);
  gTech.fillRect(33, 2, 29, 1);
  for (let x = 0; x < 64; x += 8) {
    gTech.fillStyle = '#d48a17';
    gTech.fillRect(x, 54, 4, 5);
    gTech.fillStyle = '#191a1d';
    gTech.fillRect(x + 4, 54, 4, 5);
  }
  gTech.fillStyle = '#17191f';
  gTech.fillRect(8, 16, 18, 22);
  gTech.fillRect(38, 16, 18, 22);
  for (let vy = 19; vy < 36; vy += 4) {
    gTech.fillStyle = '#2b303a';
    gTech.fillRect(10, vy, 14, 2);
    gTech.fillRect(40, vy, 14, 2);
  }
  gTech.fillStyle = '#ff6a22';
  gTech.fillRect(25, 8, 4, 3);
  gTech.fillRect(54, 8, 4, 3);

  // 2. Hellstone / Blood Brick Wall (%)
  const [cHell, gHell] = makeCanvas(64, 64);
  gHell.fillStyle = '#241414';
  gHell.fillRect(0, 0, 64, 64);
  const brickH = 16;
  const brickW = 32;
  for (let row = 0; row < 4; row++) {
    const offset = (row % 2) * 16;
    for (let col = -1; col < 3; col++) {
      const bx = col * brickW + offset;
      const by = row * brickH;
      const tone = hash2(col + 5, row, 2);
      const baseR = Math.floor(68 + tone * 26);
      const baseG = Math.floor(28 + tone * 14);
      const baseB = Math.floor(26 + tone * 12);
      gHell.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
      gHell.fillRect(bx + 1, by + 1, brickW - 2, brickH - 2);
      gHell.fillStyle = `rgb(${baseR + 18},${baseG + 10},${baseB + 8})`;
      gHell.fillRect(bx + 1, by + 1, brickW - 2, 2);
      for (let py = by + 2; py < by + brickH - 2; py++) {
        for (let px = bx + 2; px < bx + brickW - 2; px++) {
          const g = hash2(px, py, 9);
          if (g > 0.8) {
            gHell.fillStyle = '#1b0d0d';
            gHell.fillRect(px, py, 1, 1);
          } else if (g < 0.08) {
            gHell.fillStyle = '#7c241e';
            gHell.fillRect(px, py, 2, 1);
          }
        }
      }
    }
  }
  gHell.fillStyle = '#ff3b1f';
  gHell.fillRect(30, 20, 4, 24);
  gHell.fillRect(22, 28, 20, 4);
  gHell.fillStyle = '#ffaa44';
  gHell.fillRect(31, 29, 2, 2);

  // 3. Reactor Conduit Wall (&)
  const [cReact, gReact] = makeCanvas(64, 64);
  gReact.fillStyle = '#25262b';
  gReact.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (hash2(x, y, 4) > 0.65) {
        gReact.fillStyle = '#31333b';
        gReact.fillRect(x, y, 1, 1);
      }
    }
  }
  gReact.fillStyle = '#121316';
  gReact.fillRect(10, 4, 12, 56);
  gReact.fillRect(42, 4, 12, 56);
  gReact.fillStyle = '#c43112';
  gReact.fillRect(12, 6, 8, 52);
  gReact.fillRect(44, 6, 8, 52);
  gReact.fillStyle = '#ff8c24';
  gReact.fillRect(14, 6, 4, 52);
  gReact.fillRect(46, 6, 4, 52);
  gReact.fillStyle = '#3e424c';
  for (let y = 14; y < 58; y += 16) {
    gReact.fillRect(8, y, 16, 4);
    gReact.fillRect(40, y, 16, 4);
  }

  // 4. Corroded Rust / Olive Bunker Wall ($)
  const [cRust, gRust] = makeCanvas(64, 64);
  gRust.fillStyle = '#473e30';
  gRust.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const n = hash2(x, y, 55);
      if (n > 0.72) {
        gRust.fillStyle = '#5c4b37';
        gRust.fillRect(x, y, 1, 1);
      } else if (n < 0.25) {
        gRust.fillStyle = '#33291e';
        gRust.fillRect(x, y, 1, 1);
      }
    }
  }
  gRust.fillStyle = '#292218';
  gRust.fillRect(0, 20, 64, 3);
  gRust.fillRect(0, 44, 64, 3);
  gRust.fillRect(20, 0, 3, 64);
  gRust.fillRect(44, 0, 3, 64);
  gRust.fillStyle = '#739137';
  gRust.fillRect(4, 50, 14, 6);
  gRust.fillRect(26, 50, 14, 6);
  gRust.fillRect(48, 50, 12, 6);

  // 5. Obsidian Arcane Wall (@)
  const [cObs, gObs] = makeCanvas(64, 64);
  gObs.fillStyle = '#181421';
  gObs.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) {
    for (let x = 0; x < 64; x += 2) {
      const n = hash2(x, y, 71);
      if (n > 0.78) {
        gObs.fillStyle = '#271f36';
        gObs.fillRect(x, y, 2, 2);
      } else if (n < 0.14) {
        gObs.fillStyle = '#100c17';
        gObs.fillRect(x, y, 2, 2);
      }
    }
  }
  gObs.fillStyle = '#6e1930';
  gObs.fillRect(0, 30, 64, 4);
  gObs.fillStyle = '#d9385a';
  gObs.fillRect(12, 12, 4, 40);
  gObs.fillRect(48, 12, 4, 40);
  gObs.fillStyle = '#ff8866';
  gObs.fillRect(13, 28, 2, 8);
  gObs.fillRect(49, 28, 2, 8);

  // 6. Cyber Vault Wall (=)
  const [cCyb, gCyb] = makeCanvas(64, 64);
  gCyb.fillStyle = '#1b222c';
  gCyb.fillRect(0, 0, 64, 64);
  gCyb.fillStyle = '#273140';
  gCyb.fillRect(4, 4, 56, 56);
  gCyb.fillStyle = '#121820';
  gCyb.fillRect(10, 10, 44, 44);
  gCyb.fillStyle = '#0e7490';
  gCyb.fillRect(16, 16, 32, 4);
  gCyb.fillRect(16, 44, 32, 4);
  gCyb.fillRect(16, 20, 4, 24);
  gCyb.fillRect(44, 20, 4, 24);
  gCyb.fillStyle = '#22d3ee';
  gCyb.fillRect(28, 28, 8, 8);

  // 7. Tech Door
  const [cDoor, gDoor] = makeCanvas(64, 64);
  gDoor.fillStyle = '#3c434f';
  gDoor.fillRect(0, 0, 64, 64);
  gDoor.fillStyle = '#22262e';
  gDoor.fillRect(4, 4, 56, 56);
  gDoor.fillStyle = '#4c5564';
  gDoor.fillRect(8, 8, 22, 48);
  gDoor.fillRect(34, 8, 22, 48);
  gDoor.fillStyle = '#1b1e24';
  gDoor.fillRect(30, 4, 4, 56);
  gDoor.fillStyle = '#22ff88';
  gDoor.fillRect(16, 26, 6, 10);
  gDoor.fillRect(42, 26, 6, 10);

  // 8. Locked Crimson Keycard Door
  const [cLock, gLock] = makeCanvas(64, 64);
  gLock.drawImage(cDoor, 0, 0);
  gLock.fillStyle = '#991818';
  gLock.fillRect(0, 22, 64, 20);
  gLock.fillStyle = '#ff2e2e';
  gLock.fillRect(16, 26, 6, 10);
  gLock.fillRect(42, 26, 6, 10);
  gLock.fillStyle = '#ffbb33';
  gLock.fillRect(26, 27, 12, 10);
  gLock.fillStyle = '#1a0808';
  gLock.fillRect(30, 30, 4, 4);

  // 9. Floor Grate
  const [cFloorG, gFloorG] = makeCanvas(64, 64);
  gFloorG.fillStyle = '#1d2026';
  gFloorG.fillRect(0, 0, 64, 64);
  gFloorG.fillStyle = '#2c313b';
  for (let i = 0; i < 64; i += 8) {
    gFloorG.fillRect(i, 0, 3, 64);
    gFloorG.fillRect(0, i, 64, 3);
  }
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (hash2(x, y, 7) > 0.85) {
        gFloorG.fillStyle = '#3a414e';
        gFloorG.fillRect(x, y, 1, 1);
      }
    }
  }

  // 10. Floor Stone
  const [cFloorS, gFloorS] = makeCanvas(64, 64);
  gFloorS.fillStyle = '#231b1a';
  gFloorS.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 16) {
    for (let x = 0; x < 64; x += 16) {
      const shade = Math.floor(34 + hash2(x, y, 19) * 16);
      gFloorS.fillStyle = `rgb(${shade + 6},${shade},${shade - 2})`;
      gFloorS.fillRect(x + 1, y + 1, 14, 14);
    }
  }

  // 11. Floor Metal Plate
  const [cFloorM, gFloorM] = makeCanvas(64, 64);
  gFloorM.fillStyle = '#232830';
  gFloorM.fillRect(0, 0, 64, 64);
  gFloorM.fillStyle = '#323945';
  gFloorM.fillRect(2, 2, 28, 28);
  gFloorM.fillRect(34, 34, 28, 28);
  gFloorM.fillStyle = '#2a303a';
  gFloorM.fillRect(34, 2, 28, 28);
  gFloorM.fillRect(2, 34, 28, 28);
  gFloorM.fillStyle = '#4e5869';
  for (let y = 8; y < 64; y += 16) {
    for (let x = 8; x < 64; x += 16) {
      gFloorM.fillRect(x, y, 3, 2);
    }
  }

  // 12. Floor Obsidian Cracked
  const [cFloorO, gFloorO] = makeCanvas(64, 64);
  gFloorO.fillStyle = '#15121a';
  gFloorO.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 16) {
    for (let x = 0; x < 64; x += 16) {
      const s = Math.floor(20 + hash2(x, y, 91) * 12);
      gFloorO.fillStyle = `rgb(${s + 4},${s},${s + 8})`;
      gFloorO.fillRect(x + 1, y + 1, 14, 14);
    }
  }
  gFloorO.fillStyle = '#5c1922';
  gFloorO.fillRect(0, 31, 64, 2);
  gFloorO.fillRect(31, 0, 2, 64);

  // 13. Ceiling Tech
  const [cCeil, gCeil] = makeCanvas(64, 64);
  gCeil.fillStyle = '#14161b';
  gCeil.fillRect(0, 0, 64, 64);
  gCeil.fillStyle = '#1f232c';
  gCeil.fillRect(4, 4, 56, 56);
  gCeil.fillStyle = '#0e1014';
  gCeil.fillRect(10, 10, 44, 44);
  gCeil.fillStyle = '#4b5e7a';
  gCeil.fillRect(24, 16, 16, 32);
  gCeil.fillStyle = '#99b8e0';
  gCeil.fillRect(28, 20, 8, 24);

  // 14. Lava Floor
  const [cLava, gLava] = makeCanvas(64, 64);
  gLava.fillStyle = '#8a1c06';
  gLava.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) {
    for (let x = 0; x < 64; x += 2) {
      const v = Math.sin(x * 0.25) * Math.cos(y * 0.25) + hash2(x, y, 31) * 0.7;
      if (v > 0.8) gLava.fillStyle = '#ffdd44';
      else if (v > 0.35) gLava.fillStyle = '#ff6a12';
      else if (v < -0.2) gLava.fillStyle = '#440b03';
      else gLava.fillStyle = '#bd2a09';
      gLava.fillRect(x, y, 2, 2);
    }
  }

  // 15. Toxic Acid Floor
  const [cAcid, gAcid] = makeCanvas(64, 64);
  gAcid.fillStyle = '#154d14';
  gAcid.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) {
    for (let x = 0; x < 64; x += 2) {
      const v = Math.sin(x * 0.28 + 1) * Math.cos(y * 0.22) + hash2(x, y, 42) * 0.7;
      if (v > 0.85) gAcid.fillStyle = '#a8ff44';
      else if (v > 0.35) gAcid.fillStyle = '#43cc22';
      else if (v < -0.2) gAcid.fillStyle = '#0a260a';
      else gAcid.fillStyle = '#227a18';
      gAcid.fillRect(x, y, 2, 2);
    }
  }

  // 16. Crate Texture
  const [cCrate, gCrate] = makeCanvas(64, 64);
  gCrate.fillStyle = '#6b4d2b';
  gCrate.fillRect(0, 0, 64, 64);
  gCrate.fillStyle = '#4a331a';
  gCrate.fillRect(0, 0, 64, 6);
  gCrate.fillRect(0, 58, 64, 6);
  gCrate.fillRect(0, 0, 6, 64);
  gCrate.fillRect(58, 0, 6, 64);
  gCrate.strokeStyle = '#4a331a';
  gCrate.lineWidth = 5;
  gCrate.beginPath();
  gCrate.moveTo(6, 6);
  gCrate.lineTo(58, 58);
  gCrate.stroke();
  gCrate.fillStyle = '#b98b3e';
  gCrate.fillRect(24, 24, 16, 16);

  // 17. Explosive Barrel Texture
  const [cBarrel, gBarrel] = makeCanvas(64, 64);
  gBarrel.fillStyle = '#434952';
  gBarrel.fillRect(0, 0, 64, 64);
  gBarrel.fillStyle = '#b32419';
  gBarrel.fillRect(0, 14, 64, 36);
  gBarrel.fillStyle = '#e5b822';
  gBarrel.fillRect(0, 26, 64, 12);
  gBarrel.fillStyle = '#18181b';
  for (let x = 4; x < 64; x += 16) {
    gBarrel.fillRect(x, 28, 8, 8);
  }

  // 18. Pillar Texture
  const [cPillar, gPillar] = makeCanvas(64, 64);
  gPillar.fillStyle = '#33363f';
  gPillar.fillRect(0, 0, 64, 64);
  for (let x = 4; x < 64; x += 12) {
    gPillar.fillStyle = '#454a57';
    gPillar.fillRect(x, 0, 6, 64);
    gPillar.fillStyle = '#1f2228';
    gPillar.fillRect(x + 6, 0, 2, 64);
  }
  gPillar.fillStyle = '#c43b1e';
  gPillar.fillRect(0, 6, 64, 4);
  gPillar.fillRect(0, 54, 64, 4);

  const techWall = finalizeRetroTexture(cTech, maxAnisotropy);
  const hellWall = finalizeRetroTexture(cHell, maxAnisotropy);
  const reactorWall = finalizeRetroTexture(cReact, maxAnisotropy);
  const rustWall = finalizeRetroTexture(cRust, maxAnisotropy);
  const obsidianWall = finalizeRetroTexture(cObs, maxAnisotropy);
  const cyberWall = finalizeRetroTexture(cCyb, maxAnisotropy);
  const doorTech = finalizeRetroTexture(cDoor, maxAnisotropy);
  const doorLocked = finalizeRetroTexture(cLock, maxAnisotropy);
  const floorGrate = finalizeRetroTexture(cFloorG, maxAnisotropy, 17, 16);
  const floorStone = finalizeRetroTexture(cFloorS, maxAnisotropy, 17, 16);
  const floorMetal = finalizeRetroTexture(cFloorM, maxAnisotropy, 17, 16);
  const floorObsidian = finalizeRetroTexture(cFloorO, maxAnisotropy, 17, 16);
  const ceilingTech = finalizeRetroTexture(cCeil, maxAnisotropy, 17, 16);
  const lavaFloor = finalizeRetroTexture(cLava, maxAnisotropy, 1, 1);
  const acidFloor = finalizeRetroTexture(cAcid, maxAnisotropy, 1, 1);
  const crateTex = finalizeRetroTexture(cCrate, maxAnisotropy);
  const barrelTex = finalizeRetroTexture(cBarrel, maxAnisotropy);
  const pillarTex = finalizeRetroTexture(cPillar, maxAnisotropy);

  return {
    techWall,
    hellWall,
    reactorWall,
    rustWall,
    obsidianWall,
    cyberWall,
    doorTech,
    doorLocked,
    floorGrate,
    floorStone,
    floorMetal,
    floorObsidian,
    ceilingTech,
    lavaFloor,
    acidFloor,
    crateTex,
    barrelTex,
    pillarTex,
    dispose: () => {
      techWall.dispose();
      hellWall.dispose();
      reactorWall.dispose();
      rustWall.dispose();
      obsidianWall.dispose();
      cyberWall.dispose();
      doorTech.dispose();
      doorLocked.dispose();
      floorGrate.dispose();
      floorStone.dispose();
      floorMetal.dispose();
      floorObsidian.dispose();
      ceilingTech.dispose();
      lavaFloor.dispose();
      acidFloor.dispose();
      crateTex.dispose();
      barrelTex.dispose();
      pillarTex.dispose();
    },
  };
}
