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

export function buildEnemyModel(kind: EnemyKind, textures?: RetroTextureSet): EnemyRig {
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

  // Soft radial contact shadow grounded at y = 0.02
  const shadowRadius = kind === 'titan' ? 1.55 : kind === 'baron' ? 1.0 : 0.68;
  const shadowGeo = new THREE.CircleGeometry(shadowRadius, 32);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    map: textures?.softParticleTex ?? null,
    transparent: true,
    opacity: 0.56,
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

  const skinMap = textures?.demonSkin ?? null;
  const skinNorm = textures?.demonSkinNormal ?? null;
  const chitinMap = textures?.demonChitin ?? null;
  const chitinNorm = textures?.demonChitinNormal ?? null;

  const clawMat = new THREE.MeshStandardMaterial({
    color: 0xd6c7a9,
    roughness: 0.34,
    metalness: 0.15,
  });

  const attachClaws = (parent: THREE.Object3D, yOffset: number, scale = 1) => {
    const clawGeo = new THREE.ConeGeometry(0.024 * scale, 0.14 * scale, 10);
    clawGeo.rotateX(Math.PI * 0.9);
    for (let c = -1; c <= 1; c++) {
      const cl = register(new THREE.Mesh(clawGeo, clawMat));
      cl.position.set(c * 0.042 * scale, yOffset, 0.06 * scale);
      parent.add(cl);
    }
  };

  if (kind === 'imp') {
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: 0x9c3b24,
      map: skinMap,
      normalMap: skinNorm,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.48,
      metalness: 0.08,
      clearcoat: 0.32,
      clearcoatRoughness: 0.42,
    });
    const chitinMat = new THREE.MeshStandardMaterial({
      color: 0x2c1410,
      map: chitinMap,
      normalMap: chitinNorm,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.3,
      metalness: 0.42,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffe455,
      emissive: 0xff9900,
      emissiveIntensity: 2.5,
      roughness: 0.12,
    });

    leftLeg.position.set(-0.2, 0.72, 0);
    rightLeg.position.set(0.2, 0.72, 0);
    const legGeo = new THREE.CapsuleGeometry(0.115, 0.48, 8, 16);
    const lLegM = register(new THREE.Mesh(legGeo, skinMat.clone()));
    lLegM.position.y = -0.36;
    const rLegM = register(new THREE.Mesh(legGeo, skinMat.clone()));
    rLegM.position.y = -0.36;
    leftLeg.add(lLegM);
    rightLeg.add(rLegM);
    body.add(leftLeg, rightLeg);

    const torso = register(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.34, 10, 18), skinMat.clone()));
    torso.scale.set(1.14, 1, 0.78);
    torso.position.y = 1.08;
    body.add(torso);

    // Muscular chest ridges & dorsal spines
    const pecGeo = new THREE.SphereGeometry(0.14, 14, 12);
    pecGeo.scale(1.1, 0.75, 0.65);
    const pecL = register(new THREE.Mesh(pecGeo, skinMat.clone()));
    pecL.position.set(-0.12, 1.22, 0.18);
    const pecR = register(new THREE.Mesh(pecGeo, skinMat.clone()));
    pecR.position.set(0.12, 1.22, 0.18);
    body.add(pecL, pecR);

    const spikeGeo = new THREE.ConeGeometry(0.072, 0.32, 14);
    for (let i = 0; i < 4; i++) {
      const sp = register(new THREE.Mesh(spikeGeo, chitinMat.clone()));
      sp.position.set(0, 0.85 + i * 0.19, -0.22);
      sp.rotation.x = -Math.PI * 0.36;
      body.add(sp);
    }

    head = new THREE.Group();
    head.position.set(0, 1.57, 0.04);
    const skull = register(new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 16), skinMat.clone()));
    skull.scale.set(0.95, 1.04, 1.08);
    const jaw = register(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.18), skinMat.clone()));
    jaw.position.set(0, -0.14, 0.1);
    head.add(skull, jaw);
    // Fangs
    const fangGeo = new THREE.ConeGeometry(0.022, 0.075, 8);
    for (const fx of [-0.065, 0.065]) {
      const fang = register(new THREE.Mesh(fangGeo, clawMat));
      fang.position.set(fx, -0.095, 0.185);
      head.add(fang);
    }
    const eyeGeo = new THREE.SphereGeometry(0.048, 12, 10);
    const eL = register(new THREE.Mesh(eyeGeo, eyeMat));
    eL.position.set(-0.095, 0.045, 0.195);
    const eR = register(new THREE.Mesh(eyeGeo, eyeMat));
    eR.position.set(0.095, 0.045, 0.195);
    head.add(eL, eR);
    const hornGeo = new THREE.ConeGeometry(0.055, 0.28, 14);
    const hL = register(new THREE.Mesh(hornGeo, chitinMat.clone()));
    hL.position.set(-0.14, 0.23, 0.02);
    hL.rotation.z = 0.36;
    const hR = register(new THREE.Mesh(hornGeo, chitinMat.clone()));
    hR.position.set(0.14, 0.23, 0.02);
    hR.rotation.z = -0.36;
    head.add(hL, hR);
    body.add(head);

    leftArm.position.set(-0.4, 1.35, 0);
    rightArm.position.set(0.4, 1.35, 0);
    const armGeo = new THREE.CapsuleGeometry(0.088, 0.42, 8, 14);
    const lArmM = register(new THREE.Mesh(armGeo, skinMat.clone()));
    lArmM.position.y = -0.24;
    const rArmM = register(new THREE.Mesh(armGeo, skinMat.clone()));
    rArmM.position.y = -0.24;
    leftArm.add(lArmM);
    rightArm.add(rArmM);
    attachClaws(leftArm, -0.49, 0.9);
    attachClaws(rightArm, -0.49, 0.9);
    body.add(leftArm, rightArm);

    telegraphOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0, 1.25, 0.55);
    body.add(telegraphOrb);

    baseRadius = 0.52;
    baseHeight = 1.85;
  } else if (kind === 'trooper') {
    const charredMat = new THREE.MeshStandardMaterial({
      color: 0x261116,
      map: chitinMap,
      normalMap: chitinNorm,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughness: 0.32,
      metalness: 0.68,
    });
    const demonSkinMat = new THREE.MeshPhysicalMaterial({
      color: 0x72191e,
      map: skinMap,
      normalMap: skinNorm,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.46,
      metalness: 0.14,
      clearcoat: 0.34,
      clearcoatRoughness: 0.38,
    });
    const hellEyeMat = new THREE.MeshStandardMaterial({
      color: 0xff3b22,
      emissive: 0xff1900,
      emissiveIntensity: 2.6,
      roughness: 0.12,
    });

    leftLeg.position.set(-0.2, 0.76, 0);
    rightLeg.position.set(0.2, 0.76, 0);
    const legGeo = new THREE.CapsuleGeometry(0.125, 0.5, 8, 16);
    const lL = register(new THREE.Mesh(legGeo, charredMat.clone()));
    lL.position.y = -0.38;
    const rL = register(new THREE.Mesh(legGeo, charredMat.clone()));
    rL.position.y = -0.38;
    const kneeGuardGeo = new THREE.BoxGeometry(0.16, 0.14, 0.16);
    const kL = register(new THREE.Mesh(kneeGuardGeo, charredMat.clone()));
    kL.position.set(0, -0.34, 0.09);
    const kR = register(new THREE.Mesh(kneeGuardGeo, charredMat.clone()));
    kR.position.set(0, -0.34, 0.09);
    leftLeg.add(lL, kL);
    rightLeg.add(rL, kR);
    body.add(leftLeg, rightLeg);

    const chest = register(new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.34, 10, 18), demonSkinMat.clone()));
    chest.scale.set(1.16, 1, 0.8);
    chest.position.y = 1.14;
    const armorVest = register(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.44, 16), charredMat.clone()));
    armorVest.scale.set(1.06, 1, 0.76);
    armorVest.position.y = 1.16;
    const ribCore = register(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), hellEyeMat));
    ribCore.scale.set(1, 1.2, 0.45);
    ribCore.position.set(0, 1.18, 0.24);
    body.add(chest, armorVest, ribCore);

    const pauldronGeo = new THREE.ConeGeometry(0.18, 0.4, 16);
    const pL = register(new THREE.Mesh(pauldronGeo, charredMat.clone()));
    pL.position.set(-0.45, 1.5, 0);
    pL.rotation.z = 0.45;
    const pR = register(new THREE.Mesh(pauldronGeo, charredMat.clone()));
    pR.position.set(0.45, 1.5, 0);
    pR.rotation.z = -0.45;
    body.add(pL, pR);

    head = new THREE.Group();
    head.position.set(0, 1.68, 0.02);
    const skull = register(new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 16), demonSkinMat.clone()));
    skull.scale.set(0.95, 1.05, 1.04);
    const brow = register(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.22), charredMat.clone()));
    brow.position.set(0, 0.11, 0.12);
    const eyeGeo = new THREE.SphereGeometry(0.052, 12, 10);
    const eyeL = register(new THREE.Mesh(eyeGeo, hellEyeMat));
    eyeL.position.set(-0.1, 0.04, 0.21);
    const eyeR = register(new THREE.Mesh(eyeGeo, hellEyeMat));
    eyeR.position.set(0.1, 0.04, 0.21);
    const hornGeo = new THREE.ConeGeometry(0.068, 0.38, 14);
    const hL = register(new THREE.Mesh(hornGeo, charredMat.clone()));
    hL.position.set(-0.18, 0.27, 0);
    hL.rotation.z = 0.54;
    const hR = register(new THREE.Mesh(hornGeo, charredMat.clone()));
    hR.position.set(0.18, 0.27, 0);
    hR.rotation.z = -0.54;
    head.add(skull, brow, eyeL, eyeR, hL, hR);
    body.add(head);

    leftArm.position.set(-0.45, 1.34, 0);
    const lA = register(new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.38, 8, 14), demonSkinMat.clone()));
    lA.position.y = -0.24;
    leftArm.add(lA);
    attachClaws(leftArm, -0.48, 0.9);

    rightArm.position.set(0.45, 1.34, 0.08);
    const rA = register(new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 8, 14), demonSkinMat.clone()));
    rA.rotation.x = Math.PI / 2;
    rA.position.set(0, -0.05, 0.2);
    const lance = register(new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.72, 16), charredMat.clone()));
    lance.rotation.x = Math.PI / 2;
    lance.position.set(0, -0.02, 0.58);
    const lanceCoil = register(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 20), hellEyeMat));
    lanceCoil.position.set(0, -0.02, 0.44);
    rightArm.add(rA, lance, lanceCoil);
    body.add(leftArm, rightArm);

    telegraphOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff2211, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0.45, 1.32, 0.94);
    body.add(telegraphOrb);

    baseRadius = 0.55;
    baseHeight = 1.94;
  } else if (kind === 'cacodemon') {
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xa41c2f,
      map: skinMap,
      normalMap: skinNorm,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.36,
      metalness: 0.16,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x2b101e,
      map: chitinMap,
      normalMap: chitinNorm,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughness: 0.26,
      metalness: 0.58,
    });
    const eyeMat = new THREE.MeshPhysicalMaterial({
      color: 0x44ffcc,
      emissive: 0x11ffaa,
      emissiveIntensity: 2.5,
      roughness: 0.05,
      clearcoat: 1.0,
    });

    const sphere = register(new THREE.Mesh(new THREE.SphereGeometry(0.68, 30, 24), shellMat.clone()));
    sphere.position.y = 1.65;
    body.add(sphere);

    const hornGeo = new THREE.ConeGeometry(0.095, 0.42, 14);
    for (let i = -1; i <= 1; i++) {
      const h = register(new THREE.Mesh(hornGeo, plateMat.clone()));
      h.position.set(i * 0.34, 2.32, -0.05);
      h.rotation.z = -i * 0.35;
      body.add(h);
    }

    head = new THREE.Group();
    head.position.set(0, 1.76, 0.62);
    const eyeSocket = register(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 12, 24), plateMat.clone()));
    const eye = register(new THREE.Mesh(new THREE.SphereGeometry(0.18, 22, 18), eyeMat));
    const pupil = register(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0x05080a, roughness: 0.1, metalness: 0.2 }),
      ),
    );
    pupil.scale.set(0.45, 1.35, 0.4);
    pupil.position.z = 0.145;
    head.add(eyeSocket, eye, pupil);
    body.add(head);

    const jaw = register(new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.44, 8, 14), plateMat.clone()));
    jaw.rotation.z = Math.PI / 2;
    jaw.position.set(0, 1.35, 0.52);
    body.add(jaw);
    const cFangGeo = new THREE.ConeGeometry(0.032, 0.12, 10);
    for (let fx = -0.18; fx <= 0.18; fx += 0.09) {
      const f = register(new THREE.Mesh(cFangGeo, clawMat));
      f.position.set(fx, 1.44, 0.6);
      body.add(f);
    }

    const tentGeo = new THREE.ConeGeometry(0.095, 0.58, 14);
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
      new THREE.SphereGeometry(0.22, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff22ee, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0, 1.48, 0.78);
    body.add(telegraphOrb);

    baseRadius = 0.72;
    baseHeight = 2.4;
  } else if (kind === 'baron') {
    const hideMat = new THREE.MeshPhysicalMaterial({
      color: 0x7a171c,
      map: skinMap,
      normalMap: skinNorm,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughness: 0.44,
      metalness: 0.14,
      clearcoat: 0.3,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x262932,
      map: chitinMap,
      normalMap: chitinNorm,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.22,
      metalness: 0.88,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffaa22,
      emissive: 0xff4400,
      emissiveIntensity: 2.6,
      roughness: 0.14,
    });

    leftLeg.position.set(-0.34, 1.05, 0);
    rightLeg.position.set(0.34, 1.05, 0);
    const legGeo = new THREE.CapsuleGeometry(0.18, 0.68, 10, 18);
    const lL = register(new THREE.Mesh(legGeo, steelMat.clone()));
    lL.position.y = -0.52;
    const rL = register(new THREE.Mesh(legGeo, steelMat.clone()));
    rL.position.y = -0.52;
    leftLeg.add(lL);
    rightLeg.add(rL);
    body.add(leftLeg, rightLeg);

    const torso = register(new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.42, 12, 20), hideMat.clone()));
    torso.scale.set(1.18, 1, 0.74);
    torso.position.y = 1.6;
    const core = register(new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), coreMat));
    core.scale.set(1, 1.15, 0.55);
    core.position.set(0, 1.62, 0.3);
    const coreFrame = register(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 10, 24), steelMat.clone()));
    coreFrame.position.set(0, 1.62, 0.32);
    body.add(torso, core, coreFrame);

    const pGeo = new THREE.SphereGeometry(0.29, 16, 14);
    pGeo.scale(1.1, 0.85, 1.15);
    const pL = register(new THREE.Mesh(pGeo, steelMat.clone()));
    pL.position.set(-0.7, 2.02, 0);
    const pR = register(new THREE.Mesh(pGeo, steelMat.clone()));
    pR.position.set(0.7, 2.02, 0);
    body.add(pL, pR);

    head = new THREE.Group();
    head.position.set(0, 2.34, 0.06);
    const skull = register(new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 16), hideMat.clone()));
    skull.scale.set(0.98, 1.02, 1.04);
    const eyeGeo = new THREE.SphereGeometry(0.065, 12, 10);
    const eyeL = register(new THREE.Mesh(eyeGeo, coreMat));
    eyeL.position.set(-0.13, 0.05, 0.26);
    const eyeR = register(new THREE.Mesh(eyeGeo, coreMat));
    eyeR.position.set(0.13, 0.05, 0.26);
    const hornGeo = new THREE.ConeGeometry(0.095, 0.56, 16);
    const hL = register(new THREE.Mesh(hornGeo, steelMat.clone()));
    hL.position.set(-0.26, 0.35, 0);
    hL.rotation.z = 0.58;
    const hR = register(new THREE.Mesh(hornGeo, steelMat.clone()));
    hR.position.set(0.26, 0.35, 0);
    hR.rotation.z = -0.58;
    head.add(skull, eyeL, eyeR, hL, hR);
    body.add(head);

    leftArm.position.set(-0.75, 1.82, 0.05);
    rightArm.position.set(0.75, 1.82, 0.05);
    const armGeo = new THREE.CapsuleGeometry(0.15, 0.54, 10, 16);
    const lA = register(new THREE.Mesh(armGeo, steelMat.clone()));
    lA.position.y = -0.35;
    const rA = register(new THREE.Mesh(armGeo, steelMat.clone()));
    rA.position.y = -0.35;
    leftArm.add(lA);
    rightArm.add(rA);
    attachClaws(leftArm, -0.72, 1.35);
    attachClaws(rightArm, -0.72, 1.35);
    body.add(leftArm, rightArm);

    telegraphOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0 }),
    );
    telegraphOrb.position.set(0, 1.68, 0.72);
    body.add(telegraphOrb);

    baseRadius = 0.85;
    baseHeight = 2.75;
  } else {
    // FINAL BOSS: EL TITÁN DEL AVERNO (Cyber-Demonic Armored Colossus)
    const obsidianMat = new THREE.MeshPhysicalMaterial({
      color: 0x26111c,
      map: chitinMap,
      normalMap: chitinNorm,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.34,
      metalness: 0.62,
      clearcoat: 0.4,
    });
    const darkBronzeMat = new THREE.MeshStandardMaterial({
      color: 0x52341c,
      roughness: 0.2,
      metalness: 0.92,
    });
    const magmaMat = new THREE.MeshStandardMaterial({
      color: 0xffdd44,
      emissive: 0xff3b00,
      emissiveIntensity: 3.0,
      roughness: 0.1,
    });

    leftLeg.position.set(-0.52, 1.45, 0);
    rightLeg.position.set(0.52, 1.45, 0);
    const legGeo = new THREE.CapsuleGeometry(0.28, 0.92, 10, 20);
    const lLeg = register(new THREE.Mesh(legGeo, obsidianMat.clone()));
    lLeg.position.y = -0.72;
    const rLeg = register(new THREE.Mesh(legGeo, obsidianMat.clone()));
    rLeg.position.y = -0.72;
    const kneeGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.32, 18);
    const lKnee = register(new THREE.Mesh(kneeGeo, darkBronzeMat.clone()));
    lKnee.position.y = -0.5;
    const rKnee = register(new THREE.Mesh(kneeGeo, darkBronzeMat.clone()));
    rKnee.position.y = -0.5;
    leftLeg.add(lLeg, lKnee);
    rightLeg.add(rLeg, rKnee);
    body.add(leftLeg, rightLeg);

    const torso = register(new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 0.58, 12, 24), obsidianMat.clone()));
    torso.scale.set(1.18, 1, 0.72);
    torso.position.y = 2.22;
    const core = register(new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), magmaMat.clone()));
    core.scale.set(1, 1.15, 0.55);
    core.position.set(0, 2.24, 0.44);
    const coreRing = register(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 12, 28), darkBronzeMat.clone()));
    coreRing.position.set(0, 2.24, 0.46);
    body.add(torso, core, coreRing);

    // Twin Shoulder Siege-Cannons with glowing muzzle rings
    const cannonGeo = new THREE.CylinderGeometry(0.2, 0.27, 1.24, 20);
    cannonGeo.rotateX(Math.PI / 2);
    const pL = register(new THREE.Mesh(cannonGeo, darkBronzeMat.clone()));
    pL.position.set(-1.05, 2.95, 0.22);
    const pR = register(new THREE.Mesh(cannonGeo, darkBronzeMat.clone()));
    pR.position.set(1.05, 2.95, 0.22);
    const cRingGeo = new THREE.TorusGeometry(0.18, 0.035, 10, 22);
    const crL = register(new THREE.Mesh(cRingGeo, magmaMat.clone()));
    crL.position.set(-1.05, 2.95, 0.82);
    const crR = register(new THREE.Mesh(cRingGeo, magmaMat.clone()));
    crR.position.set(1.05, 2.95, 0.82);
    body.add(pL, pR, crL, crR);

    head = new THREE.Group();
    head.position.set(0, 3.3, 0.1);
    const skull = register(new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 18), obsidianMat.clone()));
    skull.scale.set(0.95, 1.02, 1.04);
    const eyeGeo = new THREE.SphereGeometry(0.09, 14, 12);
    const eyeL = register(new THREE.Mesh(eyeGeo, magmaMat.clone()));
    eyeL.position.set(-0.18, 0.08, 0.36);
    const eyeR = register(new THREE.Mesh(eyeGeo, magmaMat.clone()));
    eyeR.position.set(0.18, 0.08, 0.36);
    const hornGeo = new THREE.ConeGeometry(0.14, 0.92, 16);
    const hL = register(new THREE.Mesh(hornGeo, darkBronzeMat.clone()));
    hL.position.set(-0.42, 0.52, -0.05);
    hL.rotation.z = 0.65;
    const hR = register(new THREE.Mesh(hornGeo, darkBronzeMat.clone()));
    hR.position.set(0.42, 0.52, -0.05);
    hR.rotation.z = -0.65;
    const crown = register(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.56, 16), magmaMat.clone()));
    crown.position.set(0, 0.56, 0.1);
    head.add(skull, eyeL, eyeR, hL, hR, crown);
    body.add(head);

    leftArm.position.set(-1.12, 2.55, 0.08);
    rightArm.position.set(1.12, 2.55, 0.08);
    const armGeo = new THREE.CapsuleGeometry(0.22, 0.78, 10, 18);
    const lA = register(new THREE.Mesh(armGeo, darkBronzeMat.clone()));
    lA.position.y = -0.5;
    const rA = register(new THREE.Mesh(armGeo, darkBronzeMat.clone()));
    rA.position.y = -0.5;
    leftArm.add(lA);
    rightArm.add(rA);
    attachClaws(leftArm, -1.02, 1.8);
    attachClaws(rightArm, -1.02, 1.8);
    body.add(leftArm, rightArm);

    telegraphOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 20, 16),
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

export function buildWeaponViewmodels(withHands = true): Record<WeaponId, THREE.Group> {
  const gunSteel = new THREE.MeshPhysicalMaterial({
    color: 0x3b424e,
    roughness: 0.22,
    metalness: 0.92,
    anisotropy: 0.65,
  });
  const darkPolymer = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.68,
    metalness: 0.22,
  });
  const brightSteel = new THREE.MeshPhysicalMaterial({
    color: 0xa4b0c2,
    roughness: 0.14,
    metalness: 0.96,
    anisotropy: 0.75,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xc99632,
    roughness: 0.2,
    metalness: 0.92,
    anisotropy: 0.6,
  });
  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0x5c2f18,
    roughness: 0.56,
    metalness: 0.08,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1e2229,
    roughness: 0.72,
    metalness: 0.15,
  });
  const armorSleeveMat = new THREE.MeshStandardMaterial({
    color: 0x2d3b2c,
    roughness: 0.45,
    metalness: 0.42,
  });

  const addTacticalGripHand = (
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    rotZ = 0,
    withForearm = true,
  ) => {
    if (!withHands) return;
    const handGrp = new THREE.Group();
    handGrp.position.set(x, y, z);
    handGrp.rotation.z = rotZ;

    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.06, 8, 12), gloveMat);
    palm.rotation.x = Math.PI * 0.35;
    const knucklePlate = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.028, 0.055), gunSteel);
    knucklePlate.position.set(0, 0.02, -0.02);
    handGrp.add(palm, knucklePlate);

    if (withForearm) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.22, 8, 14), armorSleeveMat);
      arm.rotation.x = Math.PI * 0.45;
      arm.position.set(0.025, -0.055, 0.15);
      handGrp.add(arm);
    }
    group.add(handGrp);
  };

  // 1. Chainsaw (Motosierra)
  const chainsaw = new THREE.Group();
  const csBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.082, 0.18, 8, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xd14412, roughness: 0.32, metalness: 0.38, clearcoat: 0.45 }),
  );
  csBody.rotation.x = Math.PI / 2;
  csBody.position.set(0, -0.03, -0.1);
  const csEngineVent = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.08, 0.12), darkPolymer);
  csEngineVent.position.set(0, -0.02, -0.1);
  const csHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 12), darkPolymer);
  csHandle.rotation.z = Math.PI / 2;
  csHandle.position.set(0, 0.075, -0.12);
  const csBlade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.088, 0.58), brightSteel);
  csBlade.position.set(0, -0.01, -0.49);
  const csTip = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.024, 18), brightSteel);
  csTip.rotation.z = Math.PI / 2;
  csTip.position.set(0, -0.01, -0.78);
  chainsaw.add(csBody, csEngineVent, csHandle, csBlade, csTip);
  for (let i = 0; i < 7; i++) {
    const toothTop = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.026, 6), gunSteel);
    toothTop.position.set(0, 0.044, -0.24 - i * 0.082);
    const toothBot = toothTop.clone();
    toothBot.rotation.x = Math.PI;
    toothBot.position.y = -0.064;
    chainsaw.add(toothTop, toothBot);
  }
  addTacticalGripHand(chainsaw, 0, 0.07, -0.12, 0, true);

  // 2. Pistol (Pistola Táctica)
  const pistol = new THREE.Group();
  const piSlide = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.064, 0.38), brightSteel);
  piSlide.position.set(0, 0.032, -0.26);
  const piBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 18), gunSteel);
  piBarrel.rotation.x = Math.PI / 2;
  piBarrel.position.set(0, 0.032, -0.28);
  const piMuzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.055, 16), darkPolymer);
  piMuzzle.rotation.x = Math.PI / 2;
  piMuzzle.position.set(0, 0.032, -0.47);
  const piFrame = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.054, 0.29), darkPolymer);
  piFrame.position.set(0, -0.014, -0.2);
  const piSight = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x33ff88, emissive: 0x22ff66, emissiveIntensity: 2.0 }),
  );
  piSight.position.set(0, 0.07, -0.42);
  pistol.add(piSlide, piBarrel, piMuzzle, piFrame, piSight);
  addTacticalGripHand(pistol, 0, -0.05, -0.14, 0, true);

  // 3. Combat Shotgun (Escopeta Táctica)
  const shotgun = new THREE.Group();
  const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.029, 0.68, 22), gunSteel);
  barrel1.rotation.x = Math.PI / 2;
  barrel1.position.set(0, 0.038, -0.37);
  const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 20), brightSteel);
  magTube.rotation.x = Math.PI / 2;
  magTube.position.set(0, -0.008, -0.32);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.105, 0.34), darkPolymer);
  receiver.position.set(0, -0.015, -0.08);
  const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, 0.11), brightSteel);
  ejectionPort.position.set(0.042, 0.015, -0.1);
  const pump = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.19, 8, 18), walnutMat);
  pump.rotation.x = Math.PI / 2;
  pump.position.set(0, -0.022, -0.38);
  const sight = new THREE.Mesh(
    new THREE.SphereGeometry(0.011, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff8811, emissive: 0xff5500, emissiveIntensity: 2.0 }),
  );
  sight.position.set(0, 0.072, -0.68);
  shotgun.add(barrel1, magTube, receiver, ejectionPort, pump, sight);
  addTacticalGripHand(shotgun, -0.02, -0.055, -0.38, -0.25, false);
  addTacticalGripHand(shotgun, 0.02, -0.06, -0.05, 0, true);

  // 4. Super Shotgun (Super Escopeta doble cañón)
  const supershotgun = new THREE.Group();
  const sBarrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.037, 0.58, 22), brightSteel);
  sBarrelL.rotation.x = Math.PI / 2;
  sBarrelL.position.set(-0.038, 0.026, -0.35);
  const sBarrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.037, 0.58, 22), brightSteel);
  sBarrelR.rotation.x = Math.PI / 2;
  sBarrelR.position.set(0.038, 0.026, -0.35);
  const sRib = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.55), gunSteel);
  sRib.position.set(0, 0.062, -0.34);
  const sBreech = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.092, 0.23), brassMat);
  sBreech.position.set(0, -0.01, -0.14);
  const sFore = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.064, 0.27), walnutMat);
  sFore.position.set(0, -0.024, -0.34);
  supershotgun.add(sBarrelL, sBarrelR, sRib, sBreech, sFore);
  addTacticalGripHand(supershotgun, -0.02, -0.06, -0.35, -0.2, false);
  addTacticalGripHand(supershotgun, 0.02, -0.06, -0.05, 0, true);

  // 5. Chaingun (Ametralladora rotatoria)
  const chaingun = new THREE.Group();
  const cgHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.084, 0.34, 20), darkPolymer);
  cgHousing.rotation.x = Math.PI / 2;
  cgHousing.position.set(0, -0.02, -0.14);
  const cgHandle = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 10, 18, Math.PI), gunSteel);
  cgHandle.position.set(0, 0.07, -0.14);
  const cgSpinner = new THREE.Group();
  cgSpinner.name = 'chaingun_spinner';
  cgSpinner.position.set(0, 0.015, -0.46);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.56, 14), brightSteel);
    b.rotation.x = Math.PI / 2;
    b.position.set(Math.cos(ang) * 0.044, Math.sin(ang) * 0.044, 0);
    cgSpinner.add(b);
  }
  const cgCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.052, 22), brassMat);
  cgCollar.rotation.x = Math.PI / 2;
  cgCollar.position.set(0, 0, -0.16);
  const cgCollarMid = cgCollar.clone();
  cgCollarMid.position.z = 0.06;
  cgSpinner.add(cgCollar, cgCollarMid);
  chaingun.add(cgHousing, cgHandle, cgSpinner);
  addTacticalGripHand(chaingun, 0, -0.07, -0.18, 0, true);

  // 6. Rocket Launcher (Lanzacohetes)
  const rocket = new THREE.Group();
  const oliveMat = new THREE.MeshStandardMaterial({
    color: 0x3a4a2f,
    roughness: 0.42,
    metalness: 0.52,
  });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.74, 24), oliveMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0.01, -0.28);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.078, 0.13, 24), gunSteel);
  bell.rotation.x = Math.PI / 2;
  bell.position.set(0, 0.01, -0.65);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.079, 0.079, 0.065, 24),
    new THREE.MeshStandardMaterial({ color: 0xde8f1a, roughness: 0.34, metalness: 0.45 }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.set(0, 0.01, -0.46);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 16), darkPolymer);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(-0.074, 0.082, -0.2);
  const scopeLens = new THREE.Mesh(
    new THREE.CircleGeometry(0.02, 16),
    new THREE.MeshPhysicalMaterial({ color: 0x33ddff, emissive: 0x006688, emissiveIntensity: 0.8, roughness: 0.05, clearcoat: 1 }),
  );
  scopeLens.position.set(-0.074, 0.082, -0.098);
  rocket.add(tube, bell, band, scope, scopeLens);
  addTacticalGripHand(rocket, 0, -0.07, -0.25, 0, true);

  // 7. Plasma Rifle (Rifle de Plasma)
  const plasma = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.132, 0.58), darkPolymer);
  pBody.position.set(0, -0.02, -0.22);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.042, 0.6), gunSteel);
  railL.position.set(-0.048, 0.03, -0.35);
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.042, 0.6), gunSteel);
  railR.position.set(0.048, 0.03, -0.35);
  const core = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.026, 0.4, 10, 18),
    new THREE.MeshStandardMaterial({
      color: 0x33eeff,
      emissive: 0x00ccff,
      emissiveIntensity: 2.6,
      roughness: 0.08,
    }),
  );
  core.rotation.x = Math.PI / 2;
  core.position.set(0, 0.03, -0.33);
  for (let z = -0.25; z >= -0.53; z -= 0.09) {
    const fin = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.01, 10, 22), brassMat);
    fin.position.set(0, 0.025, z);
    plasma.add(fin);
  }
  plasma.add(pBody, railL, railR, core);
  addTacticalGripHand(plasma, -0.02, -0.07, -0.36, -0.2, false);
  addTacticalGripHand(plasma, 0.02, -0.075, -0.08, 0, true);

  // 8. BFG-9000
  const bfg = new THREE.Group();
  const bfgBody = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.175, 0.6), gunSteel);
  bfgBody.position.set(0, -0.02, -0.26);
  const bfgCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 22, 18),
    new THREE.MeshStandardMaterial({
      color: 0x55ff88,
      emissive: 0x11ff44,
      emissiveIntensity: 3.0,
      roughness: 0.06,
    }),
  );
  bfgCore.position.set(0, 0.04, -0.45);
  const bfgProngL = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.062, 0.3), darkPolymer);
  bfgProngL.position.set(-0.088, 0.02, -0.53);
  const bfgProngR = bfgProngL.clone();
  bfgProngR.position.x = 0.088;
  const bfgCoil = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.018, 14, 28), brassMat);
  bfgCoil.position.set(0, 0.01, -0.48);
  const bfgCoilRear = bfgCoil.clone();
  bfgCoilRear.position.z = -0.32;
  bfg.add(bfgBody, bfgCore, bfgProngL, bfgProngR, bfgCoil, bfgCoilRear);
  addTacticalGripHand(bfg, -0.04, -0.09, -0.22, 0, true);

  return { chainsaw, pistol, shotgun, supershotgun, chaingun, rocket, plasma, bfg };
}

export function buildBarrelModel(textures: RetroTextureSet): THREE.Group {
  const group = new THREE.Group();
  const drumMat = new THREE.MeshStandardMaterial({
    map: textures.barrelTex,
    normalMap: textures.barrelNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: textures.barrelRoughness,
    roughness: 1.0,
    metalness: 0.65,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x242830,
    roughness: 0.24,
    metalness: 0.88,
  });

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 28), drumMat);
  drum.position.y = 0.575;
  drum.castShadow = true;
  drum.receiveShadow = true;

  const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.036, 12, 28), rimMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = 1.14;

  const midRim = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.022, 10, 28), rimMat);
  midRim.rotation.x = Math.PI / 2;
  midRim.position.y = 0.58;

  const botRim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.036, 12, 28), rimMat);
  botRim.rotation.x = Math.PI / 2;
  botRim.position.y = 0.04;

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: 0xaa2200, emissiveIntensity: 1.0 }),
  );
  cap.position.set(0.15, 1.16, 0.1);

  group.add(drum, topRim, midRim, botRim, cap);
  return group;
}

export function buildPickupModel(kind: PickupKind): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'health') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.42, 0.44),
      new THREE.MeshPhysicalMaterial({ color: 0xe6e8ec, roughness: 0.3, metalness: 0.25, clearcoat: 0.3 }),
    );
    box.position.y = 0.35;
    box.castShadow = true;
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xee2222,
      emissive: 0x990000,
      emissiveIntensity: 1.0,
    });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.46), crossMat);
    c1.position.y = 0.35;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.28, 0.46), crossMat);
    c2.position.y = 0.35;
    group.add(box, c1, c2);
  } else if (kind === 'armor') {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.58, 0.3),
      new THREE.MeshPhysicalMaterial({ color: 0x256cd4, roughness: 0.24, metalness: 0.85, clearcoat: 0.35 }),
    );
    plate.position.y = 0.42;
    plate.castShadow = true;
    const shoulderL = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x18478a, roughness: 0.26, metalness: 0.88 }),
    );
    shoulderL.position.set(-0.28, 0.62, 0);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.28;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x44eeff, emissive: 0x11aaff, emissiveIntensity: 1.9 }),
    );
    core.scale.set(1, 1, 0.6);
    core.position.set(0, 0.46, 0.12);
    group.add(plate, shoulderL, shoulderR, core);
  } else if (kind === 'ammo') {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.36, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x4b5333, roughness: 0.5, metalness: 0.48 }),
    );
    crate.position.y = 0.28;
    crate.castShadow = true;
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.08, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xd9a11e, roughness: 0.28, metalness: 0.82 }),
    );
    strap.position.y = 0.34;
    const shells = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.35 }),
    );
    shells.position.y = 0.48;
    group.add(crate, strap, shells);
  } else if (kind === 'key') {
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.56, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xff2233,
        emissive: 0xcc0011,
        emissiveIntensity: 2.0,
        roughness: 0.16,
        metalness: 0.68,
      }),
    );
    card.position.y = 0.65;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.14, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xffcc33, roughness: 0.18, metalness: 0.94 }),
    );
    frame.position.y = 0.88;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.03, 12, 28),
      new THREE.MeshBasicMaterial({ color: 0xff4455 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    group.add(card, frame, ring);
  } else if (kind === 'supershotgun_gun') {
    const gun = buildWeaponViewmodels(false).supershotgun;
    gun.scale.setScalar(1.35);
    gun.position.set(0, 0.55, 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0xff8822, emissive: 0x993300, emissiveIntensity: 1.4 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  } else if (kind === 'chaingun_gun') {
    const gun = buildWeaponViewmodels(false).chaingun;
    gun.scale.setScalar(1.35);
    gun.position.set(0, 0.55, 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0x996600, emissiveIntensity: 1.4 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  } else if (kind === 'plasma_gun') {
    const gun = buildWeaponViewmodels(false).plasma;
    gun.scale.setScalar(1.45);
    gun.position.set(0, 0.55, 0.32);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0x00bbff, emissive: 0x0066aa, emissiveIntensity: 1.4 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  } else if (kind === 'rocket_gun') {
    const gun = buildWeaponViewmodels(false).rocket;
    gun.scale.setScalar(1.35);
    gun.position.set(0, 0.55, 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0xff6611, emissive: 0xaa3300, emissiveIntensity: 1.4 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  } else if (kind === 'bfg_gun') {
    const gun = buildWeaponViewmodels(false).bfg;
    gun.scale.setScalar(1.3);
    gun.position.set(0, 0.55, 0.35);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.52, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0x33ff66, emissive: 0x00aa33, emissiveIntensity: 1.8 }),
    );
    pad.position.y = 0.06;
    group.add(gun, pad);
  }

  return group;
}

export function buildExitPortal(textures?: RetroTextureSet): {
  group: THREE.Group;
  ring: THREE.Mesh;
  core: THREE.Mesh;
} {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x343944,
    map: textures?.techWall ?? null,
    normalMap: textures?.techWallNormal ?? null,
    roughness: 0.32,
    metalness: 0.82,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.22, 0.28, 32), frameMat);
  base.position.y = 0.14;
  base.castShadow = true;
  base.receiveShadow = true;

  const archL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.45, 16), frameMat);
  archL.position.set(-0.88, 1.32, 0);
  archL.castShadow = true;

  const archR = archL.clone();
  archR.position.x = 0.88;

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.34, 0.46), frameMat);
  lintel.position.set(0, 2.58, 0);
  lintel.castShadow = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.075, 16, 44),
    new THREE.MeshStandardMaterial({
      color: 0x33ff99,
      emissive: 0x11dd66,
      emissiveIntensity: 2.5,
      roughness: 0.14,
    }),
  );
  ring.position.set(0, 1.38, 0);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x44ffaa,
      emissiveIntensity: 3.0,
      roughness: 0.06,
    }),
  );
  core.position.set(0, 1.38, 0);

  const portalGlow = new THREE.PointLight(0x33ff99, 2.6, 9.5, 1.7);
  portalGlow.position.set(0, 1.4, 0.45);

  group.add(base, archL, archR, lintel, ring, core, portalGlow);
  return { group, ring, core };
}
