import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { RetroAudio } from './audio';
import { LEVELS } from './levels';
import {
  buildBarrelModel,
  buildEnemyModel,
  buildExitPortal,
  buildPickupModel,
  buildWeaponViewmodels,
  EnemyRig,
} from './models';
import { createRetroTextures, RetroTextureSet } from './textures';
import {
  AutomapEntity,
  BossHudInfo,
  Difficulty,
  EnemyKind,
  GamePhase,
  HudSnapshot,
  LevelDef,
  PickupKind,
  WEAPON_ORDER,
  WEAPON_SPECS,
  WeaponId,
} from './types';

// Reusable scratch math objects (zero GC in loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

interface DoorEntity {
  gx: number;
  gz: number;
  locked: boolean;
  openProgress: number; // 0 = closed, 1 = open
  targetOpen: number;
  closeTimer: number;
  mesh: THREE.Mesh;
  baseY: number;
}

interface SecretWallEntity {
  gx: number;
  gz: number;
  discovered: boolean;
  openProgress: number;
  targetOpen: number;
  mesh: THREE.Mesh;
  baseY: number;
}

interface BarrelEntity {
  id: number;
  x: number;
  z: number;
  hp: number;
  alive: boolean;
  mesh: THREE.Group;
  hitFlash: number;
}

interface PickupEntity {
  id: number;
  kind: PickupKind;
  x: number;
  z: number;
  collected: boolean;
  mesh: THREE.Group;
  phase: number;
}

interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  rig: EnemyRig;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  state: 'patrol' | 'chase' | 'windup' | 'recover' | 'dead';
  stateTimer: number;
  patrolDir: number;
  strafeSign: number;
  strafeTimer: number;
  hitFlash: number;
  squash: number;
  walkPhase: number;
  deathProgress: number;
  enraged?: boolean;
}

interface ProjectileEntity {
  fromPlayer: boolean;
  kind: 'plasma' | 'rocket' | 'bfg' | 'fireball' | 'caco_orb' | 'baron_orb';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  radius: number;
  splashRadius: number;
  life: number;
  mesh: THREE.Mesh;
}

interface ParticleEntity {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
  mesh: THREE.Mesh;
}

interface ShellEntity {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
  mesh: THREE.Mesh;
}

interface DecalEntity {
  mesh: THREE.Mesh;
  timer: number;
}

export class DoomEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private audio = new RetroAudio();

  private isSoftwareGl = false;
  private renderer!: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: RetroTextureSet;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private levelGroup = new THREE.Group();
  private entityGroup = new THREE.Group();
  private weaponMount = new THREE.Group();
  private weaponModels!: Record<WeaponId, THREE.Group>;
  private muzzleLight!: THREE.PointLight;
  private muzzleMesh!: THREE.Mesh;
  private playerLight!: THREE.PointLight;
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private projLights: THREE.PointLight[] = [];
  private ambientPoints: THREE.Points | null = null;
  private ambientBasePos: Float32Array | null = null;
  private shells: ShellEntity[] = [];
  private decals: DecalEntity[] = [];
  private decalCursor = 0;
  private currentFov = 72;
  private cameraRoll = 0;

  // Game state
  private phase: GamePhase = 'title';
  private difficulty: Difficulty = 'normal';
  private sensitivity = 1.0;
  private invertY = false;
  private sectorIndex = 0;
  private level: LevelDef = LEVELS[0];
  private grid: string[][] = [];
  private explored: boolean[][] = [];
  private gridW = 0;
  private gridH = 0;

  // Player state
  private px = 0;
  private py = 1.62;
  private pz = 0;
  private pvx = 0;
  private pvz = 0;
  private yaw = 0;
  private pitch = 0;
  private smoothYaw = 0;
  private smoothPitch = 0;
  private weaponSwayX = 0;
  private weaponSwayY = 0;
  private walkBob = 0;
  private health = 100;
  private maxHealth = 100;
  private armor = 25;
  private maxArmor = 100;
  private ammo = 32;
  private maxAmmo = 120;
  private hasKey = false;
  private unlockedWeapons: WeaponId[] = [...WEAPON_ORDER];
  private activeWeapon: WeaponId = 'shotgun';
  private fireCooldown = 0;
  private weaponRecoil = 0;
  private weaponSwitchDip = 0;
  private muzzleFlashTimer = 0;
  private chaingunSpinSpeed = 0;

  // Stats & Feedback
  private startSectorIndex = 0;
  private kills = 0;
  private totalEnemies = 0;
  private secretsFound = 0;
  private totalSecrets = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private elapsedSeconds = 0;
  private score = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private damageFlash = 0;
  private pickupFlash = 0;
  private faceMood: HudSnapshot['faceMood'] = 'normal';
  private faceMoodTimer = 0;
  private promptText: string | null = null;
  private statusMessage: string | null = null;
  private statusTimer = 0;
  private hazardTickTimer = 0;
  private ambushTriggered = false;
  private bossEnragedTriggered = false;
  private bossVictoryCountdown = 0;
  private cinematicActive = false;

  // Entities
  private doors: DoorEntity[] = [];
  private secretWalls: SecretWallEntity[] = [];
  private barrels: BarrelEntity[] = [];
  private pickups: PickupEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private particles: ParticleEntity[] = [];
  private hasExitPortal = true;
  private exitPos = new THREE.Vector3();
  private exitParts: { group: THREE.Group; ring: THREE.Mesh; core: THREE.Mesh } | null = null;
  private nextEntityId = 1;

  // Input
  private keys = new Set<string>();
  private fireHeld = false;
  private fireJustPressed = false;
  private draggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerLocked = false;
  private gamepadConnected = false;
  private gamepadName: string | null = null;
  private gamepadBlocked = false;
  private activePadIndex: number | null = null;
  private prevPadButtons: boolean[] = [];
  private padFireHeld = false;
  private padMoveX = 0;
  private padMoveY = 0;
  private padSprint = false;

  // Loop
  private frameId = 0;
  private lastTime = 0;
  private hudSyncTimer = 0;
  private disposed = false;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.initRenderer();
    this.initScene();
    this.initPostProcessing();
    this.initParticlePool();
    this.initShellAndDecalPools();
    this.bindEvents();
    this.loadLevel(0, true);
    this.lastTime = performance.now();
    this.startLoop();
    this.emitHud();
  }

  private detectSoftwareGl(): boolean {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|RSX/i.test(gpu);
  }

  private initRenderer(): void {
    this.isSoftwareGl = this.detectSoftwareGl();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);

    this.textures = createRetroTextures(this.renderer.capabilities.getMaxAnisotropy());
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.1, 140);
    this.scene.add(this.camera);

    // Mandatory studio environment map for metallic specular reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.85;
    pmrem.dispose();

    // Lighting rig (warm/cool contrast + soft high-res shadows)
    this.hemiLight = new THREE.HemisphereLight(0x3b4d68, 0x241614, 0.95);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffb37a, 1.5);
    this.keyLight.position.set(16, 26, 12);
    this.keyLight.castShadow = true;
    const shadowSize = this.isSoftwareGl ? 512 : 2048;
    this.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.keyLight.shadow.radius = 2.6;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 75;
    const d = 30;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.025;
    this.scene.add(this.keyLight);

    // Tactical player headlamp + 2 dynamic projectile lights for dramatic corridor illumination
    this.playerLight = new THREE.PointLight(0xffddbb, 1.5, 20, 1.45);
    this.camera.add(this.playerLight);

    for (let i = 0; i < 2; i++) {
      const pl = new THREE.PointLight(0xff7722, 0, 12, 1.6);
      this.scene.add(pl);
      this.projLights.push(pl);
    }

    // First-person weapon mount attached to camera
    this.weaponModels = buildWeaponViewmodels(true);
    Object.values(this.weaponModels).forEach((model) => {
      model.visible = false;
      this.weaponMount.add(model);
    });
    this.weaponModels.shotgun.visible = true;
    this.weaponMount.position.set(0.22, -0.24, -0.28);
    this.camera.add(this.weaponMount);

    // Muzzle flash light & textured radial burst
    this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 14, 1.7);
    this.muzzleLight.position.set(0.22, -0.14, -0.95);
    this.camera.add(this.muzzleLight);

    this.muzzleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({
        color: 0xffdd77,
        map: this.textures.softParticleTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.muzzleMesh.position.set(0.22, -0.15, -0.98);
    this.camera.add(this.muzzleMesh);

    this.scene.add(this.levelGroup);
    this.scene.add(this.entityGroup);
  }

  private initPostProcessing(): void {
    if (this.isSoftwareGl || !this.renderer.capabilities.isWebGL2) {
      return;
    }
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, 2);
    const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w * pr)), Math.max(1, Math.floor(h * pr)), {
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.46, 0.88);
    this.composer.addPass(this.bloomPass);

    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms['offset'].value = 1.12;
    vignettePass.uniforms['darkness'].value = 0.48;
    this.composer.addPass(vignettePass);

    this.composer.addPass(new OutputPass());
  }

  private initParticlePool(): void {
    const geo = new THREE.SphereGeometry(0.068, 10, 8);
    for (let i = 0; i < 110; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff8822, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        gravity: 14,
        mesh,
      });
    }
  }

  private initShellAndDecalPools(): void {
    const shellGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.045, 8);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xd9a83c,
      roughness: 0.22,
      metalness: 0.92,
    });
    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shells.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        life: 0,
        mesh,
      });
    }

    const decalGeo = new THREE.PlaneGeometry(1.15, 1.15);
    decalGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.textures.decalBloodTex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(decalGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.decals.push({ mesh, timer: 0 });
    }
  }

  private clearLevel(): void {
    this.doors = [];
    this.secretWalls = [];
    this.barrels = [];
    this.pickups = [];
    this.enemies = [];
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.projectiles = [];
    this.projLights.forEach((pl) => {
      pl.intensity = 0;
    });
    this.particles.forEach((p) => {
      p.active = false;
      p.mesh.visible = false;
    });
    this.shells.forEach((s) => {
      s.active = false;
      s.mesh.visible = false;
    });
    this.decals.forEach((d) => {
      d.mesh.visible = false;
      d.timer = 0;
    });
    if (this.ambientPoints) {
      this.levelGroup.remove(this.ambientPoints);
      this.ambientPoints.geometry.dispose();
      (this.ambientPoints.material as THREE.Material).dispose();
      this.ambientPoints = null;
      this.ambientBasePos = null;
    }
    this.exitParts = null;

    while (this.levelGroup.children.length > 0) {
      const child = this.levelGroup.children[0];
      this.levelGroup.remove(child);
    }
    while (this.entityGroup.children.length > 0) {
      const child = this.entityGroup.children[0];
      this.entityGroup.remove(child);
    }
  }

  public loadLevel(index: number, resetPlayerStats: boolean): void {
    this.clearLevel();
    this.sectorIndex = index % LEVELS.length;
    this.level = LEVELS[this.sectorIndex];
    const lvl = this.level;
    const cs = lvl.cellSize;
    const wh = lvl.wallHeight;

    this.scene.background = new THREE.Color(lvl.fogColor);
    this.scene.fog = new THREE.FogExp2(lvl.fogColor, lvl.fogDensity);
    this.hemiLight.color.setHex(lvl.ambientSky);
    this.hemiLight.groundColor.setHex(lvl.ambientGround);
    this.keyLight.color.setHex(lvl.keyLightColor);

    this.grid = lvl.grid.map((row) => row.split(''));
    this.gridH = this.grid.length;
    this.gridW = this.grid[0].length;
    this.explored = Array.from({ length: this.gridH }, () => Array(this.gridW).fill(false));

    if (resetPlayerStats) {
      this.health = this.maxHealth;
      this.armor = this.difficulty === 'facil' ? 50 : this.difficulty === 'normal' ? 35 : 15;
      this.ammo = 999;
      this.unlockedWeapons = [...WEAPON_ORDER];
      this.activeWeapon = 'shotgun';
      this.kills = 0;
      this.shotsFired = 0;
      this.shotsHit = 0;
      this.elapsedSeconds = 0;
      this.score = 0;
    } else if (this.health <= 0) {
      this.health = this.maxHealth;
    }

    this.hasKey = false;
    this.hasExitPortal = false;
    this.exitPos.set(-9999, 0, -9999);
    this.ambushTriggered = false;
    this.bossEnragedTriggered = false;
    this.bossVictoryCountdown = 0;
    this.totalEnemies = 0;
    this.kills = 0;
    this.secretsFound = 0;
    this.totalSecrets = 0;
    this.pvx = 0;
    this.pvz = 0;
    this.pitch = 0;
    this.smoothPitch = 0;
    this.weaponSwayX = 0;
    this.weaponSwayY = 0;
    this.fireCooldown = 0;
    this.weaponRecoil = 0;
    this.damageFlash = 0;
    this.pickupFlash = 0;
    this.faceMood = 'normal';
    this.faceMoodTimer = 0;
    this.promptText = null;
    this.setStatus(
      lvl.isBossLevel ? `${lvl.code}: ANIQUILA AL TITÁN DEL AVERNO` : `${lvl.code}: ${lvl.name}`,
      3.0,
    );
    this.switchWeapon(this.activeWeapon, true);

    // Floor & Ceiling planes with full PBR normal + roughness maps
    const mapW = this.gridW * cs;
    const mapH = this.gridH * cs;
    const floorTex =
      lvl.floorTheme === 'grate'
        ? this.textures.floorGrate
        : lvl.floorTheme === 'metal'
        ? this.textures.floorMetal
        : lvl.floorTheme === 'obsidian'
        ? this.textures.floorObsidian
        : this.textures.floorStone;
    const floorNormal =
      lvl.floorTheme === 'grate'
        ? this.textures.floorGrateNormal
        : lvl.floorTheme === 'metal'
        ? this.textures.floorMetalNormal
        : lvl.floorTheme === 'obsidian'
        ? this.textures.floorObsidianNormal
        : this.textures.floorStoneNormal;
    const floorRough =
      lvl.floorTheme === 'grate'
        ? this.textures.floorGrateRoughness
        : lvl.floorTheme === 'metal'
        ? this.textures.floorMetalRoughness
        : lvl.floorTheme === 'obsidian'
        ? this.textures.floorObsidianRoughness
        : this.textures.floorStoneRoughness;
    floorTex.repeat.set(this.gridW, this.gridH);
    floorNormal.repeat.set(this.gridW, this.gridH);
    floorRough.repeat.set(this.gridW, this.gridH);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      normalMap: floorNormal,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughnessMap: floorRough,
      roughness: 1.0,
      metalness: lvl.floorTheme === 'metal' || lvl.floorTheme === 'grate' ? 0.52 : 0.2,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapH), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mapW / 2 - cs / 2, 0, mapH / 2 - cs / 2);
    floor.receiveShadow = true;
    this.levelGroup.add(floor);

    this.textures.ceilingTech.repeat.set(this.gridW, this.gridH);
    this.textures.ceilingTechNormal.repeat.set(this.gridW, this.gridH);
    const ceilMat = new THREE.MeshStandardMaterial({
      map: this.textures.ceilingTech,
      normalMap: this.textures.ceilingTechNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.72,
      metalness: 0.45,
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapH), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(mapW / 2 - cs / 2, wh, mapH / 2 - cs / 2);
    this.levelGroup.add(ceiling);

    // Wall & prop PBR materials with full Normal + Roughness maps
    const techWallMat = new THREE.MeshStandardMaterial({
      map: this.textures.techWall,
      normalMap: this.textures.techWallNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: this.textures.techWallRoughness,
      roughness: 1.0,
      metalness: 0.56,
    });
    const hellWallMat = new THREE.MeshStandardMaterial({
      map: this.textures.hellWall,
      normalMap: this.textures.hellWallNormal,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughnessMap: this.textures.hellWallRoughness,
      roughness: 1.0,
      metalness: 0.16,
    });
    const reactorWallMat = new THREE.MeshStandardMaterial({
      map: this.textures.reactorWall,
      normalMap: this.textures.reactorWallNormal,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughnessMap: this.textures.reactorWallRoughness,
      roughness: 1.0,
      metalness: 0.62,
      emissive: 0x3a0f04,
      emissiveIntensity: 0.65,
    });
    const rustWallMat = new THREE.MeshStandardMaterial({
      map: this.textures.rustWall,
      normalMap: this.textures.rustWallNormal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: this.textures.rustWallRoughness,
      roughness: 1.0,
      metalness: 0.36,
    });
    const obsidianWallMat = new THREE.MeshStandardMaterial({
      map: this.textures.obsidianWall,
      normalMap: this.textures.obsidianWallNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: this.textures.obsidianWallRoughness,
      roughness: 1.0,
      metalness: 0.34,
      emissive: 0x24060c,
      emissiveIntensity: 0.45,
    });
    const cyberWallMat = new THREE.MeshStandardMaterial({
      map: this.textures.cyberWall,
      normalMap: this.textures.cyberWallNormal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: this.textures.cyberWallRoughness,
      roughness: 1.0,
      metalness: 0.74,
      emissive: 0x061b26,
      emissiveIntensity: 0.48,
    });
    const pillarMat = new THREE.MeshStandardMaterial({
      map: this.textures.pillarTex,
      normalMap: this.textures.pillarNormal,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: this.textures.pillarRoughness,
      roughness: 1.0,
      metalness: 0.62,
    });
    const crateMat = new THREE.MeshStandardMaterial({
      map: this.textures.crateTex,
      normalMap: this.textures.crateNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: this.textures.crateRoughness,
      roughness: 1.0,
      metalness: 0.14,
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      map: lvl.hazardType === 'acid' ? this.textures.acidFloor : this.textures.lavaFloor,
      normalMap: lvl.hazardType === 'acid' ? this.textures.acidFloorNormal : this.textures.lavaFloorNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      emissive: lvl.hazardType === 'acid' ? 0x1e6610 : 0xbb2c06,
      emissiveIntensity: 1.45,
      roughness: lvl.hazardType === 'acid' ? 0.16 : 0.34,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const wallGeo = new THREE.BoxGeometry(cs, wh, cs);
    const hazardGeo = new THREE.PlaneGeometry(cs, cs);

    const pickWallMat = (wallCh: string) =>
      wallCh === '#'
        ? techWallMat
        : wallCh === '%'
        ? hellWallMat
        : wallCh === '&'
        ? reactorWallMat
        : wallCh === '$'
        ? rustWallMat
        : wallCh === '@'
        ? obsidianWallMat
        : cyberWallMat;

    const wallTrimCoords: [number, number][] = [];
    const pillarCoords: [number, number][] = [];
    const crateCoords: [number, number][] = [];
    const ceilingLampCoords: [number, number][] = [];

    for (let gz = 0; gz < this.gridH; gz++) {
      for (let gx = 0; gx < this.gridW; gx++) {
        const ch = this.grid[gz][gx];
        const wx = gx * cs;
        const wz = gz * cs;

        if (this.isWallChar(ch)) {
          const wall = new THREE.Mesh(wallGeo, pickWallMat(ch));
          wall.position.set(wx, wh / 2, wz);
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.levelGroup.add(wall);
          // Only add skirting trim if adjacent to an interior walkable cell
          if (
            !this.isWallChar(this.grid[gz]?.[gx - 1]) ||
            !this.isWallChar(this.grid[gz]?.[gx + 1]) ||
            !this.isWallChar(this.grid[gz - 1]?.[gx]) ||
            !this.isWallChar(this.grid[gz + 1]?.[gx])
          ) {
            wallTrimCoords.push([wx, wz]);
          }
        } else if (ch === '?') {
          const neighbors = [
            this.grid[gz]?.[gx - 1],
            this.grid[gz]?.[gx + 1],
            this.grid[gz - 1]?.[gx],
            this.grid[gz + 1]?.[gx],
          ];
          const adjWall = neighbors.find((n) => this.isWallChar(n)) || '#';
          const baseMat = pickWallMat(adjWall).clone();
          baseMat.emissive.setHex(0x1f1408);
          baseMat.emissiveIntensity = 0.25;
          const secretMesh = new THREE.Mesh(wallGeo, baseMat);
          secretMesh.position.set(wx, wh / 2, wz);
          secretMesh.castShadow = true;
          secretMesh.receiveShadow = true;
          this.levelGroup.add(secretMesh);
          this.secretWalls.push({
            gx,
            gz,
            discovered: false,
            openProgress: 0,
            targetOpen: 0,
            mesh: secretMesh,
            baseY: wh / 2,
          });
          this.totalSecrets++;
        } else if (ch === 'P') {
          pillarCoords.push([wx, wz]);
        } else if (ch === 'C') {
          crateCoords.push([wx, wz]);
        } else if (ch === '~') {
          const haz = new THREE.Mesh(hazardGeo, hazardMat);
          haz.rotation.x = -Math.PI / 2;
          haz.position.set(wx, 0.025, wz);
          this.levelGroup.add(haz);
        } else if (ch === 'D' || ch === 'K') {
          const locked = ch === 'K';
          const doorMat = new THREE.MeshStandardMaterial({
            map: locked ? this.textures.doorLocked : this.textures.doorTech,
            normalMap: locked ? this.textures.doorLockedNormal : this.textures.doorTechNormal,
            normalScale: new THREE.Vector2(1.3, 1.3),
            roughnessMap: this.textures.doorTechRoughness,
            roughness: 1.0,
            metalness: 0.72,
          });
          const horizCorridor = this.isWallChar(this.grid[gz]?.[gx - 1]) || this.isWallChar(this.grid[gz]?.[gx + 1]);
          const doorGeo = horizCorridor
            ? new THREE.BoxGeometry(cs, wh, cs * 0.24)
            : new THREE.BoxGeometry(cs * 0.24, wh, cs);
          const doorMesh = new THREE.Mesh(doorGeo, doorMat);
          doorMesh.position.set(wx, wh / 2, wz);
          doorMesh.castShadow = true;
          doorMesh.receiveShadow = true;
          this.levelGroup.add(doorMesh);
          this.doors.push({
            gx,
            gz,
            locked,
            openProgress: 0,
            targetOpen: 0,
            closeTimer: 0,
            mesh: doorMesh,
            baseY: wh / 2,
          });
        } else {
          if ((gx + gz) % 4 === 0 && gx % 2 === 1 && gz % 2 === 1) {
            ceilingLampCoords.push([wx, wz]);
          }
          if (ch === 'S') {
            this.px = wx;
            this.pz = wz;
            this.yaw = lvl.startYaw ?? -Math.PI * 0.5;
            this.smoothYaw = this.yaw;
          } else if (ch === 'B') {
            const barrel = buildBarrelModel(this.textures);
            barrel.position.set(wx, 0, wz);
            this.entityGroup.add(barrel);
            this.barrels.push({
              id: this.nextEntityId++,
              x: wx,
              z: wz,
              hp: 25,
              alive: true,
              mesh: barrel,
              hitFlash: 0,
            });
          } else if (ch === 'X') {
            this.hasExitPortal = true;
            this.exitPos.set(wx, 0, wz);
            this.exitParts = buildExitPortal(this.textures);
            this.exitParts.group.position.set(wx, 0, wz);
            this.entityGroup.add(this.exitParts.group);
          } else if (
            ch === 'H' ||
            ch === 'A' ||
            ch === 'M' ||
            ch === 'Y' ||
            ch === 'U' ||
            ch === 'G' ||
            ch === 'W' ||
            ch === 'R' ||
            ch === 'F'
          ) {
            const mapKind: Record<string, PickupKind> = {
              H: 'health',
              A: 'armor',
              M: 'ammo',
              Y: 'key',
              U: 'supershotgun_gun',
              G: 'chaingun_gun',
              W: 'plasma_gun',
              R: 'rocket_gun',
              F: 'bfg_gun',
            };
            this.spawnPickup(mapKind[ch], wx, wz);
          } else if (ch === 'i' || ch === 't' || ch === 'c' || ch === 'b' || ch === 'T') {
            const kindMap: Record<string, EnemyKind> = {
              i: 'imp',
              t: 'trooper',
              c: 'cacodemon',
              b: 'baron',
              T: 'titan',
            };
            this.spawnEnemy(kindMap[ch], wx, wz, ch === 'T');
          }
        }
      }
    }

    const dummy = new THREE.Object3D();
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x1b1e25,
      roughness: 0.36,
      metalness: 0.82,
    });

    // Instanced Baseboard & Crown Trim around exposed walls
    if (wallTrimCoords.length > 0) {
      const trimGeo = new THREE.BoxGeometry(cs + 0.08, 0.22, cs + 0.08);
      const baseTrim = new THREE.InstancedMesh(trimGeo, trimMat, wallTrimCoords.length);
      const crownTrim = new THREE.InstancedMesh(trimGeo, trimMat, wallTrimCoords.length);
      baseTrim.receiveShadow = true;
      wallTrimCoords.forEach(([wx, wz], idx) => {
        dummy.position.set(wx, 0.11, wz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        baseTrim.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, wh - 0.11, wz);
        dummy.updateMatrix();
        crownTrim.setMatrixAt(idx, dummy.matrix);
      });
      baseTrim.instanceMatrix.needsUpdate = true;
      crownTrim.instanceMatrix.needsUpdate = true;
      baseTrim.computeBoundingSphere();
      crownTrim.computeBoundingSphere();
      this.levelGroup.add(baseTrim, crownTrim);
    }

    // Instanced Multi-Part Fluted Pillars (P)
    if (pillarCoords.length > 0) {
      const shaftGeo = new THREE.CylinderGeometry(cs * 0.19, cs * 0.21, wh, 18);
      const plinthGeo = new THREE.BoxGeometry(cs * 0.52, 0.28, cs * 0.52);
      const shafts = new THREE.InstancedMesh(shaftGeo, pillarMat, pillarCoords.length);
      const bases = new THREE.InstancedMesh(plinthGeo, trimMat, pillarCoords.length);
      const caps = new THREE.InstancedMesh(plinthGeo, trimMat, pillarCoords.length);
      shafts.castShadow = true;
      shafts.receiveShadow = true;
      bases.castShadow = true;
      bases.receiveShadow = true;
      pillarCoords.forEach(([wx, wz], idx) => {
        dummy.position.set(wx, wh / 2, wz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        shafts.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, 0.14, wz);
        dummy.updateMatrix();
        bases.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, wh - 0.14, wz);
        dummy.updateMatrix();
        caps.setMatrixAt(idx, dummy.matrix);
      });
      shafts.instanceMatrix.needsUpdate = true;
      bases.instanceMatrix.needsUpdate = true;
      caps.instanceMatrix.needsUpdate = true;
      shafts.computeBoundingSphere();
      bases.computeBoundingSphere();
      caps.computeBoundingSphere();
      this.levelGroup.add(shafts, bases, caps);
    }

    // Instanced Multi-Part Reinforced Crates (C)
    if (crateCoords.length > 0) {
      const crateGeo = new THREE.BoxGeometry(cs * 0.48, 1.35, cs * 0.48);
      const braceGeo = new THREE.BoxGeometry(cs * 0.51, 0.16, cs * 0.51);
      const crates = new THREE.InstancedMesh(crateGeo, crateMat, crateCoords.length);
      const braces = new THREE.InstancedMesh(braceGeo, trimMat, crateCoords.length);
      crates.castShadow = true;
      crates.receiveShadow = true;
      braces.castShadow = true;
      crateCoords.forEach(([wx, wz], idx) => {
        dummy.position.set(wx, 1.35 / 2, wz);
        dummy.rotation.set(0, (idx % 3) * 0.04 - 0.04, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        crates.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, 1.26, wz);
        dummy.updateMatrix();
        braces.setMatrixAt(idx, dummy.matrix);
      });
      crates.instanceMatrix.needsUpdate = true;
      braces.instanceMatrix.needsUpdate = true;
      crates.computeBoundingSphere();
      braces.computeBoundingSphere();
      this.levelGroup.add(crates, braces);
    }

    // Instanced Ceiling Light Housings + Glowing Diffusers + 3 Corridor Point Lights
    const lampColor = lvl.isBossLevel
      ? 0xff3b18
      : lvl.hazardType === 'acid'
      ? 0x88ff66
      : lvl.keyLightColor;
    if (ceilingLampCoords.length > 0) {
      const housingGeo = new THREE.BoxGeometry(1.1, 0.12, 0.46);
      const bulbGeo = new THREE.BoxGeometry(0.92, 0.08, 0.28);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: lampColor,
        emissiveIntensity: 2.2,
        roughness: 0.15,
      });
      const housings = new THREE.InstancedMesh(housingGeo, trimMat, ceilingLampCoords.length);
      const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, ceilingLampCoords.length);
      ceilingLampCoords.forEach(([wx, wz], idx) => {
        dummy.position.set(wx, wh - 0.06, wz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        housings.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, wh - 0.1, wz);
        dummy.updateMatrix();
        bulbs.setMatrixAt(idx, dummy.matrix);
      });
      housings.instanceMatrix.needsUpdate = true;
      bulbs.instanceMatrix.needsUpdate = true;
      housings.computeBoundingSphere();
      bulbs.computeBoundingSphere();
      this.levelGroup.add(housings, bulbs);

      const poolCount = Math.min(3, ceilingLampCoords.length);
      for (let i = 0; i < poolCount; i++) {
        const pick = ceilingLampCoords[Math.floor((i * ceilingLampCoords.length) / poolCount)];
        const poolLight = new THREE.PointLight(lampColor, 1.85, 16, 1.5);
        poolLight.position.set(pick[0], wh - 0.35, pick[1]);
        this.levelGroup.add(poolLight);
      }
    }

    // Atmospheric floating dust / embers / toxic spores
    const dustCount = 180;
    const dustPos = new Float32Array(dustCount * 3);
    this.ambientBasePos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const dx = Math.random() * mapW - cs * 0.5;
      const dy = 0.2 + Math.random() * (wh - 0.5);
      const dz = Math.random() * mapH - cs * 0.5;
      dustPos[i * 3] = dx;
      dustPos[i * 3 + 1] = dy;
      dustPos[i * 3 + 2] = dz;
      this.ambientBasePos[i * 3] = dx;
      this.ambientBasePos[i * 3 + 1] = dy;
      this.ambientBasePos[i * 3 + 2] = dz;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: lvl.isBossLevel || lvl.hazardType === 'lava' ? 0xff9944 : lvl.hazardType === 'acid' ? 0x88ff66 : 0xaaccff,
      map: this.textures.softParticleTex,
      size: 0.14,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ambientPoints = new THREE.Points(dustGeo, dustMat);
    this.levelGroup.add(this.ambientPoints);

    // Add 1 warm reactor/atrium accent point light in center of map
    const centerLight = new THREE.PointLight(
      lvl.isBossLevel ? 0xff2211 : lvl.hazardType === 'acid' ? 0x66ff44 : 0xff6622,
      lvl.isBossLevel ? 3.2 : 2.4,
      lvl.isBossLevel ? 34 : 24,
      1.5,
    );
    centerLight.position.set(mapW / 2 - cs / 2, wh - 0.6, mapH / 2 - cs / 2);
    this.levelGroup.add(centerLight);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.updateCameraTransform(0);
    this.revealExplored();
  }

  private spawnPickup(kind: PickupKind, x: number, z: number): void {
    const mesh = buildPickupModel(kind);
    mesh.position.set(x, 0, z);
    this.entityGroup.add(mesh);
    this.pickups.push({
      id: this.nextEntityId++,
      kind,
      x,
      z,
      collected: false,
      mesh,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private spawnEnemy(kind: EnemyKind, x: number, z: number, startAlerted = false): void {
    const rig = buildEnemyModel(kind, this.textures);
    rig.root.position.set(x, 0, z);
    for (const m of rig.hitMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      m.userData.baseEmissive = mat.emissive ? mat.emissive.getHex() : 0;
      m.userData.baseEmissiveIntensity = mat.emissiveIntensity ?? 0;
    }
    this.entityGroup.add(rig.root);

    const diffMult = this.difficulty === 'facil' ? 0.75 : this.difficulty === 'pesadilla' ? 1.3 : 1.0;
    const speedMult = this.difficulty === 'facil' ? 0.88 : this.difficulty === 'pesadilla' ? 1.15 : 1.0;
    const stats: Record<EnemyKind, { hp: number; speed: number; dmg: number; range: number }> = {
      imp: { hp: 65, speed: 4.3, dmg: 12, range: 16 },
      trooper: { hp: 60, speed: 3.6, dmg: 10, range: 20 },
      cacodemon: { hp: 135, speed: 3.2, dmg: 16, range: 18 },
      baron: { hp: 360, speed: 3.6, dmg: 22, range: 22 },
      titan: { hp: 1750, speed: 3.15, dmg: 24, range: 30 },
    };
    const st = stats[kind];
    const hp = Math.round(st.hp * diffMult);
    this.totalEnemies++;

    this.enemies.push({
      id: this.nextEntityId++,
      kind,
      rig,
      x,
      z,
      vx: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      hp,
      maxHp: hp,
      speed: st.speed * speedMult,
      damage: Math.round(st.dmg * diffMult),
      attackRange: st.range,
      state: startAlerted ? 'chase' : 'patrol',
      stateTimer: 0.4 + Math.random() * 0.8,
      patrolDir: Math.random() * Math.PI * 2,
      strafeSign: Math.random() > 0.5 ? 1 : -1,
      strafeTimer: 0.9 + Math.random(),
      hitFlash: 0,
      squash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      deathProgress: 0,
      enraged: false,
    });
  }

  private isWallChar(ch?: string): boolean {
    return ch === '#' || ch === '%' || ch === '&' || ch === '$' || ch === '@' || ch === '=';
  }

  private isSolidCell(gx: number, gz: number): boolean {
    if (gz < 0 || gz >= this.gridH || gx < 0 || gx >= this.gridW) return true;
    const ch = this.grid[gz][gx];
    if (this.isWallChar(ch)) return true;
    if (ch === 'D' || ch === 'K') {
      const door = this.doors.find((d) => d.gx === gx && d.gz === gz);
      if (door && door.openProgress < 0.72) return true;
    }
    if (ch === '?') {
      const secret = this.secretWalls.find((s) => s.gx === gx && s.gz === gz);
      if (secret && secret.openProgress < 0.72) return true;
    }
    return false;
  }

  private isObstacleHit(x: number, z: number, radius: number): boolean {
    const cs = this.level.cellSize;
    const minGx = Math.floor((x - radius + cs * 0.5) / cs);
    const maxGx = Math.floor((x + radius + cs * 0.5) / cs);
    const minGz = Math.floor((z - radius + cs * 0.5) / cs);
    const maxGz = Math.floor((z + radius + cs * 0.5) / cs);

    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        if (this.isSolidCell(gx, gz)) return true;
        const ch = this.grid[gz]?.[gx];
        if (ch === 'P' || ch === 'C') {
          const cx = gx * cs;
          const cz = gz * cs;
          const half = cs * 0.25;
          if (
            Math.abs(x - cx) < half + radius &&
            Math.abs(z - cz) < half + radius
          ) {
            return true;
          }
        }
      }
    }

    // Explosive barrels solid collision
    for (const b of this.barrels) {
      if (!b.alive) continue;
      const dx = x - b.x;
      const dz = z - b.z;
      if (dx * dx + dz * dz < (radius + 0.44) * (radius + 0.44)) return true;
    }

    return false;
  }

  private hasLineOfSight(x1: number, z1: number, x2: number, z2: number): boolean {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.01) return true;
    const steps = Math.ceil(dist / 0.45);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = x1 + dx * t;
      const sz = z1 + dz * t;
      const gx = Math.round(sx / this.level.cellSize);
      const gz = Math.round(sz / this.level.cellSize);
      if (this.isSolidCell(gx, gz)) return false;
    }
    return true;
  }

  // Public API for React UI
  public startGame(difficulty: Difficulty, sectorIndex = this.startSectorIndex): void {
    this.difficulty = difficulty;
    this.startSectorIndex = THREE.MathUtils.clamp(sectorIndex, 0, LEVELS.length - 1);
    this.audio.unlock();
    this.audio.startGroove();
    this.loadLevel(this.startSectorIndex, true);
    this.phase = 'playing';
    this.requestPointerLock();
    this.emitHud();
  }

  public setStartSector(sectorIndex: number): void {
    const clamped = THREE.MathUtils.clamp(sectorIndex, 0, LEVELS.length - 1);
    if (this.startSectorIndex !== clamped) {
      this.startSectorIndex = clamped;
      if (this.phase === 'title') {
        this.loadLevel(clamped, true);
      }
      this.emitHud();
    }
  }

  public resumeGame(): void {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.audio.unlock();
      this.requestPointerLock();
      this.emitHud();
    }
  }

  public pauseGame(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.keys.clear();
      this.fireHeld = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
      this.emitHud();
    }
  }

  public nextSector(): void {
    if (this.sectorIndex + 1 < LEVELS.length) {
      this.loadLevel(this.sectorIndex + 1, false);
      this.phase = 'playing';
      this.requestPointerLock();
    } else {
      this.phase = 'victory';
    }
    this.emitHud();
  }

  public restartSector(): void {
    const fullReset = this.sectorIndex === 0 || this.phase === 'victory';
    const wasDead = this.phase === 'gameover' || this.health <= 0;
    this.loadLevel(this.sectorIndex, fullReset);
    if (!fullReset) {
      this.health = this.maxHealth;
      const startArmor = this.difficulty === 'facil' ? 50 : this.difficulty === 'normal' ? 35 : 15;
      this.armor = wasDead ? startArmor : Math.max(this.armor, startArmor);
    }
    this.phase = 'playing';
    this.requestPointerLock();
    this.emitHud();
  }

  public restartCampaign(): void {
    this.startSectorIndex = 0;
    this.loadLevel(0, true);
    this.phase = 'playing';
    this.requestPointerLock();
    this.emitHud();
  }

  public returnToTitle(): void {
    this.audio.stopGroove();
    this.loadLevel(this.startSectorIndex, true);
    this.phase = 'title';
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.emitHud();
  }

  public toggleMute(): void {
    const muted = this.audio.toggleMute();
    if (!muted && this.phase === 'playing') {
      this.audio.startGroove();
    }
    this.emitHud();
  }

  public selectWeapon(id: WeaponId): void {
    this.switchWeapon(id, false);
  }

  public setDifficulty(d: Difficulty): void {
    if (this.difficulty !== d) {
      this.difficulty = d;
      this.emitHud();
    }
  }

  public setSensitivity(val: number): void {
    const clamped = THREE.MathUtils.clamp(Math.round(val * 10) / 10, 0.5, 2.0);
    if (this.sensitivity !== clamped) {
      this.sensitivity = clamped;
      this.emitHud();
    }
  }

  public setInvertY(invert: boolean): void {
    if (this.invertY !== invert) {
      this.invertY = invert;
      this.emitHud();
    }
  }

  public setCinematicActive(active: boolean): void {
    this.cinematicActive = active;
  }

  private cycleWeapon(delta: number): void {
    if (this.unlockedWeapons.length <= 1) return;
    const idx = this.unlockedWeapons.indexOf(this.activeWeapon);
    const nextIdx = (idx + delta + this.unlockedWeapons.length) % this.unlockedWeapons.length;
    this.switchWeapon(this.unlockedWeapons[nextIdx], false);
  }

  public requestPointerLock(): void {
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Fallback drag/key aiming still works cleanly
    }
  }

  private switchWeapon(id: WeaponId, instant: boolean): void {
    if (!this.unlockedWeapons.includes(id)) return;
    if (this.activeWeapon === id && !instant) return;
    this.activeWeapon = id;
    (Object.keys(this.weaponModels) as WeaponId[]).forEach((k) => {
      this.weaponModels[k].visible = k === id;
    });
    if (!instant) {
      this.weaponSwitchDip = 0.22;
      this.setStatus(WEAPON_SPECS[id].name, 1.1);
    }
    this.emitHud();
  }

  private setStatus(msg: string, duration = 2.0): void {
    this.statusMessage = msg;
    this.statusTimer = duration;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('gamepadconnected', this.onGamepadChange);
    window.addEventListener('gamepaddisconnected', this.onGamepadChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private readGamepads(): readonly (Gamepad | null)[] {
    try {
      const getter =
        navigator.getGamepads ||
        (navigator as unknown as { webkitGetGamepads?: () => (Gamepad | null)[] }).webkitGetGamepads;
      if (!getter) return [];
      const pads = getter.call(navigator);
      if (this.gamepadBlocked) {
        this.gamepadBlocked = false;
      }
      return pads || [];
    } catch {
      if (!this.gamepadBlocked) {
        this.gamepadBlocked = true;
        this.emitHud();
      }
      return [];
    }
  }

  private onGamepadChange = (e?: Event): void => {
    const gpEvent = e as GamepadEvent | undefined;
    if (gpEvent?.gamepad && gpEvent.type === 'gamepadconnected') {
      this.activePadIndex = gpEvent.gamepad.index;
    }
    const pads = this.readGamepads();
    const connectedPads = Array.from(pads).filter(
      (p): p is Gamepad => Boolean(p && p.connected && (p.buttons.length > 0 || p.axes.length >= 2)),
    );
    const connected = connectedPads.length > 0;
    if (connected !== this.gamepadConnected || !connected) {
      this.gamepadConnected = connected;
      if (!connected) {
        this.activePadIndex = null;
        this.gamepadName = null;
        this.padFireHeld = false;
        this.padMoveX = 0;
        this.padMoveY = 0;
        this.padSprint = false;
        this.prevPadButtons = [];
      } else {
        const chosen =
          connectedPads.find((p) => p.index === this.activePadIndex) ||
          connectedPads.find((p) => p.mapping === 'standard') ||
          connectedPads[0];
        this.activePadIndex = chosen.index;
        this.gamepadName = chosen.id || 'Gamepad';
      }
      this.emitHud();
    }
  };

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(pr);
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  };

  private onWindowBlur = (): void => {
    this.keys.clear();
    this.fireHeld = false;
    this.draggingLook = false;
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked && this.phase === 'playing') {
      // Allow playing smoothly with drag/keyboard or re-lock on click without forcing pause
      this.emitHud();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    this.keys.add(e.code);

    if (this.phase === 'playing') {
      if (e.code === 'Space') {
        if (!this.fireHeld) this.fireJustPressed = true;
        this.fireHeld = true;
      } else if (e.code.startsWith('Digit')) {
        const slot = parseInt(e.code.slice(5), 10);
        if (slot >= 1 && slot <= WEAPON_ORDER.length) {
          this.switchWeapon(WEAPON_ORDER[slot - 1], false);
        }
      } else if (e.code === 'KeyE' || e.code === 'KeyF') {
        this.tryInteract();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        this.pauseGame();
      } else if (e.code === 'KeyM') {
        this.toggleMute();
      }
    } else if (this.phase === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) {
      this.resumeGame();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'Space') {
      this.fireHeld = false;
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    if (!this.pointerLocked) {
      this.requestPointerLock();
    }
    if (e.button === 0) {
      this.fireHeld = true;
      this.fireJustPressed = true;
      this.draggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    if (this.pointerLocked) {
      this.yaw -= e.movementX * 0.0024 * this.sensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - e.movementY * 0.0019 * this.sensitivity,
        -0.55,
        0.55,
      );
    } else if (this.draggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.yaw -= dx * 0.0042 * this.sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.003 * this.sensitivity, -0.55, 0.55);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.fireHeld = false;
      this.draggingLook = false;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.phase !== 'playing' || this.unlockedWeapons.length <= 1) return;
    const idx = this.unlockedWeapons.indexOf(this.activeWeapon);
    const nextIdx = (idx + (e.deltaY > 0 ? 1 : -1) + this.unlockedWeapons.length) % this.unlockedWeapons.length;
    this.switchWeapon(this.unlockedWeapons[nextIdx], false);
  };

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.update(dt, now * 0.001);
      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number, elapsedSec: number): void {
    // Animate hazard texture flow & atmospheric dust/embers regardless of phase
    this.textures.lavaFloor.offset.set(elapsedSec * 0.08, Math.sin(elapsedSec * 0.5) * 0.05);
    this.textures.lavaFloorNormal.offset.copy(this.textures.lavaFloor.offset);
    this.textures.acidFloor.offset.set(-elapsedSec * 0.06, Math.cos(elapsedSec * 0.4) * 0.05);
    this.textures.acidFloorNormal.offset.copy(this.textures.acidFloor.offset);

    if (this.ambientPoints && this.ambientBasePos) {
      const posAttr = this.ambientPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const wh = this.level.wallHeight - 0.3;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = this.ambientBasePos[i];
        const by = this.ambientBasePos[i + 1];
        const bz = this.ambientBasePos[i + 2];
        arr[i] = bx + Math.sin(elapsedSec * 0.65 + i) * 0.25;
        arr[i + 1] = 0.2 + ((by + elapsedSec * 0.22 + i * 0.05) % wh);
        arr[i + 2] = bz + Math.cos(elapsedSec * 0.55 + i) * 0.25;
      }
      posAttr.needsUpdate = true;
    }

    if (this.exitParts) {
      this.exitParts.ring.rotation.z = elapsedSec * 1.4;
      this.exitParts.core.rotation.y = elapsedSec * 2.2;
      this.exitParts.core.rotation.x = elapsedSec * 1.1;
    }

    this.pollGamepad(dt);

    if (this.phase === 'title') {
      this.updateTitleAtrium(dt, elapsedSec);
      return;
    }

    if (this.phase !== 'playing') {
      return;
    }

    // Hitstop freeze for heavy visceral impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 14, dt);
      this.updateCameraTransform(dt);
      return;
    }

    if (this.bossVictoryCountdown > 0) {
      this.bossVictoryCountdown -= dt;
      this.updateParticles(dt);
      this.updateEnemies(dt, elapsedSec);
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 8, dt);
      this.updateCameraTransform(dt);
      if (this.bossVictoryCountdown <= 0) {
        this.bossVictoryCountdown = 0;
        this.keys.clear();
        this.fireHeld = false;
        if (document.pointerLockElement === this.renderer.domElement) {
          document.exitPointerLock?.();
        }
        this.audio.playPickup(true);
        this.phase = 'victory';
        this.emitHud();
      }
      return;
    }

    this.elapsedSeconds += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    this.pickupFlash = Math.max(0, this.pickupFlash - dt * 2.8);
    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);

    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) this.statusMessage = null;
    }
    if (this.faceMoodTimer > 0) {
      this.faceMoodTimer -= dt;
      if (this.faceMoodTimer <= 0) {
        this.faceMood = this.health <= 30 ? 'critical' : 'normal';
      }
    }

    this.updatePlayer(dt);
    this.updateWeapons(dt, elapsedSec);
    this.updateDoors(dt);
    this.updatePickups(dt, elapsedSec);
    this.updateBarrels(dt);
    this.updateEnemies(dt, elapsedSec);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateShellsAndDecals(dt);
    this.updateCameraTransform(dt);

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.06) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private updateTitleAtrium(dt: number, elapsedSec: number): void {
    // Live-world panoramic camera orbit in the central arena of the selected sector
    const cs = this.level.cellSize;
    const centerX = Math.floor(this.gridW / 2) * cs;
    const centerZ = Math.floor(this.gridH / 2) * cs;
    const angle = elapsedSec * 0.24;
    this.camera.position.set(
      centerX + Math.cos(angle) * 5.2,
      2.1 + Math.sin(elapsedSec * 0.7) * 0.25,
      centerZ + Math.sin(angle) * 4.4,
    );
    this.camera.lookAt(centerX, 1.35, centerZ);
    this.weaponMount.visible = false;

    // Gentle idle animations on enemies during title preview
    for (const e of this.enemies) {
      e.walkPhase += dt * 3;
      if (e.kind === 'cacodemon') {
        e.rig.body.position.y = Math.sin(e.walkPhase) * 0.18;
      }
      e.rig.root.rotation.y += dt * 0.45;
    }
  }

  private updatePlayer(dt: number): void {
    this.weaponMount.visible = true;

    // Keyboard turn fallback (ArrowLeft / ArrowRight / Q)
    const turnSpeed = 2.4 * this.sensitivity;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyQ')) this.yaw += turnSpeed * dt;
    if (this.keys.has('ArrowRight')) this.yaw -= turnSpeed * dt;

    let moveF = this.padMoveY;
    let moveS = this.padMoveX;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveF += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveF -= 1;
    if (this.keys.has('KeyA')) moveS -= 1;
    if (this.keys.has('KeyD')) moveS += 1;

    const len = Math.hypot(moveF, moveS);
    if (len > 1) {
      moveF /= len;
      moveS /= len;
    }

    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.padSprint;
    const maxSpeed = sprinting ? 9.8 : 7.0;

    // Smooth camera strafe roll & dynamic sprint FOV
    const targetRoll = -moveS * 0.022;
    this.cameraRoll = THREE.MathUtils.damp(this.cameraRoll, targetRoll, 12, dt);
    const targetFov = sprinting && len > 0.2 ? 77.5 : 72;
    const nextFov = THREE.MathUtils.damp(this.currentFov, targetFov, 10, dt);
    if (Math.abs(nextFov - this.currentFov) > 0.01) {
      this.currentFov = nextFov;
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    // Forward & right vectors from yaw
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const forwardX = -sinY;
    const forwardZ = -cosY;
    const rightX = cosY;
    const rightZ = -sinY;

    const wishX = (forwardX * moveF + rightX * moveS) * maxSpeed;
    const wishZ = (forwardZ * moveF + rightZ * moveS) * maxSpeed;

    this.pvx = THREE.MathUtils.damp(this.pvx, wishX, 14, dt);
    this.pvz = THREE.MathUtils.damp(this.pvz, wishZ, 14, dt);

    const pRadius = 0.48;
    const nextX = this.px + this.pvx * dt;
    if (!this.isObstacleHit(nextX, this.pz, pRadius)) {
      this.px = nextX;
    } else {
      this.pvx = 0;
    }

    const nextZ = this.pz + this.pvz * dt;
    if (!this.isObstacleHit(this.px, nextZ, pRadius)) {
      this.pz = nextZ;
    } else {
      this.pvz = 0;
    }

    const moveSpeed = Math.hypot(this.pvx, this.pvz);
    if (moveSpeed > 0.6) {
      this.walkBob += dt * (sprinting ? 14 : 10);
    }

    this.revealExplored();

    // Floor hazard check (acid / lava)
    const gx = Math.round(this.px / this.level.cellSize);
    const gz = Math.round(this.pz / this.level.cellSize);
    if (this.grid[gz]?.[gx] === '~') {
      this.hazardTickTimer += dt;
      if (this.hazardTickTimer >= 0.45) {
        this.hazardTickTimer = 0;
        this.damagePlayer(this.level.hazardType === 'acid' ? 5 : 8);
      }
    } else {
      this.hazardTickTimer = 0.3;
    }

    // Proximity prompts & auto-door opening
    this.promptText = null;
    for (const d of this.doors) {
      const dx = d.gx * this.level.cellSize - this.px;
      const dz = d.gz * this.level.cellSize - this.pz;
      if (dx * dx + dz * dz < 8.5) {
        if (d.locked && !this.hasKey) {
          this.promptText = 'PUERTA BLOQUEADA · REQUIERE LLAVE CARMESÍ';
        } else if (d.targetOpen === 0) {
          this.openDoor(d);
        }
      }
    }

    // Secret push-wall proximity prompt
    for (const sw of this.secretWalls) {
      if (sw.discovered) continue;
      const dx = sw.gx * this.level.cellSize - this.px;
      const dz = sw.gz * this.level.cellSize - this.pz;
      if (dx * dx + dz * dz < 8.5) {
        this.promptText = '[E] EMPUJAR MURO SOSPECHOSO';
      }
    }

    // Exit portal proximity (non-boss sectors)
    if (this.hasExitPortal) {
      const exDistSq = (this.exitPos.x - this.px) ** 2 + (this.exitPos.z - this.pz) ** 2;
      if (exDistSq < 3.4) {
        this.promptText = '[E] ENTRAR AL PORTAL DE SALIDA';
        if (exDistSq < 1.35) {
          this.completeSector();
        }
      }
    }
  }

  private revealExplored(): void {
    const gx = Math.round(this.px / this.level.cellSize);
    const gz = Math.round(this.pz / this.level.cellSize);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (nz >= 0 && nz < this.gridH && nx >= 0 && nx < this.gridW) {
          this.explored[nz][nx] = true;
        }
      }
    }
  }

  private tryInteract(): void {
    for (const d of this.doors) {
      const dx = d.gx * this.level.cellSize - this.px;
      const dz = d.gz * this.level.cellSize - this.pz;
      if (dx * dx + dz * dz < 11) {
        this.openDoor(d);
      }
    }
    for (const sw of this.secretWalls) {
      if (sw.discovered) continue;
      const wx = sw.gx * this.level.cellSize;
      const wz = sw.gz * this.level.cellSize;
      const dx = wx - this.px;
      const dz = wz - this.pz;
      if (dx * dx + dz * dz < 12.5) {
        sw.discovered = true;
        sw.targetOpen = 1;
        this.secretsFound++;
        this.score += 500;
        this.pickupFlash = 0.65;
        this.faceMood = 'grin';
        this.faceMoodTimer = 0.65;
        this.spawnParticles(wx, 1.4, wz, 18, 0xffdd44);
        this.audio.playPickup(true);
        this.setStatus('¡CUARTO SECRETO DESCUBIERTO! +500 PTS', 2.8);
        this.emitHud();
      }
    }
    if (this.hasExitPortal) {
      const exDistSq = (this.exitPos.x - this.px) ** 2 + (this.exitPos.z - this.pz) ** 2;
      if (exDistSq < 4.5) {
        this.completeSector();
      }
    }
  }

  private openDoor(door: DoorEntity): void {
    if (door.locked && !this.hasKey) {
      this.setStatus('NECESITAS LA LLAVE CARMESÍ', 1.6);
      return;
    }
    if (door.targetOpen === 0) {
      door.locked = false;
      door.targetOpen = 1;
      door.closeTimer = 4.5;
      this.audio.playDoor();
    }
  }

  private completeSector(): void {
    this.audio.playPickup(true);
    this.keys.clear();
    this.fireHeld = false;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    if (this.sectorIndex + 1 < LEVELS.length) {
      this.phase = 'sector_clear';
    } else {
      this.phase = 'victory';
    }
    this.emitHud();
  }

  private updateWeapons(dt: number, elapsedSec: number): void {
    const spec = WEAPON_SPECS[this.activeWeapon];
    const anyFireHeld = this.fireHeld || this.padFireHeld;
    const wantsFire = spec.isAuto ? anyFireHeld : this.fireJustPressed || anyFireHeld;
    this.fireJustPressed = false;

    if (wantsFire && this.fireCooldown <= 0) {
      this.fireWeapon();
    }

    // Spin chaingun rotary barrel & vibrate chainsaw
    if (this.activeWeapon === 'chaingun') {
      this.chaingunSpinSpeed = wantsFire
        ? 18
        : THREE.MathUtils.damp(this.chaingunSpinSpeed, 0, 5, dt);
      const spinner = this.weaponModels.chaingun.getObjectByName('chaingun_spinner');
      if (spinner) spinner.rotation.z += this.chaingunSpinSpeed * dt;
    }

    // Smooth weapon bob, idle breathing, camera inertia sway, recoil, and switch dip
    this.weaponRecoil = THREE.MathUtils.damp(this.weaponRecoil, 0, 14, dt);
    this.weaponSwitchDip = THREE.MathUtils.damp(this.weaponSwitchDip, 0, 14, dt);
    const targetSwayX = THREE.MathUtils.clamp((this.yaw - this.smoothYaw) * 0.45, -0.04, 0.04);
    const targetSwayY = THREE.MathUtils.clamp((this.pitch - this.smoothPitch) * 0.45, -0.03, 0.03);
    this.weaponSwayX = THREE.MathUtils.damp(this.weaponSwayX, targetSwayX, 16, dt);
    this.weaponSwayY = THREE.MathUtils.damp(this.weaponSwayY, targetSwayY, 16, dt);

    const speed = Math.hypot(this.pvx, this.pvz);
    const bobAmt = Math.min(speed / 7, 1) * 0.018;
    const bobX = Math.cos(this.walkBob * 0.5) * bobAmt;
    const bobY = Math.abs(Math.sin(this.walkBob)) * bobAmt;
    const breathY = Math.sin(elapsedSec * 2.1) * 0.0032;
    const sawJitter =
      this.activeWeapon === 'chainsaw'
        ? (Math.random() - 0.5) * (wantsFire ? 0.014 : 0.004)
        : 0;

    this.weaponMount.position.set(
      0.22 + bobX + this.weaponSwayX + sawJitter,
      -0.24 - bobY + breathY + this.weaponSwayY - this.weaponSwitchDip - this.weaponRecoil * 0.14 + sawJitter,
      -0.28 + this.weaponRecoil * 0.35,
    );
    this.weaponMount.rotation.x = this.weaponRecoil * 0.75;
    this.weaponMount.rotation.y = this.weaponSwayX * 0.65;
    this.weaponMount.rotation.z = this.cameraRoll * 1.4;

    if (this.muzzleFlashTimer > 0 && !spec.isMelee) {
      this.muzzleLight.intensity = 4.6;
      this.muzzleLight.color.setHex(spec.color);
      (this.muzzleMesh.material as THREE.MeshBasicMaterial).color.setHex(spec.color);
      (this.muzzleMesh.material as THREE.MeshBasicMaterial).opacity = 0.94;
      this.muzzleMesh.scale.setScalar(0.85 + Math.random() * 0.45);
      this.muzzleMesh.rotation.z += dt * 32;
    } else {
      this.muzzleLight.intensity = 0;
      (this.muzzleMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  private fireWeapon(): void {
    const spec = WEAPON_SPECS[this.activeWeapon];
    this.fireCooldown = spec.cooldown;
    this.weaponRecoil = spec.recoilKick;
    this.muzzleFlashTimer = spec.isMelee ? 0 : 0.065;
    this.shotsFired++;
    this.faceMood = 'firing';
    this.faceMoodTimer = 0.25;
    this.shakeIntensity = Math.max(this.shakeIntensity, spec.recoilKick * 0.14);
    this.audio.playWeaponFire(this.activeWeapon);

    if (
      this.activeWeapon === 'pistol' ||
      this.activeWeapon === 'shotgun' ||
      this.activeWeapon === 'supershotgun' ||
      this.activeWeapon === 'chaingun'
    ) {
      this.spawnShellCasing(this.activeWeapon === 'supershotgun' ? 2 : 1);
    }

    // Alert nearby enemies on gunshot sound!
    for (const e of this.enemies) {
      if (e.state === 'patrol') {
        const dSq = (e.x - this.px) ** 2 + (e.z - this.pz) ** 2;
        if (dSq < 18 * 18) {
          e.state = 'chase';
          e.stateTimer = 0.4;
        }
      }
    }

    // Forward direction from smoothed camera aim
    _euler.set(this.smoothPitch, this.smoothYaw, 0, 'YXZ');

    if (!spec.isProjectile) {
      // Hitscan / Melee pellets
      let hitAny = false;
      for (let i = 0; i < spec.pellets; i++) {
        _dir.set(
          (Math.random() - 0.5) * spec.spread * 2,
          (Math.random() - 0.5) * spec.spread * 1.4,
          -1,
        );
        _dir.applyEuler(_euler).normalize();
        const hit = this.traceHitscan(this.px, this.py - 0.05, this.pz, _dir, spec.range, spec.damage);
        if (hit) hitAny = true;
      }
      if (hitAny) this.shotsHit++;
    } else {
      // Spawn Plasma, Rocket, or BFG-9000 projectile
      _dir.set(
        (Math.random() - 0.5) * spec.spread,
        (Math.random() - 0.5) * spec.spread,
        -1,
      );
      _dir.applyEuler(_euler).normalize();
      const speed = spec.projectileSpeed;
      const isRocket = this.activeWeapon === 'rocket';
      const isBfg = this.activeWeapon === 'bfg';
      const projKind: ProjectileEntity['kind'] = isRocket ? 'rocket' : isBfg ? 'bfg' : 'plasma';
      const mesh = new THREE.Mesh(
        isRocket
          ? new THREE.CylinderGeometry(0.08, 0.08, 0.42, 18)
          : isBfg
          ? new THREE.SphereGeometry(0.32, 18, 14)
          : new THREE.SphereGeometry(0.11, 14, 12),
        new THREE.MeshBasicMaterial({ color: spec.color }),
      );
      if (isRocket) {
        mesh.rotation.x = Math.PI / 2;
      }
      const sx = this.px + _dir.x * 0.65;
      const sy = this.py - 0.1 + _dir.y * 0.65;
      const sz = this.pz + _dir.z * 0.65;
      mesh.position.set(sx, sy, sz);
      if (isRocket) {
        mesh.lookAt(sx + _dir.x, sy + _dir.y, sz + _dir.z);
        mesh.rotateX(Math.PI / 2);
      }
      this.scene.add(mesh);

      this.projectiles.push({
        fromPlayer: true,
        kind: projKind,
        x: sx,
        y: sy,
        z: sz,
        vx: _dir.x * speed,
        vy: _dir.y * speed,
        vz: _dir.z * speed,
        damage: spec.damage,
        radius: isBfg ? 0.34 : isRocket ? 0.22 : 0.14,
        splashRadius: spec.splashRadius,
        life: 3.4,
        mesh,
      });
    }
  }

  private traceHitscan(
    ox: number,
    oy: number,
    oz: number,
    dir: THREE.Vector3,
    maxDist: number,
    damage: number,
  ): boolean {
    const stepSize = 0.22;
    const steps = Math.floor(maxDist / stepSize);
    for (let s = 1; s <= steps; s++) {
      const dist = s * stepSize;
      const hx = ox + dir.x * dist;
      const hy = oy + dir.y * dist;
      const hz = oz + dir.z * dist;

      if (hy <= 0.02 || hy >= this.level.wallHeight) {
        this.spawnParticles(hx, THREE.MathUtils.clamp(hy, 0.05, this.level.wallHeight - 0.05), hz, 3, 0xffcc66);
        return false;
      }

      const gx = Math.round(hx / this.level.cellSize);
      const gz = Math.round(hz / this.level.cellSize);
      if (this.isSolidCell(gx, gz)) {
        this.spawnParticles(hx, hy, hz, 4, 0xffcc66);
        return false;
      }

      // Check barrels
      for (const b of this.barrels) {
        if (!b.alive) continue;
        if (hy <= 1.25 && (hx - b.x) ** 2 + (hz - b.z) ** 2 < 0.48 ** 2) {
          this.damageBarrel(b, damage);
          this.spawnParticles(hx, hy, hz, 5, 0xff7722);
          return true;
        }
      }

      // Check enemies
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        if (hy >= 0 && hy <= e.rig.baseHeight + 0.15) {
          const r = e.rig.baseRadius * 1.05;
          if ((hx - e.x) ** 2 + (hz - e.z) ** 2 < r * r) {
            this.damageEnemy(e, damage, dir.x, dir.z, dist < 5.5);
            this.spawnParticles(hx, hy, hz, 6, 0xff2211);
            return true;
          }
        }
      }
    }
    return false;
  }

  private damageBarrel(barrel: BarrelEntity, dmg: number): void {
    if (!barrel.alive) return;
    barrel.hp -= dmg;
    barrel.hitFlash = 0.1;
    if (barrel.hp <= 0) {
      this.explodeAt(barrel.x, 0.6, barrel.z, 5.2, 130, barrel);
    }
  }

  private explodeAt(
    ex: number,
    ey: number,
    ez: number,
    radius: number,
    maxDamage: number,
    ignoreBarrel?: BarrelEntity,
    particleColor = 0xff6611,
  ): void {
    if (ignoreBarrel) {
      ignoreBarrel.alive = false;
      ignoreBarrel.mesh.visible = false;
    }
    this.audio.playExplosion();
    this.spawnDecal(ex, ez, 'scorch', 1.85);
    this.spawnParticles(ex, ey, ez, 24, particleColor);
    this.spawnParticles(ex, ey + 0.3, ez, 12, particleColor === 0xff6611 ? 0xffdd44 : 0xaaffbb);
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.05);
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.28);

    // Damage enemies in blast radius
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const dx = e.x - ex;
      const dz = e.z - ez;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        const falloff = 1 - dist / radius;
        const nx = dist > 0.01 ? dx / dist : 1;
        const nz = dist > 0.01 ? dz / dist : 0;
        this.damageEnemy(e, Math.round(maxDamage * falloff), nx, nz, true);
      }
    }

    // Chain-detonate nearby barrels
    for (const b of this.barrels) {
      if (!b.alive || b === ignoreBarrel) continue;
      const dist = Math.hypot(b.x - ex, b.z - ez);
      if (dist < radius * 0.85) {
        b.hp = 0;
        this.explodeAt(b.x, 0.6, b.z, 5.0, 125, b);
      }
    }

    // Self-damage if player too close (BFG does not hurt player)
    if (particleColor === 0xff6611) {
      const pDist = Math.hypot(this.px - ex, this.pz - ez);
      if (pDist < radius * 0.75) {
        const pDmg = Math.round(36 * (1 - pDist / (radius * 0.75)));
        if (pDmg > 0) this.damagePlayer(pDmg);
      }
    }
  }

  private damageEnemy(
    enemy: EnemyEntity,
    dmg: number,
    dirX: number,
    dirZ: number,
    heavy: boolean,
  ): void {
    if (enemy.state === 'dead') return;
    enemy.hp -= dmg;
    enemy.hitFlash = 0.1;
    enemy.squash = enemy.kind === 'titan' ? 0.12 : 0.25;
    const kbScale = enemy.kind === 'titan' ? 0.28 : 1.0;
    enemy.vx += dirX * (heavy ? 6.5 : 3.2) * kbScale;
    enemy.vz += dirZ * (heavy ? 6.5 : 3.2) * kbScale;

    if (enemy.state === 'patrol') {
      enemy.state = 'chase';
      enemy.stateTimer = 0.2;
    }

    // Boss enrage phase at <= 50% HP
    if (enemy.kind === 'titan' && !this.bossEnragedTriggered && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.5) {
      this.bossEnragedTriggered = true;
      enemy.enraged = true;
      enemy.speed *= 1.32;
      this.setStatus('¡EL TITÁN DEL AVERNO ENFURECE! INVOCANDO DEMONIOS', 3.0);
      this.audio.playEnemyAlert();
      const cs = this.level.cellSize;
      const leftX = 3 * cs;
      const rightX = (this.gridW - 4) * cs;
      const midZ = Math.floor(this.gridH / 2) * cs;
      this.spawnEnemy('imp', leftX, midZ, true);
      this.spawnEnemy('imp', rightX, midZ, true);
      this.spawnParticles(leftX, 1.2, midZ, 16, 0xff3322);
      this.spawnParticles(rightX, 1.2, midZ, 16, 0xff3322);
    }

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.state = 'dead';
      enemy.deathProgress = 0;
      enemy.rig.telegraphOrb.visible = false;
      this.kills++;
      this.score +=
        enemy.kind === 'titan'
          ? 2500
          : enemy.kind === 'baron'
          ? 500
          : enemy.kind === 'cacodemon'
          ? 250
          : 120;

      if (enemy.kind === 'titan') {
        this.audio.playExplosion();
        this.spawnDecal(enemy.x, enemy.z, 'scorch', 2.4);
        this.spawnParticles(enemy.x, 1.8, enemy.z, 30, 0xff5511);
        this.spawnParticles(enemy.x, 2.6, enemy.z, 24, 0xffdd44);
        this.hitstopTimer = Math.max(this.hitstopTimer, 0.08);
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.45);
        this.setStatus('¡TITÁN DEL AVERNO ANIQUILADO!', 3.0);
        this.bossVictoryCountdown = 2.0;
      } else {
        this.audio.playEnemyDeath();
        this.spawnDecal(enemy.x, enemy.z, 'blood', enemy.kind === 'baron' ? 1.55 : 1.1);
        this.spawnParticles(enemy.x, 1.0, enemy.z, 14, 0xdd1818);
        if (heavy) {
          this.hitstopTimer = Math.max(this.hitstopTimer, 0.04);
        }
      }
      this.faceMood = 'grin';
      this.faceMoodTimer = 0.45;
    } else {
      this.spawnDecal(enemy.x, enemy.z, 'blood', 0.72);
      this.audio.playEnemyHit();
    }
  }

  private damagePlayer(amount: number): void {
    if (this.phase !== 'playing') return;
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, Math.ceil(amount * 0.55));
      this.armor -= absorbed;
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    this.damageFlash = 0.85;
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.14);
    this.faceMood = 'hurt';
    this.faceMoodTimer = 0.45;
    this.audio.playPlayerHurt();

    if (this.health <= 0) {
      this.phase = 'gameover';
      this.keys.clear();
      this.fireHeld = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
      this.emitHud();
    }
  }

  private updateDoors(dt: number): void {
    for (const d of this.doors) {
      if (d.targetOpen === 1) {
        d.closeTimer -= dt;
        if (d.closeTimer <= 0) {
          // Only close if player is not inside doorway
          const dx = d.gx * this.level.cellSize - this.px;
          const dz = d.gz * this.level.cellSize - this.pz;
          if (dx * dx + dz * dz > 2.6) {
            d.targetOpen = 0;
          } else {
            d.closeTimer = 1.5;
          }
        }
      }
      d.openProgress = THREE.MathUtils.damp(d.openProgress, d.targetOpen, 6.5, dt);
      d.mesh.position.y = d.baseY + d.openProgress * (this.level.wallHeight - 0.15);
    }
    for (const sw of this.secretWalls) {
      sw.openProgress = THREE.MathUtils.damp(sw.openProgress, sw.targetOpen, 4.8, dt);
      sw.mesh.position.y = sw.baseY + sw.openProgress * (this.level.wallHeight - 0.12);
    }
  }

  private updatePickups(dt: number, elapsedSec: number): void {
    for (const p of this.pickups) {
      if (p.collected) continue;
      p.mesh.rotation.y = elapsedSec * 1.9 + p.phase;
      p.mesh.position.y = Math.sin(elapsedSec * 3.2 + p.phase) * 0.08;

      const dSq = (p.x - this.px) ** 2 + (p.z - this.pz) ** 2;
      if (dSq < 1.35 * 1.35) {
        let taken = false;
        if (p.kind === 'health' && this.health < this.maxHealth) {
          this.health = Math.min(this.maxHealth, this.health + 25);
          this.setStatus('+25 SALUD', 1.3);
          taken = true;
        } else if (p.kind === 'armor' && this.armor < this.maxArmor) {
          this.armor = Math.min(this.maxArmor, this.armor + 35);
          this.setStatus('+35 BLINDAJE', 1.3);
          taken = true;
        } else if (p.kind === 'ammo') {
          this.score += 100;
          this.setStatus('CAJA DE MUNICIÓN · +100 PTS', 1.3);
          taken = true;
        } else if (p.kind === 'key') {
          this.hasKey = true;
          this.score += 300;
          this.setStatus('LLAVE CARMESÍ ADQUIRIDA · REFUERZOS DETECTADOS', 2.6);
          this.triggerAmbush();
          taken = true;
        } else if (
          p.kind === 'supershotgun_gun' ||
          p.kind === 'chaingun_gun' ||
          p.kind === 'plasma_gun' ||
          p.kind === 'rocket_gun' ||
          p.kind === 'bfg_gun'
        ) {
          const weaponMap: Record<string, WeaponId> = {
            supershotgun_gun: 'supershotgun',
            chaingun_gun: 'chaingun',
            plasma_gun: 'plasma',
            rocket_gun: 'rocket',
            bfg_gun: 'bfg',
          };
          const wId = weaponMap[p.kind];
          const spec = WEAPON_SPECS[wId];
          if (!this.unlockedWeapons.includes(wId)) {
            this.unlockedWeapons.push(wId);
          }
          this.score += 250;
          this.armor = Math.min(this.maxArmor, this.armor + 15);
          this.switchWeapon(wId, false);
          this.setStatus(`${spec.name} [${spec.slot}] · +250 PTS`, 2.0);
          taken = true;
        }

        if (taken) {
          p.collected = true;
          p.mesh.visible = false;
          this.pickupFlash = 0.55;
          this.faceMood = 'grin';
          this.faceMoodTimer = 0.4;
          const isSpecial =
            p.kind === 'key' || p.kind.endsWith('_gun');
          this.audio.playPickup(isSpecial);
          this.emitHud();
        }
      }
    }
  }

  private triggerAmbush(): void {
    if (this.ambushTriggered || !this.level.ambushTriggers) return;
    this.ambushTriggered = true;
    const cs = this.level.cellSize;
    for (const amb of this.level.ambushTriggers) {
      const wx = amb.x * cs;
      const wz = amb.z * cs;
      this.spawnEnemy(amb.kind, wx, wz, true);
      this.spawnParticles(wx, 1.2, wz, 14, 0xff3322);
    }
    this.audio.playEnemyAlert();
  }

  private updateBarrels(dt: number): void {
    for (const b of this.barrels) {
      if (!b.alive) continue;
      if (b.hitFlash > 0) {
        b.hitFlash = Math.max(0, b.hitFlash - dt);
      }
    }
  }

  private updateEnemies(dt: number, elapsedSec: number): void {
    for (const e of this.enemies) {
      if (e.state === 'dead') {
        if (e.deathProgress < 1) {
          e.deathProgress = Math.min(1, e.deathProgress + dt * 3.4);
          e.rig.body.rotation.x = -e.deathProgress * (Math.PI * 0.48);
          e.rig.body.position.y = -e.deathProgress * 0.55;
        }
        continue;
      }

      // Hit flash & squash-and-stretch recovery (preserving glowing eyes/cores!)
      if (e.hitFlash > 0) {
        e.hitFlash = Math.max(0, e.hitFlash - dt);
        const flashVal = e.hitFlash > 0 ? 1 : 0;
        for (const m of e.rig.hitMeshes) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (!mat.emissive) continue;
          if (flashVal > 0) {
            mat.emissive.setHex(0xffffff);
            mat.emissiveIntensity = 1.6;
          } else {
            mat.emissive.setHex(m.userData.baseEmissive ?? 0);
            mat.emissiveIntensity = m.userData.baseEmissiveIntensity ?? 0;
          }
        }
      }

      e.squash = THREE.MathUtils.damp(e.squash, 0, 14, dt);
      const sXZ = 1 + e.squash * 0.45;
      const sY = 1 - e.squash * 0.35;
      e.rig.body.scale.set(sXZ, sY, sXZ);

      // Decay knockback velocity
      e.vx = THREE.MathUtils.damp(e.vx, 0, 8, dt);
      e.vz = THREE.MathUtils.damp(e.vz, 0, 8, dt);

      const dx = this.px - e.x;
      const dz = this.pz - e.z;
      const dist = Math.hypot(dx, dz);
      const canSee = dist < 24 && this.hasLineOfSight(e.x, e.z, this.px, this.pz);

      let moveX = 0;
      let moveZ = 0;

      const dampYaw = (target: number) => {
        const diff = Math.atan2(Math.sin(target - e.yaw), Math.cos(target - e.yaw));
        e.yaw += diff * (1 - Math.exp(-12 * dt));
      };

      if (e.state === 'patrol') {
        if (canSee) {
          e.state = 'chase';
          e.stateTimer = 0.35;
          this.audio.playEnemyAlert();
        } else {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.patrolDir += (Math.random() - 0.5) * Math.PI * 1.4;
            e.stateTimer = 1.5 + Math.random() * 1.5;
          }
          moveX = Math.cos(e.patrolDir) * e.speed * 0.38;
          moveZ = Math.sin(e.patrolDir) * e.speed * 0.38;
          dampYaw(Math.atan2(moveX, moveZ));
        }
      } else if (e.state === 'chase') {
        dampYaw(Math.atan2(dx, dz));
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) {
          e.strafeSign *= -1;
          e.strafeTimer = 0.8 + Math.random() * 1.0;
        }

        const nx = dist > 0.01 ? dx / dist : 0;
        const nz = dist > 0.01 ? dz / dist : 1;
        const sx = -nz * e.strafeSign;
        const sz = nx * e.strafeSign;

        // Keep optimal engagement distance per enemy archetype
        const desiredDist =
          e.kind === 'imp' ? 4.2 : e.kind === 'baron' ? 6.5 : e.kind === 'titan' ? 9.5 : 8.2;
        const forwardFactor = dist > desiredDist ? 1.0 : dist < desiredDist * 0.55 ? -0.45 : 0.15;
        const strafeFactor = e.kind === 'cacodemon' ? 0.85 : e.kind === 'titan' ? 0.45 : 0.58;

        moveX = (nx * forwardFactor + sx * strafeFactor) * e.speed;
        moveZ = (nz * forwardFactor + sz * strafeFactor) * e.speed;

        e.stateTimer -= dt;
        if (canSee && dist <= e.attackRange && e.stateTimer <= 0) {
          e.state = 'windup';
          e.stateTimer =
            e.kind === 'trooper'
              ? 0.4
              : e.kind === 'imp'
              ? 0.48
              : e.kind === 'cacodemon'
              ? 0.56
              : e.kind === 'titan'
              ? e.enraged
                ? 0.45
                : 0.64
              : 0.62;
        }
      } else if (e.state === 'windup') {
        // Visible attack telegraph!
        dampYaw(Math.atan2(dx, dz));
        e.stateTimer -= dt;
        const maxWindup = e.kind === 'baron' || e.kind === 'titan' ? 0.64 : 0.5;
        const charge = THREE.MathUtils.clamp(1 - e.stateTimer / maxWindup, 0, 1);

        e.rig.telegraphOrb.visible = true;
        e.rig.telegraphOrb.scale.setScalar(0.6 + charge * 1.15);
        (e.rig.telegraphOrb.material as THREE.MeshBasicMaterial).opacity = 0.45 + charge * 0.55;
        e.rig.rightArm.rotation.x = -charge * 1.25;
        e.rig.leftArm.rotation.x = -charge * 1.25;

        if (e.stateTimer <= 0) {
          e.rig.telegraphOrb.visible = false;
          this.fireEnemyAttack(e);
          e.state = 'recover';
          e.stateTimer =
            e.kind === 'trooper'
              ? 0.55
              : e.kind === 'imp'
              ? 0.75
              : e.kind === 'titan'
              ? e.enraged
                ? 0.52
                : 0.78
              : 0.95;
        }
      } else if (e.state === 'recover') {
        e.stateTimer -= dt;
        e.rig.rightArm.rotation.x = THREE.MathUtils.damp(e.rig.rightArm.rotation.x, 0, 10, dt);
        e.rig.leftArm.rotation.x = THREE.MathUtils.damp(e.rig.leftArm.rotation.x, 0, 10, dt);
        if (e.stateTimer <= 0) {
          e.state = 'chase';
          e.stateTimer = (e.kind === 'titan' ? 0.42 : 0.6) + Math.random() * 0.7;
        }
      }

      // Apply movement + knockback with sliding collision
      const totalVx = moveX + e.vx;
      const totalVz = moveZ + e.vz;
      const nextEx = e.x + totalVx * dt;
      if (!this.isObstacleHit(nextEx, e.z, e.rig.baseRadius)) {
        e.x = nextEx;
      }
      const nextEz = e.z + totalVz * dt;
      if (!this.isObstacleHit(e.x, nextEz, e.rig.baseRadius)) {
        e.z = nextEz;
      }

      e.rig.root.position.set(e.x, 0, e.z);
      e.rig.root.rotation.y = e.yaw;

      // Procedural gait / hover animation
      const speedMag = Math.hypot(moveX, moveZ);
      if (e.kind === 'cacodemon') {
        e.rig.body.position.y = Math.sin(elapsedSec * 3.4 + e.walkPhase) * 0.2;
        e.rig.leftLeg.rotation.x = Math.sin(elapsedSec * 5 + e.walkPhase) * 0.25;
        e.rig.rightLeg.rotation.x = -Math.sin(elapsedSec * 5 + e.walkPhase) * 0.25;
      } else if (speedMag > 0.3) {
        e.walkPhase += dt * speedMag * 2.2;
        const swing = Math.sin(e.walkPhase) * 0.55;
        e.rig.leftLeg.rotation.x = swing;
        e.rig.rightLeg.rotation.x = -swing;
        if (e.state !== 'windup') {
          e.rig.leftArm.rotation.x = -swing * 0.6;
          e.rig.rightArm.rotation.x = swing * 0.6;
        }
      } else {
        e.rig.leftLeg.rotation.x = THREE.MathUtils.damp(e.rig.leftLeg.rotation.x, 0, 10, dt);
        e.rig.rightLeg.rotation.x = THREE.MathUtils.damp(e.rig.rightLeg.rotation.x, 0, 10, dt);
      }
    }
  }

  private fireEnemyAttack(e: EnemyEntity): void {
    const startY = e.kind === 'titan' ? 2.45 : e.kind === 'baron' ? 1.7 : 1.35;
    _vecA.set(this.px - e.x, this.py - 0.18 - startY, this.pz - e.z).normalize();

    const spawnBolt = (
      dirX: number,
      dirY: number,
      dirZ: number,
      kind: ProjectileEntity['kind'],
      speed: number,
      color: number,
      size: number,
      dmg: number,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 16, 12),
        new THREE.MeshBasicMaterial({ color }),
      );
      const sx = e.x + dirX * (e.kind === 'titan' ? 1.1 : 0.7);
      const sz = e.z + dirZ * (e.kind === 'titan' ? 1.1 : 0.7);
      mesh.position.set(sx, startY, sz);
      this.scene.add(mesh);
      this.projectiles.push({
        fromPlayer: false,
        kind,
        x: sx,
        y: startY,
        z: sz,
        vx: dirX * speed,
        vy: dirY * speed,
        vz: dirZ * speed,
        damage: dmg,
        radius: size,
        splashRadius: 0,
        life: 3.6,
        mesh,
      });
    };

    if (e.kind === 'imp') {
      spawnBolt(_vecA.x, _vecA.y, _vecA.z, 'fireball', 13.5, 0xff7711, 0.18, e.damage);
    } else if (e.kind === 'trooper') {
      spawnBolt(_vecA.x, _vecA.y, _vecA.z, 'plasma', 19.5, 0xff2244, 0.14, e.damage);
    } else if (e.kind === 'cacodemon') {
      [-0.14, 0, 0.14].forEach((spread) => {
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const dx = _vecA.x * cos - _vecA.z * sin;
        const dz = _vecA.x * sin + _vecA.z * cos;
        spawnBolt(dx, _vecA.y, dz, 'caco_orb', 12.5, 0xff33ee, 0.2, e.damage);
      });
    } else if (e.kind === 'titan') {
      // Titan 5-orb wide magma barrage!
      const boltSpeed = e.enraged ? 18.5 : 15.5;
      [-0.3, -0.15, 0, 0.15, 0.3].forEach((spread) => {
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const dx = _vecA.x * cos - _vecA.z * sin;
        const dz = _vecA.x * sin + _vecA.z * cos;
        spawnBolt(dx, _vecA.y, dz, 'baron_orb', boltSpeed, e.enraged ? 0xff2200 : 0xff6600, 0.28, e.damage);
      });
    } else {
      // Baron triple magma spread
      [-0.18, 0, 0.18].forEach((spread) => {
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const dx = _vecA.x * cos - _vecA.z * sin;
        const dz = _vecA.x * sin + _vecA.z * cos;
        spawnBolt(dx, _vecA.y, dz, 'baron_orb', 15.0, 0xff4400, 0.24, e.damage);
      });
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y += dt * 8;

      let remove = p.life <= 0 || p.y <= 0.05 || p.y >= this.level.wallHeight;

      if (!remove && this.isObstacleHit(p.x, p.z, p.radius)) {
        remove = true;
      }

      if (!remove && p.fromPlayer) {
        for (const b of this.barrels) {
          if (!b.alive) continue;
          if (p.y <= 1.25 && (p.x - b.x) ** 2 + (p.z - b.z) ** 2 < (0.48 + p.radius) ** 2) {
            this.damageBarrel(b, p.damage);
            this.shotsHit++;
            remove = true;
            break;
          }
        }
      }

      if (!remove && p.fromPlayer) {
        for (const e of this.enemies) {
          if (e.state === 'dead') continue;
          if (p.y >= 0 && p.y <= e.rig.baseHeight + 0.15) {
            const hitR = e.rig.baseRadius + p.radius;
            if ((p.x - e.x) ** 2 + (p.z - e.z) ** 2 < hitR * hitR) {
              const spd = Math.hypot(p.vx, p.vz) || 1;
              this.damageEnemy(e, p.damage, p.vx / spd, p.vz / spd, p.kind === 'rocket' || p.kind === 'bfg');
              this.shotsHit++;
              remove = true;
              break;
            }
          }
        }
      }

      if (!remove && !p.fromPlayer) {
        const hitR = 0.5 + p.radius;
        if ((p.x - this.px) ** 2 + (p.z - this.pz) ** 2 < hitR * hitR) {
          this.damagePlayer(p.damage);
          remove = true;
        }
      }

      if (remove) {
        if (p.kind === 'rocket') {
          this.explodeAt(p.x, p.y, p.z, p.splashRadius, p.damage);
        } else if (p.kind === 'bfg') {
          this.explodeAt(p.x, p.y, p.z, p.splashRadius, p.damage, undefined, 0x33ff66);
        } else {
          const color = p.fromPlayer ? 0x22eeff : 0xff6622;
          this.spawnParticles(p.x, p.y, p.z, 6, color);
        }
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Attach 2 pooled dynamic point lights to active bright projectiles
    for (let li = 0; li < this.projLights.length; li++) {
      const pl = this.projLights[li];
      const proj = this.projectiles[this.projectiles.length - 1 - li];
      if (proj) {
        pl.position.set(proj.x, proj.y, proj.z);
        const colorMap: Record<ProjectileEntity['kind'], number> = {
          plasma: 0x22eeff,
          rocket: 0xff8822,
          bfg: 0x33ff66,
          fireball: 0xff6611,
          caco_orb: 0xff33ee,
          baron_orb: 0xff4400,
        };
        pl.color.setHex(colorMap[proj.kind]);
        pl.intensity = proj.kind === 'bfg' ? 3.8 : 2.3;
      } else {
        pl.intensity = 0;
      }
    }
  }

  private spawnParticles(x: number, y: number, z: number, count: number, colorHex: number): void {
    let spawned = 0;
    for (const pt of this.particles) {
      if (pt.active) continue;
      pt.active = true;
      pt.x = x;
      pt.y = y;
      pt.z = z;
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.0 + Math.random() * 5.5;
      pt.vx = Math.cos(angle) * spd;
      pt.vy = 1.5 + Math.random() * 4.5;
      pt.vz = Math.sin(angle) * spd;
      pt.maxLife = 0.25 + Math.random() * 0.25;
      pt.life = pt.maxLife;
      pt.gravity = 15;
      (pt.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      pt.mesh.position.set(x, y, z);
      pt.mesh.scale.setScalar(1);
      pt.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private updateParticles(dt: number): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        pt.mesh.visible = false;
        continue;
      }
      pt.vy -= pt.gravity * dt;
      pt.x += pt.vx * dt;
      pt.y = Math.max(0.05, pt.y + pt.vy * dt);
      pt.z += pt.vz * dt;
      pt.mesh.position.set(pt.x, pt.y, pt.z);
      pt.mesh.scale.setScalar(Math.max(0.1, pt.life / pt.maxLife));
    }
  }

  private spawnShellCasing(count: number): void {
    const sinY = Math.sin(this.smoothYaw);
    const cosY = Math.cos(this.smoothYaw);
    const rightX = cosY;
    const rightZ = -sinY;
    const fwdX = -sinY;
    const fwdZ = -cosY;
    let spawned = 0;
    for (const sh of this.shells) {
      if (sh.active) continue;
      sh.active = true;
      sh.x = this.px + rightX * 0.28 + fwdX * 0.35;
      sh.y = this.py - 0.16;
      sh.z = this.pz + rightZ * 0.28 + fwdZ * 0.35;
      const sideSpd = 1.8 + Math.random() * 1.4;
      sh.vx = rightX * sideSpd + (Math.random() - 0.5) * 0.6;
      sh.vy = 1.6 + Math.random() * 0.9;
      sh.vz = rightZ * sideSpd + (Math.random() - 0.5) * 0.6;
      sh.rx = Math.random() * 6;
      sh.ry = Math.random() * 6;
      sh.rz = Math.random() * 6;
      sh.life = 1.4;
      sh.mesh.position.set(sh.x, sh.y, sh.z);
      sh.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private spawnDecal(x: number, z: number, kind: 'blood' | 'scorch', size: number): void {
    const dec = this.decals[this.decalCursor % this.decals.length];
    this.decalCursor++;
    const mat = dec.mesh.material as THREE.MeshBasicMaterial;
    mat.map = kind === 'scorch' ? this.textures.decalScorchTex : this.textures.decalBloodTex;
    mat.opacity = kind === 'scorch' ? 0.88 : 0.82;
    mat.needsUpdate = true;
    dec.mesh.position.set(x, 0.022 + (this.decalCursor % 4) * 0.001, z);
    dec.mesh.rotation.y = Math.random() * Math.PI * 2;
    dec.mesh.scale.setScalar(size);
    dec.mesh.visible = true;
    dec.timer = 22;
  }

  private updateShellsAndDecals(dt: number): void {
    for (const sh of this.shells) {
      if (!sh.active) continue;
      sh.life -= dt;
      if (sh.life <= 0) {
        sh.active = false;
        sh.mesh.visible = false;
        continue;
      }
      sh.vy -= 14 * dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.z += sh.vz * dt;
      if (sh.y < 0.03) {
        sh.y = 0.03;
        sh.vy = -sh.vy * 0.42;
        sh.vx *= 0.65;
        sh.vz *= 0.65;
      }
      sh.rx += dt * 18;
      sh.ry += dt * 14;
      sh.mesh.position.set(sh.x, sh.y, sh.z);
      sh.mesh.rotation.set(sh.rx, sh.ry, sh.rz);
    }

    for (const dec of this.decals) {
      if (!dec.mesh.visible) continue;
      dec.timer -= dt;
      if (dec.timer < 3) {
        (dec.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (dec.timer / 3) * 0.82);
      }
      if (dec.timer <= 0) {
        dec.mesh.visible = false;
      }
    }
  }

  private updateCameraTransform(dt: number): void {
    this.smoothYaw = THREE.MathUtils.damp(this.smoothYaw, this.yaw, 36, dt);
    this.smoothPitch = THREE.MathUtils.damp(this.smoothPitch, this.pitch, 36, dt);

    const speed = Math.hypot(this.pvx, this.pvz);
    const bobOffset = Math.sin(this.walkBob) * Math.min(speed / 7, 1) * 0.05;
    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    this.camera.position.set(this.px + shakeX, this.py + bobOffset + shakeY, this.pz);
    _euler.set(this.smoothPitch, this.smoothYaw, this.cameraRoll, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);
  }

  private emitHud(): void {
    const cs = this.level.cellSize;
    const entities: AutomapEntity[] = [];
    let bossInfo: BossHudInfo | null = null;

    for (const e of this.enemies) {
      if (e.state !== 'dead') {
        if (e.kind === 'titan') {
          entities.push({ x: e.x / cs, z: e.z / cs, kind: 'boss', alive: true });
          bossInfo = {
            name: 'EL TITÁN DEL AVERNO',
            hp: Math.ceil(e.hp),
            maxHp: e.maxHp,
            enraged: Boolean(e.enraged),
          };
        } else {
          entities.push({ x: e.x / cs, z: e.z / cs, kind: 'enemy', alive: true });
        }
      }
    }
    for (const p of this.pickups) {
      if (!p.collected && p.kind === 'key') {
        entities.push({ x: p.x / cs, z: p.z / cs, kind: 'key' });
      }
    }
    for (const d of this.doors) {
      entities.push({ x: d.gx, z: d.gz, kind: 'door', alive: d.locked });
    }
    for (const sw of this.secretWalls) {
      if (sw.discovered) {
        entities.push({ x: sw.gx, z: sw.gz, kind: 'secret', alive: true });
      }
    }
    if (this.hasExitPortal) {
      entities.push({ x: this.exitPos.x / cs, z: this.exitPos.z / cs, kind: 'exit' });
    }

    this.onHudUpdate({
      phase: this.phase,
      difficulty: this.difficulty,
      sensitivity: this.sensitivity,
      sectorIndex: this.sectorIndex,
      sectorCode: this.level.code,
      sectorName: this.level.name,
      isBossLevel: Boolean(this.level.isBossLevel),
      boss: bossInfo,
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      armor: Math.ceil(this.armor),
      maxArmor: this.maxArmor,
      ammo: this.ammo,
      maxAmmo: this.maxAmmo,
      activeWeapon: this.activeWeapon,
      unlockedWeapons: [...this.unlockedWeapons],
      hasKey: this.hasKey,
      kills: this.kills,
      totalEnemies: this.totalEnemies,
      secretsFound: this.secretsFound,
      totalSecrets: this.totalSecrets,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      elapsedSeconds: this.elapsedSeconds,
      score: this.score,
      crosshairSpread: this.weaponRecoil * 48,
      promptText: this.promptText,
      statusMessage: this.statusMessage,
      damageFlash: this.damageFlash,
      pickupFlash: this.pickupFlash,
      faceMood: this.faceMood,
      muted: this.audio.isMuted(),
      pointerLocked: this.pointerLocked,
      gamepadConnected: this.gamepadConnected,
      gamepadName: this.gamepadName,
      gamepadBlocked: this.gamepadBlocked,
      invertY: this.invertY,
      playerGridX: this.px / cs,
      playerGridZ: this.pz / cs,
      playerYaw: this.smoothYaw,
      exploredCells: this.explored,
      automapGrid: this.level.grid,
      automapEntities: entities,
    });
  }

  private pollGamepad(dt: number): void {
    const pads = this.readGamepads();
    const connectedPads: Gamepad[] = [];
    for (let i = 0; i < pads.length; i++) {
      const candidate = pads[i];
      if (candidate && candidate.connected && (candidate.buttons.length > 0 || candidate.axes.length >= 2)) {
        connectedPads.push(candidate);
      }
    }

    if (connectedPads.length === 0) {
      if (this.gamepadConnected) {
        this.gamepadConnected = false;
        this.gamepadName = null;
        this.activePadIndex = null;
        this.padFireHeld = false;
        this.padMoveX = 0;
        this.padMoveY = 0;
        this.padSprint = false;
        this.prevPadButtons = [];
        this.emitHud();
      }
      return;
    }

    // Auto-select whichever connected gamepad actually has live button/stick activity
    // (avoids locking onto ghost HID devices like gaming keyboards/mice at index 0)
    let pad: Gamepad | undefined;
    for (const candidate of connectedPads) {
      const hasBtn = candidate.buttons.some((b) => b.pressed || b.value > 0.35);
      const hasAxis = candidate.axes.some((a) => Math.abs(a) > 0.35 && Math.abs(a) < 0.99);
      if (hasBtn || hasAxis) {
        pad = candidate;
        if (this.activePadIndex !== candidate.index) {
          this.activePadIndex = candidate.index;
          this.prevPadButtons = [];
        }
        break;
      }
    }
    if (!pad) {
      pad =
        connectedPads.find((p) => p.index === this.activePadIndex) ||
        connectedPads.find((p) => p.mapping === 'standard') ||
        connectedPads[0];
    }

    const nextName = pad.id || 'Gamepad';
    if (!this.gamepadConnected || this.gamepadName !== nextName) {
      this.gamepadConnected = true;
      this.gamepadName = nextName;
      this.activePadIndex = pad.index;
      this.emitHud();
    }

    const btnPressed = (idx: number): boolean => {
      const b = pad!.buttons[idx];
      return Boolean(b && (b.pressed || b.value > 0.35));
    };

    const justPressed = (idx: number): boolean => {
      const curr = btnPressed(idx);
      const prev = this.prevPadButtons[idx] ?? false;
      return curr && !prev;
    };

    const applyDeadzone = (val: number, dz: number): number => {
      const abs = Math.abs(val);
      if (abs < dz) return 0;
      const scaled = (abs - dz) / (1 - dz);
      return Math.sign(val) * (scaled * scaled * 0.65 + scaled * 0.35);
    };

    if (this.phase === 'title' && !this.cinematicActive) {
      const tiers: Difficulty[] = ['facil', 'normal', 'pesadilla'];
      if (justPressed(14) || justPressed(4)) {
        const idx = tiers.indexOf(this.difficulty);
        this.setDifficulty(tiers[(idx + 2) % tiers.length]);
      } else if (justPressed(15) || justPressed(5)) {
        const idx = tiers.indexOf(this.difficulty);
        this.setDifficulty(tiers[(idx + 1) % tiers.length]);
      } else if (justPressed(0) || justPressed(9)) {
        this.startGame(this.difficulty);
      }
    } else if (this.phase === 'playing') {
      // Left Stick + D-Pad Up/Down for movement
      const lx = applyDeadzone(pad.axes[0] ?? 0, 0.18);
      const ly = applyDeadzone(pad.axes[1] ?? 0, 0.18);
      const dUp = btnPressed(12) ? 1 : 0;
      const dDown = btnPressed(13) ? 1 : 0;
      this.padMoveX = lx;
      this.padMoveY = THREE.MathUtils.clamp(-ly + dUp - dDown, -1, 1);

      // Right Stick for smooth camera aim (supports standard [2,3] and PS3 DualShock 3 / DirectInput [2,5] or [3,4])
      const isDualShock3 = /playstation|sony|dualshock|sixaxis|ps3|054c/i.test(pad.id || '');
      let rawRx = pad.axes[2] ?? 0;
      let rawRy = pad.axes[3] ?? 0;
      if (pad.mapping !== 'standard' && pad.axes.length >= 6) {
        if (isDualShock3 && Math.abs(pad.axes[2] ?? 0) < 0.05 && Math.abs(pad.axes[4] ?? 0) > 0.15) {
          // Some Linux/PS3 SIXAXIS drivers map Right-X to axis 3 or 2 and Right-Y to axis 4 or 5
          rawRx = pad.axes[3] ?? rawRx;
          rawRy = pad.axes[4] ?? rawRy;
        } else if (Math.abs(rawRy) > 0.85 && Math.abs(pad.axes[5] ?? 0) < 0.85) {
          rawRy = pad.axes[5] ?? 0;
        }
      }
      const rx = applyDeadzone(rawRx, 0.16);
      const ry = applyDeadzone(rawRy, 0.16);
      const ySign = this.invertY ? -1 : 1;
      if (rx !== 0) {
        this.yaw -= rx * 2.85 * this.sensitivity * dt;
      }
      if (ry !== 0) {
        this.pitch = THREE.MathUtils.clamp(
          this.pitch - ry * ySign * 1.9 * this.sensitivity * dt,
          -0.55,
          0.55,
        );
      }

      // Sprint: LT / L2 (6) or L3 (10)
      const l2Axis = pad.mapping !== 'standard' && pad.axes.length > 4 && isDualShock3 ? (pad.axes[4] ?? -1) > 0.2 : false;
      this.padSprint = btnPressed(6) || btnPressed(10) || l2Axis;

      // Shoot: RT / R2 (7) or Cross / A (0)
      const r2Axis = pad.mapping !== 'standard' && pad.axes.length > 5 && isDualShock3 ? (pad.axes[5] ?? -1) > 0.2 : false;
      const firing = btnPressed(7) || btnPressed(0) || r2Axis;
      if (firing && !this.padFireHeld) {
        this.fireJustPressed = true;
        this.audio.unlock();
      }
      this.padFireHeld = firing;

      // Weapons: L1/LB (4) / D-Pad Left (14) prev, R1/RB (5) / D-Pad Right (15) / Triangle/Y (3) next
      if (justPressed(4) || justPressed(14)) {
        this.cycleWeapon(-1);
      } else if (justPressed(5) || justPressed(15) || justPressed(3)) {
        this.cycleWeapon(1);
      }

      // Interact (Doors, Secret Walls, Exit): Square/X (2) or Circle/B (1)
      if (justPressed(2) || justPressed(1)) {
        this.tryInteract();
      }

      // Pause: Start (9) or PS3 Select (8)
      if (justPressed(9) || (isDualShock3 && justPressed(8))) {
        this.pauseGame();
      }
    } else if (this.phase === 'paused') {
      if (justPressed(9) || justPressed(0) || justPressed(1)) {
        this.resumeGame();
      } else if (justPressed(3)) {
        this.returnToTitle();
      }
    } else if (this.phase === 'sector_clear') {
      if (justPressed(0) || justPressed(9)) {
        this.nextSector();
      }
    } else if (this.phase === 'victory' || this.phase === 'gameover') {
      if (justPressed(0) || justPressed(9)) {
        this.restartSector();
      } else if (justPressed(1)) {
        this.returnToTitle();
      }
    }

    for (let i = 0; i < pad.buttons.length; i++) {
      this.prevPadButtons[i] = btnPressed(i);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('gamepadconnected', this.onGamepadChange);
    window.removeEventListener('gamepaddisconnected', this.onGamepadChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    canvas.removeEventListener('wheel', this.onWheel);

    this.audio.dispose();
    this.textures.dispose();
    if (this.envRT) this.envRT.dispose();
    if (this.composer) this.composer.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
