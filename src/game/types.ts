export type GamePhase = 'title' | 'playing' | 'paused' | 'sector_clear' | 'victory' | 'gameover';

export type Difficulty = 'facil' | 'normal' | 'pesadilla';

export const DIFFICULTY_SPECS: Record<
  Difficulty,
  { label: string; tag: string; desc: string; armor: number }
> = {
  facil: {
    label: 'FÁCIL',
    tag: 'RECLUTA',
    desc: 'Demonios 25% más débiles · 50% blindaje inicial',
    armor: 50,
  },
  normal: {
    label: 'NORMAL',
    tag: 'MARÍN',
    desc: 'Balance clásico de combate · 35% blindaje inicial',
    armor: 35,
  },
  pesadilla: {
    label: 'PESADILLA',
    tag: 'EXTREMO',
    desc: 'Demonios +30% letales y rápidos · 15% blindaje inicial',
    armor: 15,
  },
};

export type WeaponId =
  | 'chainsaw'
  | 'pistol'
  | 'shotgun'
  | 'supershotgun'
  | 'chaingun'
  | 'rocket'
  | 'plasma'
  | 'bfg';

export const WEAPON_ORDER: WeaponId[] = [
  'chainsaw',
  'pistol',
  'shotgun',
  'supershotgun',
  'chaingun',
  'rocket',
  'plasma',
  'bfg',
];

export type EnemyKind = 'imp' | 'trooper' | 'cacodemon' | 'baron' | 'titan';

export type PickupKind =
  | 'health'
  | 'armor'
  | 'ammo'
  | 'key'
  | 'supershotgun_gun'
  | 'chaingun_gun'
  | 'plasma_gun'
  | 'rocket_gun'
  | 'bfg_gun';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  shortName: string;
  slot: number;
  cooldown: number;
  spread: number;
  pellets: number;
  damage: number;
  range: number;
  isProjectile: boolean;
  isMelee: boolean;
  isAuto: boolean;
  projectileSpeed: number;
  splashRadius: number;
  recoilKick: number;
  color: number;
}

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  chainsaw: {
    id: 'chainsaw',
    name: 'MOTOSIERRA',
    shortName: 'SIERRA',
    slot: 1,
    cooldown: 0.11,
    spread: 0.04,
    pellets: 2,
    damage: 19,
    range: 2.9,
    isProjectile: false,
    isMelee: true,
    isAuto: true,
    projectileSpeed: 0,
    splashRadius: 0,
    recoilKick: 0.07,
    color: 0xffaa22,
  },
  pistol: {
    id: 'pistol',
    name: 'PISTOLA',
    shortName: 'PISTOLA',
    slot: 2,
    cooldown: 0.22,
    spread: 0.008,
    pellets: 1,
    damage: 28,
    range: 48,
    isProjectile: false,
    isMelee: false,
    isAuto: false,
    projectileSpeed: 0,
    splashRadius: 0,
    recoilKick: 0.1,
    color: 0xffdd55,
  },
  shotgun: {
    id: 'shotgun',
    name: 'ESCOPETA',
    shortName: 'ESCOPETA',
    slot: 3,
    cooldown: 0.65,
    spread: 0.055,
    pellets: 7,
    damage: 16,
    range: 40,
    isProjectile: false,
    isMelee: false,
    isAuto: false,
    projectileSpeed: 0,
    splashRadius: 0,
    recoilKick: 0.18,
    color: 0xffaa33,
  },
  supershotgun: {
    id: 'supershotgun',
    name: 'SUPER ESCOPETA',
    shortName: 'S.ESCOP.',
    slot: 4,
    cooldown: 0.92,
    spread: 0.095,
    pellets: 14,
    damage: 17,
    range: 34,
    isProjectile: false,
    isMelee: false,
    isAuto: false,
    projectileSpeed: 0,
    splashRadius: 0,
    recoilKick: 0.3,
    color: 0xff7722,
  },
  chaingun: {
    id: 'chaingun',
    name: 'AMETRALLADORA',
    shortName: 'GATLING',
    slot: 5,
    cooldown: 0.085,
    spread: 0.028,
    pellets: 1,
    damage: 18,
    range: 46,
    isProjectile: false,
    isMelee: false,
    isAuto: true,
    projectileSpeed: 0,
    splashRadius: 0,
    recoilKick: 0.055,
    color: 0xffcc44,
  },
  rocket: {
    id: 'rocket',
    name: 'LANZACOHETES',
    shortName: 'COHETES',
    slot: 6,
    cooldown: 0.82,
    spread: 0.005,
    pellets: 1,
    damage: 135,
    range: 65,
    isProjectile: true,
    isMelee: false,
    isAuto: false,
    projectileSpeed: 22,
    splashRadius: 4.5,
    recoilKick: 0.28,
    color: 0xff5511,
  },
  plasma: {
    id: 'plasma',
    name: 'RIFLE PLASMA',
    shortName: 'PLASMA',
    slot: 7,
    cooldown: 0.12,
    spread: 0.016,
    pellets: 1,
    damage: 25,
    range: 65,
    isProjectile: true,
    isMelee: false,
    isAuto: true,
    projectileSpeed: 30,
    splashRadius: 0,
    recoilKick: 0.06,
    color: 0x22eeff,
  },
  bfg: {
    id: 'bfg',
    name: 'BFG-9000',
    shortName: 'BFG-9000',
    slot: 8,
    cooldown: 1.35,
    spread: 0.002,
    pellets: 1,
    damage: 340,
    range: 80,
    isProjectile: true,
    isMelee: false,
    isAuto: false,
    projectileSpeed: 16.5,
    splashRadius: 7.8,
    recoilKick: 0.42,
    color: 0x33ff66,
  },
};

export interface LevelDef {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  cellSize: number;
  wallHeight: number;
  ambientSky: number;
  ambientGround: number;
  fogColor: number;
  fogDensity: number;
  keyLightColor: number;
  hazardType: 'acid' | 'lava';
  floorTheme: 'grate' | 'stone' | 'metal' | 'obsidian';
  startYaw?: number;
  isBossLevel?: boolean;
  grid: string[];
  ambushTriggers?: {
    x: number;
    z: number;
    kind: EnemyKind;
  }[];
}

export interface AutomapEntity {
  x: number;
  z: number;
  kind: 'enemy' | 'key' | 'exit' | 'door' | 'boss' | 'secret';
  alive?: boolean;
}

export interface BossHudInfo {
  name: string;
  hp: number;
  maxHp: number;
  enraged: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  difficulty: Difficulty;
  sensitivity: number;
  sectorIndex: number;
  sectorCode: string;
  sectorName: string;
  isBossLevel: boolean;
  boss: BossHudInfo | null;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  ammo: number;
  maxAmmo: number;
  activeWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  hasKey: boolean;
  kills: number;
  totalEnemies: number;
  secretsFound: number;
  totalSecrets: number;
  shotsFired: number;
  shotsHit: number;
  elapsedSeconds: number;
  score: number;
  crosshairSpread: number;
  promptText: string | null;
  statusMessage: string | null;
  damageFlash: number;
  pickupFlash: number;
  faceMood: 'normal' | 'firing' | 'hurt' | 'grin' | 'critical';
  muted: boolean;
  pointerLocked: boolean;
  gamepadConnected: boolean;
  gamepadName: string | null;
  gamepadBlocked: boolean;
  invertY: boolean;
  playerGridX: number;
  playerGridZ: number;
  playerYaw: number;
  exploredCells: boolean[][];
  automapGrid: string[];
  automapEntities: AutomapEntity[];
}
