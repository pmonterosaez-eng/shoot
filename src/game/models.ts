import * as THREE from 'three';
import { EnemyKind, PickupKind, WeaponId } from './types';
import { RetroTextureSet } from './textures';

export interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  telegraphOrb: THREE.Mesh;
  hitMeshes: THREE.Mesh[];
  baseRadius: number;
  baseHeight: number;
}

export function buildEnemyModel(kind: EnemyKind): EnemyRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hitMeshes: THREE.Mesh[] = [];
  const register = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    hitMeshes.push(m);
    return m;
  };

  // Contact shadow disc grounded at y = 0.02
  const shadowRadius = kind === 'titan' ? 1.45 : kind === 'baron' ? 0.95 : 0.6;
  const shadowGeo = new THREE.CircleGeometry(shadowRadius, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  let head: THREE.Object3D = new THREE.Group();
  let leftArm: THREE.Object3D = new THREE.Group();
  let rightArm: THREE.Object3D = new THREE.Group();
  let leftLeg: THREE.Object3D = new THREE.Group();
  let rightLeg: THREE.Object3D = new THREE.Group();
  let telegraphOrb: THREE.Mesh;
  let baseRadius = 0.55;
  let baseHeight = 1.9;

  if (kind === 'imp') {
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x9b3b24,
      roughness: 0.65,
      metalness: 0.15,
    });
    const chitinMat = new THREE.MeshStandardMaterial({
      color: 0x3b1a14,
      roughness: 0.35,
      metalness: 0.45,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffe044,
      emissive: 0xffaa00,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });

    leftLeg.position.set(-0.2, 0.72, 0);
    rightLeg.position.set(0.2, 0.72, 0);
    const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.24);
    const lLegM = register(new THREE.Mesh(legGeo, skinMat.clone()));
    lLegM.position.y = -0.36;
    const rLegM = register(new THREE.Mesh(legGeo, skinMat.clone()));
    rLegM.position.y = -0.36;
    leftLeg.add(lLegM);
    rightLeg.add(rLegM);
    body.add(leftLeg, rightLeg);

    const torso = register(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.72, 0.38), skinMat.clone()));
    torso.position.y = 1.08;
    body.add(torso);

    const spikeGeo = new THREE.ConeGeometry(0.08, 0.28, 5);
    for (let i = 0; i < 3; i++) {
      const sp = register(new THREE.Mesh(spikeGeo, chitinMat.clone()));
      sp.position.set(0, 0.92 + i * 0.2, -0.22);
      sp.rotation.x = -Math.PI * 0.35;
      body.add(sp);
    }

    head = new THREE.Group();
    head.position.set(0, 1.56, 0.04);
    const skull = register(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.38), skinMat.clone()));
    head.add(skull);
    const eyeGeo = new THREE.BoxGeometry(0.09, 0.06, 0.06);
    const eL = register(new THREE.Mesh(eyeGeo, eyeMat));
    eL.position.set(-0.1, 0.04, 0.19);
    const eR = register(new THREE.Mesh(eyeGeo, eyeMat));
    eR.position.set(0.1, 0.04, 0.19);
    head.add(eL, eR);
    const hornGeo = new THREE.ConeGeometry(0.06, 0.24, 5);
    const hL = register(new THREE.Mesh(hornGeo, chitinMat.clone()));
    hL.position.set(-0.15, 0.24, 0.02);
    hL.rotation.z = 0.35;
    const hR = register(new THREE.Mesh(hornGeo, chitinMat.clone()));
    hR.position.set(0.15, 0.24, 0.02);
    hR.rotation.z = -0.35;
    head.add(hL, hR);
    body.add(head);

    leftArm.position.set(-0.42, 1.35, 0);
    rightArm.position.set(0.42, 1.35, 0);
    const armGeo = new THREE.BoxGeometry(0.2, 0.62, 0.2);
    const lArmM = register(new THREE.Mesh(armGeo, skinMat.clone()));
    lArmM.position.y = -0.24;
    const rArmM = register(new THREE.Mesh(armGeo, skinMat.clone()));
    rArmM.position.y = -0.24;
    leftArm.add(lArmM);
    rightArm.add(rArmM);
    body.add(leftArm, rightArm);

    telegraphOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0, 1.25, 0.55);
    body.add(telegraphOrb);

    baseRadius = 0.52;
    baseHeight = 1.85;
  } else if (kind === 'trooper') {
    // DEMONIO CAZADOR (Horned charred-crimson hunter demon with spiked armor & hellfire lance)
    const charredMat = new THREE.MeshStandardMaterial({
      color: 0x2b1218,
      roughness: 0.52,
      metalness: 0.45,
    });
    const demonSkinMat = new THREE.MeshStandardMaterial({
      color: 0x6e181d,
      roughness: 0.62,
      metalness: 0.18,
    });
    const hellEyeMat = new THREE.MeshStandardMaterial({
      color: 0xff3322,
      emissive: 0xff1100,
      emissiveIntensity: 2.5,
      roughness: 0.15,
    });

    leftLeg.position.set(-0.2, 0.76, 0);
    rightLeg.position.set(0.2, 0.76, 0);
    const legGeo = new THREE.BoxGeometry(0.23, 0.76, 0.26);
    const lL = register(new THREE.Mesh(legGeo, charredMat.clone()));
    lL.position.y = -0.38;
    const rL = register(new THREE.Mesh(legGeo, charredMat.clone()));
    rL.position.y = -0.38;
    leftLeg.add(lL);
    rightLeg.add(rL);
    body.add(leftLeg, rightLeg);

    const chest = register(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.76, 0.44), demonSkinMat.clone()));
    chest.position.y = 1.14;
    const ribCore = register(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.08), hellEyeMat));
    ribCore.position.set(0, 1.16, 0.21);
    body.add(chest, ribCore);

    const pauldronGeo = new THREE.ConeGeometry(0.18, 0.36, 5);
    const pL = register(new THREE.Mesh(pauldronGeo, charredMat.clone()));
    pL.position.set(-0.44, 1.5, 0);
    pL.rotation.z = 0.45;
    const pR = register(new THREE.Mesh(pauldronGeo, charredMat.clone()));
    pR.position.set(0.44, 1.5, 0);
    pR.rotation.z = -0.45;
    body.add(pL, pR);

    head = new THREE.Group();
    head.position.set(0, 1.68, 0.02);
    const skull = register(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), demonSkinMat.clone()));
    const eyeL = register(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.08), hellEyeMat));
    eyeL.position.set(-0.11, 0.05, 0.21);
    const eyeR = register(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.08), hellEyeMat));
    eyeR.position.set(0.11, 0.05, 0.21);
    const hornGeo = new THREE.ConeGeometry(0.07, 0.34, 5);
    const hL = register(new THREE.Mesh(hornGeo, charredMat.clone()));
    hL.position.set(-0.18, 0.28, 0);
    hL.rotation.z = 0.52;
    const hR = register(new THREE.Mesh(hornGeo, charredMat.clone()));
    hR.position.set(0.18, 0.28, 0);
    hR.rotation.z = -0.52;
    head.add(skull, eyeL, eyeR, hL, hR);
    body.add(head);

    leftArm.position.set(-0.46, 1.34, 0);
    const lA = register(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.58, 0.2), demonSkinMat.clone()));
    lA.position.y = -0.24;
    leftArm.add(lA);

    rightArm.position.set(0.46, 1.34, 0.08);
    const rA = register(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.52), demonSkinMat.clone()));
    rA.position.set(0, -0.05, 0.2);
    const lance = register(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.68, 5), charredMat.clone()));
    lance.rotation.x = Math.PI / 2;
    lance.position.set(0, -0.02, 0.55);
    rightArm.add(rA, lance);
    body.add(leftArm, rightArm);

    telegraphOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.14, 0),
      new THREE.MeshBasicMaterial({ color: 0xff2211, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0.46, 1.32, 0.88);
    body.add(telegraphOrb);

    baseRadius = 0.55;
    baseHeight = 1.94;
  } else if (kind === 'cacodemon') {
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xa11a2c,
      roughness: 0.48,
      metalness: 0.28,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x341122,
      roughness: 0.3,
      metalness: 0.55,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x44ffcc,
      emissive: 0x11ffaa,
      emissiveIntensity: 2.3,
      roughness: 0.1,
    });

    const sphere = register(new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 1), shellMat.clone()));
    sphere.position.y = 1.65;
    body.add(sphere);

    const hornGeo = new THREE.ConeGeometry(0.1, 0.38, 5);
    for (let i = -1; i <= 1; i++) {
      const h = register(new THREE.Mesh(hornGeo, plateMat.clone()));
      h.position.set(i * 0.34, 2.3, -0.05);
      h.rotation.z = -i * 0.35;
      body.add(h);
    }

    head = new THREE.Group();
    head.position.set(0, 1.75, 0.62);
    const eye = register(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), eyeMat));
    head.add(eye);
    body.add(head);

    const jaw = register(new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 0.26), plateMat.clone()));
    jaw.position.set(0, 1.35, 0.52);
    body.add(jaw);

    const tentGeo = new THREE.ConeGeometry(0.1, 0.55, 5);
    tentGeo.rotateX(Math.PI);
    leftLeg.position.set(-0.28, 1.05, 0);
    rightLeg.position.set(0.28, 1.05, 0);
    leftArm.position.set(-0.42, 1.15, -0.2);
    rightArm.position.set(0.42, 1.15, -0.2);
    [leftLeg, rightLeg, leftArm, rightArm].forEach((piv) => {
      const t = register(new THREE.Mesh(tentGeo, plateMat.clone()));
      t.position.y = -0.24;
      piv.add(t);
      body.add(piv);
    });

    telegraphOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({ color: 0xff22ee, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0, 1.48, 0.78);
    body.add(telegraphOrb);

    baseRadius = 0.72;
    baseHeight = 2.4;
  } else if (kind === 'baron') {
    const hideMat = new THREE.MeshStandardMaterial({
      color: 0x7a161b,
      roughness: 0.55,
      metalness: 0.2,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x2a2d36,
      roughness: 0.28,
      metalness: 0.85,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffaa22,
      emissive: 0xff4400,
      emissiveIntensity: 2.5,
      roughness: 0.2,
    });

    leftLeg.position.set(-0.34, 1.05, 0);
    rightLeg.position.set(0.34, 1.05, 0);
    const legGeo = new THREE.BoxGeometry(0.36, 1.05, 0.38);
    const lL = register(new THREE.Mesh(legGeo, steelMat.clone()));
    lL.position.y = -0.525;
    const rL = register(new THREE.Mesh(legGeo, steelMat.clone()));
    rL.position.y = -0.525;
    leftLeg.add(lL);
    rightLeg.add(rL);
    body.add(leftLeg, rightLeg);

    const torso = register(new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.08, 0.64), hideMat.clone()));
    torso.position.y = 1.6;
    const core = register(new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), coreMat));
    core.position.set(0, 1.62, 0.28);
    body.add(torso, core);

    const pGeo = new THREE.BoxGeometry(0.42, 0.38, 0.66);
    const pL = register(new THREE.Mesh(pGeo, steelMat.clone()));
    pL.position.set(-0.72, 2.02, 0);
    const pR = register(new THREE.Mesh(pGeo, steelMat.clone()));
    pR.position.set(0.72, 2.02, 0);
    body.add(pL, pR);

    head = new THREE.Group();
    head.position.set(0, 2.34, 0.06);
    const skull = register(new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.5, 0.5), hideMat.clone()));
    const eyeL = register(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), coreMat));
    eyeL.position.set(-0.14, 0.06, 0.25);
    const eyeR = register(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), coreMat));
    eyeR.position.set(0.14, 0.06, 0.25);
    const hornGeo = new THREE.ConeGeometry(0.1, 0.5, 6);
    const hL = register(new THREE.Mesh(hornGeo, steelMat.clone()));
    hL.position.set(-0.26, 0.34, 0);
    hL.rotation.z = 0.55;
    const hR = register(new THREE.Mesh(hornGeo, steelMat.clone()));
    hR.position.set(0.26, 0.34, 0);
    hR.rotation.z = -0.55;
    head.add(skull, eyeL, eyeR, hL, hR);
    body.add(head);

    leftArm.position.set(-0.76, 1.82, 0.05);
    rightArm.position.set(0.76, 1.82, 0.05);
    const armGeo = new THREE.BoxGeometry(0.3, 0.82, 0.34);
    const lA = register(new THREE.Mesh(armGeo, steelMat.clone()));
    lA.position.y = -0.35;
    const rA = register(new THREE.Mesh(armGeo, steelMat.clone()));
    rA.position.y = -0.35;
    leftArm.add(lA);
    rightArm.add(rA);
    body.add(leftArm, rightArm);

    telegraphOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0, 1.68, 0.72);
    body.add(telegraphOrb);

    baseRadius = 0.85;
    baseHeight = 2.75;
  } else {
    // FINAL BOSS: EL TITÁN DEL AVERNO (Massive 12-part cyber-demonic colossus)
    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x26121b,
      roughness: 0.42,
      metalness: 0.55,
    });
    const darkBronzeMat = new THREE.MeshStandardMaterial({
      color: 0x452b18,
      roughness: 0.25,
      metalness: 0.88,
    });
    const magmaMat = new THREE.MeshStandardMaterial({
      color: 0xffdd44,
      emissive: 0xff3b00,
      emissiveIntensity: 2.8,
      roughness: 0.15,
    });

    // Heavy Cyber-Legs (pivoted at hip y = 1.45)
    leftLeg.position.set(-0.52, 1.45, 0);
    rightLeg.position.set(0.52, 1.45, 0);
    const legGeo = new THREE.BoxGeometry(0.54, 1.45, 0.56);
    const lLeg = register(new THREE.Mesh(legGeo, obsidianMat.clone()));
    lLeg.position.y = -0.725;
    const rLeg = register(new THREE.Mesh(legGeo, obsidianMat.clone()));
    rLeg.position.y = -0.725;
    const kneeGeo = new THREE.BoxGeometry(0.6, 0.32, 0.62);
    const lKnee = register(new THREE.Mesh(kneeGeo, darkBronzeMat.clone()));
    lKnee.position.y = -0.5;
    const rKnee = register(new THREE.Mesh(kneeGeo, darkBronzeMat.clone()));
    rKnee.position.y = -0.5;
    leftLeg.add(lLeg, lKnee);
    rightLeg.add(rLeg, rKnee);
    body.add(leftLeg, rightLeg);

    // Massive Ribbed Torso + Glowing Reactor Core
    const torso = register(new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.55, 0.96), obsidianMat.clone()));
    torso.position.y = 2.22;
    const core = register(new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), magmaMat.clone()));
    core.position.set(0, 2.24, 0.42);
    body.add(torso, core);

    // Twin Shoulder Siege-Cannons
    const cannonGeo = new THREE.CylinderGeometry(0.2, 0.26, 1.15, 8);
    cannonGeo.rotateX(Math.PI / 2);
    const pL = register(new THREE.Mesh(cannonGeo, darkBronzeMat.clone()));
    pL.position.set(-1.05, 2.95, 0.2);
    const pR = register(new THREE.Mesh(cannonGeo, darkBronzeMat.clone()));
    pR.position.set(1.05, 2.95, 0.2);
    body.add(pL, pR);

    // Crowned Horned Titan Skull
    head = new THREE.Group();
    head.position.set(0, 3.3, 0.1);
    const skull = register(new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.72, 0.72), obsidianMat.clone()));
    const eyeL = register(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.1), magmaMat.clone()));
    eyeL.position.set(-0.2, 0.1, 0.36);
    const eyeR = register(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.1), magmaMat.clone()));
    eyeR.position.set(0.2, 0.1, 0.36);
    const hornGeo = new THREE.ConeGeometry(0.15, 0.85, 6);
    const hL = register(new THREE.Mesh(hornGeo, darkBronzeMat.clone()));
    hL.position.set(-0.42, 0.52, -0.05);
    hL.rotation.z = 0.65;
    const hR = register(new THREE.Mesh(hornGeo, darkBronzeMat.clone()));
    hR.position.set(0.42, 0.52, -0.05);
    hR.rotation.z = -0.65;
    const crown = register(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 5), magmaMat.clone()));
    crown.position.set(0, 0.56, 0.1);
    head.add(skull, eyeL, eyeR, hL, hR, crown);
    body.add(head);

    // Dual Siege Gauntlet Arms
    leftArm.position.set(-1.12, 2.55, 0.08);
    rightArm.position.set(1.12, 2.55, 0.08);
    const armGeo = new THREE.BoxGeometry(0.44, 1.18, 0.48);
    const lA = register(new THREE.Mesh(armGeo, darkBronzeMat.clone()));
    lA.position.y = -0.5;
    const rA = register(new THREE.Mesh(armGeo, darkBronzeMat.clone()));
    rA.position.y = -0.5;
    leftArm.add(lA);
    rightArm.add(rA);
    body.add(leftArm, rightArm);

    telegraphOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.48, 0),
      new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0, 2.35, 1.02);
    body.add(telegraphOrb);

    baseRadius = 1.25;
    baseHeight = 3.95;
  }

  return {
    root,
    body,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    telegraphOrb,
    hitMeshes,
    baseRadius,
    baseHeight,
  };
}

export function buildWeaponViewmodels(): Record<WeaponId, THREE.Group> {
  const gunSteel = new THREE.MeshStandardMaterial({
    color: 0x3b424d,
    roughness: 0.25,
    metalness: 0.88,
  });
  const darkPolymer = new THREE.MeshStandardMaterial({
    color: 0x1a1c20,
    roughness: 0.75,
    metalness: 0.2,
  });
  const brightSteel = new THREE.MeshStandardMaterial({
    color: 0x8e99aa,
    roughness: 0.2,
    metalness: 0.92,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb8862b,
    roughness: 0.3,
    metalness: 0.85,
  });

  // 1. Chainsaw (Motosierra)
  const chainsaw = new THREE.Group();
  const csBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.14, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xcc4411, roughness: 0.45, metalness: 0.35 }),
  );
  csBody.position.set(0, -0.03, -0.1);
  const csHandle = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.03), darkPolymer);
  csHandle.position.set(0, 0.07, -0.1);
  const csBlade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.085, 0.56), brightSteel);
  csBlade.position.set(0, -0.01, -0.48);
  chainsaw.add(csBody, csHandle, csBlade);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.022, 0.03), gunSteel);
    tooth.position.set(0, 0.04, -0.25 - i * 0.085);
    chainsaw.add(tooth);
  }

  // 2. Pistol (Pistola)
  const pistol = new THREE.Group();
  const piSlide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.36), brightSteel);
  piSlide.position.set(0, 0.03, -0.25);
  const piFrame = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.055, 0.28), darkPolymer);
  piFrame.position.set(0, -0.015, -0.2);
  const piSight = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.016, 0.016),
    new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
  );
  piSight.position.set(0, 0.068, -0.41);
  pistol.add(piSlide, piFrame, piSight);

  // 3. Combat Shotgun (Escopeta)
  const shotgun = new THREE.Group();
  const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.65, 8), gunSteel);
  barrel1.rotation.x = Math.PI / 2;
  barrel1.position.set(-0.022, 0.02, -0.35);
  const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.65, 8), gunSteel);
  barrel2.rotation.x = Math.PI / 2;
  barrel2.position.set(0.022, 0.02, -0.35);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.34), darkPolymer);
  receiver.position.set(0, -0.02, -0.08);
  const pump = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.075, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.65, metalness: 0.1 }),
  );
  pump.position.set(0, -0.03, -0.36);
  const sight = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.02, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xff9922 }),
  );
  sight.position.set(0, 0.055, -0.64);
  shotgun.add(barrel1, barrel2, receiver, pump, sight);

  // 4. Super Shotgun (Super Escopeta doble cañón)
  const supershotgun = new THREE.Group();
  const sBarrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.56, 10), brightSteel);
  sBarrelL.rotation.x = Math.PI / 2;
  sBarrelL.position.set(-0.038, 0.025, -0.34);
  const sBarrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.56, 10), brightSteel);
  sBarrelR.rotation.x = Math.PI / 2;
  sBarrelR.position.set(0.038, 0.025, -0.34);
  const sBreech = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.09, 0.22), brassMat);
  sBreech.position.set(0, -0.01, -0.14);
  const sFore = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.065, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x592611, roughness: 0.7 }),
  );
  sFore.position.set(0, -0.025, -0.34);
  supershotgun.add(sBarrelL, sBarrelR, sBreech, sFore);

  // 5. Chaingun (Ametralladora rotatoria)
  const chaingun = new THREE.Group();
  const cgHousing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.3), darkPolymer);
  cgHousing.position.set(0, -0.02, -0.14);
  const cgSpinner = new THREE.Group();
  cgSpinner.name = 'chaingun_spinner';
  cgSpinner.position.set(0, 0.015, -0.44);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 6), brightSteel);
    b.rotation.x = Math.PI / 2;
    b.position.set(Math.cos(ang) * 0.042, Math.sin(ang) * 0.042, 0);
    cgSpinner.add(b);
  }
  const cgCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.05, 10), brassMat);
  cgCollar.rotation.x = Math.PI / 2;
  cgCollar.position.set(0, 0, -0.14);
  cgSpinner.add(cgCollar);
  chaingun.add(cgHousing, cgSpinner);

  // 6. Rocket Launcher (Lanzacohetes)
  const rocket = new THREE.Group();
  const oliveMat = new THREE.MeshStandardMaterial({
    color: 0x3b4931,
    roughness: 0.55,
    metalness: 0.45,
  });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.72, 12), oliveMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0.01, -0.28);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.078, 0.12, 12), gunSteel);
  bell.rotation.x = Math.PI / 2;
  bell.position.set(0, 0.01, -0.64);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.078, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0xd98b18, roughness: 0.4, metalness: 0.3 }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.set(0, 0.01, -0.46);
  const scope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.18), darkPolymer);
  scope.position.set(-0.07, 0.08, -0.2);
  rocket.add(tube, bell, band, scope);

  // 7. Plasma Rifle (Rifle de Plasma)
  const plasma = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.56), darkPolymer);
  pBody.position.set(0, -0.02, -0.22);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.04, 0.58), gunSteel);
  railL.position.set(-0.048, 0.03, -0.34);
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.04, 0.58), gunSteel);
  railR.position.set(0.048, 0.03, -0.34);
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.055, 0.42),
    new THREE.MeshStandardMaterial({
      color: 0x22eeff,
      emissive: 0x00ccff,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    }),
  );
  core.position.set(0, 0.03, -0.32);
  const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.03), gunSteel);
  fin1.position.set(0, 0.02, -0.45);
  plasma.add(pBody, railL, railR, core, fin1);

  // 8. BFG-9000
  const bfg = new THREE.Group();
  const bfgBody = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.17, 0.58), gunSteel);
  bfgBody.position.set(0, -0.02, -0.26);
  const bfgCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.075, 0),
    new THREE.MeshStandardMaterial({
      color: 0x44ff77,
      emissive: 0x11ff44,
      emissiveIntensity: 2.8,
      roughness: 0.1,
    }),
  );
  bfgCore.position.set(0, 0.04, -0.45);
  const bfgProngL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.28), darkPolymer);
  bfgProngL.position.set(-0.085, 0.02, -0.52);
  const bfgProngR = bfgProngL.clone();
  bfgProngR.position.x = 0.085;
  const bfgCoil = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 14), brassMat);
  bfgCoil.position.set(0, 0.01, -0.48);
  bfg.add(bfgBody, bfgCore, bfgProngL, bfgProngR, bfgCoil);

  return { chainsaw, pistol, shotgun, supershotgun, chaingun, rocket, plasma, bfg };
}

export function buildBarrelModel(textures: RetroTextureSet): THREE.Group {
  const group = new THREE.Group();
  const drumMat = new THREE.MeshStandardMaterial({
    map: textures.barrelTex,
    roughness: 0.5,
    metalness: 0.55,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x25282e,
    roughness: 0.3,
    metalness: 0.8,
  });

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 12), drumMat);
  drum.position.y = 0.575;
  drum.castShadow = true;
  drum.receiveShadow = true;

  const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.035, 6, 12), rimMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = 1.14;

  const botRim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.035, 6, 12), rimMat);
  botRim.rotation.x = Math.PI / 2;
  botRim.position.y = 0.04;

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: 0x992200, emissiveIntensity: 0.8 }),
  );
  cap.position.set(0.15, 1.16, 0.1);

  group.add(drum, topRim, botRim, cap);
  return group;
}

export function buildPickupModel(kind: PickupKind): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'health') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.42, 0.44),
      new THREE.MeshStandardMaterial({ color: 0xe6e8ec, roughness: 0.4, metalness: 0.15 }),
    );
    box.position.y = 0.35;
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xdd2222,
      emissive: 0x880000,
      emissiveIntensity: 0.9,
    });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.46), crossMat);
    c1.position.y = 0.35;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.28, 0.46), crossMat);
    c2.position.y = 0.35;
    group.add(box, c1, c2);
  } else if (kind === 'armor') {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.58, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2368cc, roughness: 0.3, metalness: 0.75 }),
    );
    plate.position.y = 0.42;
    const shoulderL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.2, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x18478a, roughness: 0.35, metalness: 0.8 }),
    );
    shoulderL.position.set(-0.28, 0.62, 0);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.28;
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x44eeff, emissive: 0x11aaff, emissiveIntensity: 1.5 }),
    );
    core.position.y = 0.46;
    group.add(plate, shoulderL, shoulderR, core);
  } else if (kind === 'ammo') {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.36, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x4b5333, roughness: 0.6, metalness: 0.35 }),
    );
    crate.position.y = 0.28;
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.08, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xd9a11e, roughness: 0.35, metalness: 0.7 }),
    );
    strap.position.y = 0.34;
    const shells = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4 }),
    );
    shells.position.y = 0.48;
    group.add(crate, strap, shells);
  } else if (kind === 'key') {
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.56, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xff2233,
        emissive: 0xcc0011,
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0.6,
      }),
    );
    card.position.y = 0.65;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.14, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xffcc33, roughness: 0.25, metalness: 0.9 }),
    );
    frame.position.y = 0.88;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.03, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xff4455 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    group.add(card, frame, ring);
  } else if (kind === 'supershotgun_gun') {
    const gun = buildWeaponViewmodels().supershotgun;
    gun.scale.setScalar(1.35);
    gun.position.set(0, 0.55, 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xff8822, emissive: 0x993300, emissiveIntensity: 1.2 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  } else if (kind === 'chaingun_gun') {
    const gun = buildWeaponViewmodels().chaingun;
    gun.scale.setScalar(1.35);
    gun.position.set(0, 0.55, 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0x996600, emissiveIntensity: 1.2 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  } else if (kind === 'plasma_gun') {
    const gun = buildWeaponViewmodels().plasma;
    gun.scale.setScalar(1.45);
    gun.position.set(0, 0.55, 0.32);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x00bbff, emissive: 0x0066aa, emissiveIntensity: 1.2 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  } else if (kind === 'rocket_gun') {
    const gun = buildWeaponViewmodels().rocket;
    gun.scale.setScalar(1.35);
    gun.position.set(0, 0.55, 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xff6611, emissive: 0xaa3300, emissiveIntensity: 1.2 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  } else if (kind === 'bfg_gun') {
    const gun = buildWeaponViewmodels().bfg;
    gun.scale.setScalar(1.3);
    gun.position.set(0, 0.55, 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.52, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x33ff66, emissive: 0x00aa33, emissiveIntensity: 1.6 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  }

  return group;
}

export function buildExitPortal(): { group: THREE.Group; ring: THREE.Mesh; core: THREE.Mesh } {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.15, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.4, metalness: 0.75 }),
  );
  base.position.y = 0.14;

  const archL = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 2.4, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x3b404b, roughness: 0.35, metalness: 0.8 }),
  );
  archL.position.set(-0.85, 1.3, 0);

  const archR = archL.clone();
  archR.position.x = 0.85;

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.32, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x22252c, roughness: 0.4, metalness: 0.8 }),
  );
  lintel.position.set(0, 2.55, 0);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.07, 8, 20),
    new THREE.MeshStandardMaterial({
      color: 0x33ff99,
      emissive: 0x11cc66,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    }),
  );
  ring.position.set(0, 1.38, 0);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x44ffaa,
      emissiveIntensity: 2.8,
      roughness: 0.1,
    }),
  );
  core.position.set(0, 1.38, 0);

  group.add(base, archL, archR, lintel, ring, core);
  return { group, ring, core };
}
