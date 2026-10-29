/**
 * surface/model.ts — data-driven definitions for the planetary expedition:
 * planet surface profiles, resources, suit upgrades and habitat modules.
 *
 * Everything here is numbers-in-data: the simulation in `engine.ts` only reads
 * these tables, and the 3D scene only reads colours/sizes. Adding a planet is a
 * new entry, never a new code path.
 */

export type ResourceId = 'ice' | 'regolith' | 'ore' | 'crystal' | 'biomass';

export type UpgradeId = 'o2' | 'thermal' | 'shield' | 'boots' | 'cargo' | 'solar';

export type ModuleKind = 'o2gen' | 'extractor' | 'greenhouse' | 'heater' | 'radshield' | 'solar';

export type WeatherId = 'clear' | 'dust_storm' | 'radiation_spell' | 'cold_snap' | 'heat_wave' | 'meteor_shower' | 'solar_flare' | 'acid_rain';

export interface ResourceDef {
  id: ResourceId;
  en: string;
  ar: string;
  color: string;
  /** Short glyph used in the HUD chips. */
  tag: string;
}

export const RESOURCES: ResourceDef[] = [
  { id: 'ice', en: 'Water ice', ar: 'جليد مائي', color: '#7fd8ff', tag: 'H2O' },
  { id: 'regolith', en: 'Regolith', ar: 'تربة سطحية', color: '#c8b79a', tag: 'REG' },
  { id: 'ore', en: 'Metal ore', ar: 'خام معدني', color: '#e0a15c', tag: 'ORE' },
  { id: 'crystal', en: 'Crystal', ar: 'بلورات', color: '#c39bff', tag: 'CRY' },
  { id: 'biomass', en: 'Organics', ar: 'مواد عضوية', color: '#8ee08a', tag: 'ORG' },
];

export const RESOURCE_IDS = RESOURCES.map((r) => r.id);

export interface SurfaceProfile {
  target: string;
  nameEn: string;
  nameAr: string;
  gravity: number;
  /** Mean surface temperature, °C. */
  tempC: number;
  /** Day/night excursion either side of the mean, °C. */
  swingC: number;
  /** Relative radiation load (1 = Mars). */
  radiation: number;
  /** Local solar hour at touchdown (0–24). */
  startHour: number;
  skyDay: string;
  skyNight: string;
  ground: string;
  groundAlt: string;
  sun: string;
  /** Relative spawn weight for each node type. */
  bias: Record<ResourceId, number>;
  /** Relative frequency of each weather type (weights, not probabilities). */
  weatherBias: Record<WeatherId, number>;
  hazardEn: string;
  hazardAr: string;
}

const bias = (
  ice: number,
  regolith: number,
  ore: number,
  crystal: number,
  biomass: number,
): Record<ResourceId, number> => ({ ice, regolith, ore, crystal, biomass });

/**
 * Surface profiles for every landable target. Orbital destinations (LEO/GTO/GEO)
 * land back on Earth; the gas giant itself is abstracted to its cloud deck so a
 * Jupiter-bound probe still has somewhere to come down.
 */
export const SURFACE_PROFILES: Record<string, SurfaceProfile> = {
  earth: {
    target: 'earth',
    nameEn: 'Earth · Meridian Flats',
    nameAr: 'الأرض · سهل ميريديان',
    gravity: 9.807,
    tempC: 16,
    swingC: 12,
    radiation: 0.35,
    startHour: 7.2,
    skyDay: '#8fc4e8',
    skyNight: '#0b1a2e',
    ground: '#6d7f63',
    groundAlt: '#4b5a48',
    sun: '#fff2d2',
    bias: bias(1.4, 1, 0.6, 0.2, 1.6),
    weatherBias: { clear: 1.0, dust_storm: 0.2, radiation_spell: 0.1, cold_snap: 0.3, heat_wave: 0.2, meteor_shower: 0.1, solar_flare: 0.1, acid_rain: 0.1 },
    hazardEn: 'Weather fronts and long nights.',
    hazardAr: 'جبهات جوية وليالٍ طويلة.',
  },
  moon: {
    target: 'moon',
    nameEn: 'Moon · Shackleton Rim',
    nameAr: 'القمر · حافة شاكلتون',
    gravity: 1.62,
    tempC: -23,
    swingC: 120,
    radiation: 1.35,
    startHour: 5.4,
    skyDay: '#05070f',
    skyNight: '#02030a',
    ground: '#9a9a9e',
    groundAlt: '#5d5f66',
    sun: '#fff8e8',
    bias: bias(1.2, 2, 0.7, 0.3, 0.05),
    weatherBias: { clear: 1.0, dust_storm: 0.5, radiation_spell: 0.3, cold_snap: 0.5, heat_wave: 0.1, meteor_shower: 0.2, solar_flare: 0.2, acid_rain: 0.0 },
    hazardEn: 'No atmosphere: hard radiation and 120°C swings.',
    hazardAr: 'لا غلاف جوي: إشعاع قاسٍ وتغيّر 120°م.',
  },
  mars: {
    target: 'mars',
    nameEn: 'Mars · Jezero Basin',
    nameAr: 'المريخ · حوض جيزيرو',
    gravity: 3.71,
    tempC: -63,
    swingC: 38,
    radiation: 1,
    startHour: 6.6,
    skyDay: '#c98a5c',
    skyNight: '#1b0f0c',
    ground: '#a9552f',
    groundAlt: '#6f341d',
    sun: '#ffd2a1',
    bias: bias(1.6, 1.8, 0.9, 0.25, 0.1),
    weatherBias: { clear: 0.8, dust_storm: 1.5, radiation_spell: 0.1, cold_snap: 0.4, heat_wave: 0.1, meteor_shower: 0.1, solar_flare: 0.1, acid_rain: 0.0 },
    hazardEn: 'Thin CO₂ air, dust storms, −100°C nights.',
    hazardAr: 'هواء CO₂ رقيق وعواصف غبار وليالٍ −100°م.',
  },
  venus: {
    target: 'venus',
    nameEn: 'Venus · Ishtar Terrace',
    nameAr: 'الزهرة · مصطبة عشتار',
    gravity: 8.87,
    tempC: 464,
    swingC: 8,
    radiation: 0.55,
    startHour: 9,
    skyDay: '#d9a441',
    skyNight: '#3a230d',
    ground: '#8d6a3f',
    groundAlt: '#5d452a',
    sun: '#ffe0a0',
    bias: bias(0.2, 1.6, 1.3, 0.8, 0.05),
    weatherBias: { clear: 0.6, dust_storm: 0.4, radiation_spell: 0.1, cold_snap: 0.1, heat_wave: 2.0, meteor_shower: 0.0, solar_flare: 0.1, acid_rain: 1.0 },
    hazardEn: 'Crushing pressure and 464°C: only short surface stays.',
    hazardAr: 'ضغط ساحق و464°م: فترات سطح قصيرة فقط.',
  },
  eros: {
    target: 'eros',
    nameEn: 'Eros · Saddle Ridge',
    nameAr: 'إيروس · حافة السرج',
    gravity: 0.005,
    tempC: -73,
    swingC: 40,
    radiation: 1.25,
    startHour: 4.8,
    skyDay: '#04060d',
    skyNight: '#010206',
    ground: '#7a7065',
    groundAlt: '#4a433b',
    sun: '#fff4dd',
    bias: bias(0.9, 1.4, 1.8, 1.2, 0.02),
    weatherBias: { clear: 1.0, dust_storm: 0.3, radiation_spell: 0.2, cold_snap: 0.3, heat_wave: 0.1, meteor_shower: 0.3, solar_flare: 0.1, acid_rain: 0.0 },
    hazardEn: 'Microgravity: anchor every step or drift away.',
    hazardAr: 'جذب شبه معدوم: ثبّت كل خطوة أو ستنجرف.',
  },
  jupiter: {
    target: 'jupiter',
    nameEn: 'Jupiter · Cloud Deck 07',
    nameAr: 'المشتري · سطح السحب 07',
    gravity: 24.79,
    tempC: -108,
    swingC: 6,
    radiation: 2.4,
    startHour: 10.2,
    skyDay: '#d7b48a',
    skyNight: '#2a1c14',
    ground: '#b08f6d',
    groundAlt: '#6d5741',
    sun: '#ffe9c6',
    bias: bias(0.1, 0.2, 0.6, 0.9, 0.4),
    weatherBias: { clear: 0.4, dust_storm: 0.2, radiation_spell: 2.0, cold_snap: 0.5, heat_wave: 0.1, meteor_shower: 0.1, solar_flare: 0.3, acid_rain: 0.0 },
    hazardEn: 'Floating platform only: gravity and radiation are lethal.',
    hazardAr: 'منصة عائمة فقط: الجذب والإشعاع قاتلان.',
  },
  europa: {
    target: 'europa',
    nameEn: 'Europa · Conamara Chaos',
    nameAr: 'أوروبا · فوضى كونامارا',
    gravity: 1.31,
    tempC: -170,
    swingC: 18,
    radiation: 2.2,
    startHour: 3.6,
    skyDay: '#c9d8e8',
    skyNight: '#0a1526',
    ground: '#dfe9f2',
    groundAlt: '#9fb6ca',
    sun: '#eaf4ff',
    bias: bias(2.4, 0.6, 0.5, 0.8, 0.05),
    weatherBias: { clear: 0.5, dust_storm: 0.1, radiation_spell: 1.5, cold_snap: 1.0, heat_wave: 0.05, meteor_shower: 0.2, solar_flare: 0.1, acid_rain: 0.0 },
    hazardEn: 'Jupiter’s radiation belts and ice quakes.',
    hazardAr: 'أحزمة إشعاع المشتري وزلازل جليدية.',
  },
  titan: {
    target: 'titan',
    nameEn: 'Titan · Kraken Shore',
    nameAr: 'تيتان · ساحل كراكن',
    gravity: 1.35,
    tempC: -179,
    swingC: 4,
    radiation: 0.8,
    startHour: 8.1,
    skyDay: '#b98a4e',
    skyNight: '#1a120a',
    ground: '#8a6a3d',
    groundAlt: '#4f3d24',
    sun: '#ffd9a0',
    bias: bias(1.8, 1.2, 0.7, 0.3, 1.6),
    weatherBias: { clear: 0.7, dust_storm: 0.6, radiation_spell: 0.1, cold_snap: 0.8, heat_wave: 0.05, meteor_shower: 0.1, solar_flare: 0.1, acid_rain: 0.4 },
    hazardEn: 'Methane lakes, −179°C, thick orange haze.',
    hazardAr: 'بحيرات ميثان و−179°م وضباب برتقالي كثيف.',
  },
};

/** Orbital destinations come back down to Earth. */
export function surfaceProfileFor(target: string | undefined): SurfaceProfile {
  if (!target) return SURFACE_PROFILES.earth;
  return SURFACE_PROFILES[target] ?? SURFACE_PROFILES.earth;
}

export function isLandable(target: string | undefined): boolean {
  return !!target;
}

export interface UpgradeDef {
  id: UpgradeId;
  en: string;
  ar: string;
  descEn: string;
  descAr: string;
  maxLevel: number;
  /** Cost for the next level, given the current level (0-based). */
  cost: (level: number) => Partial<Record<ResourceId, number>>;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'o2',
    en: 'O₂ recycler',
    ar: 'معيد تدوير الأكسجين',
    descEn: '−18% oxygen draw per level.',
    descAr: '−18% استهلاك أكسجين لكل مستوى.',
    maxLevel: 3,
    cost: (l) => ({ ice: 6 + l * 4, ore: 2 + l * 2 }),
  },
  {
    id: 'thermal',
    en: 'Thermal shell',
    ar: 'درع حراري',
    descEn: '−20% heat loss per level.',
    descAr: '−20% فقد حرارة لكل مستوى.',
    maxLevel: 3,
    cost: (l) => ({ regolith: 5 + l * 4, ore: 2 + l * 2 }),
  },
  {
    id: 'shield',
    en: 'Radiation liner',
    ar: 'بطانة إشعاعية',
    descEn: '−22% radiation dose per level.',
    descAr: '−22% جرعة إشعاع لكل مستوى.',
    maxLevel: 3,
    cost: (l) => ({ ore: 5 + l * 4, crystal: 1 + l }),
  },
  {
    id: 'boots',
    en: 'Mag boots',
    ar: 'أحذية مغناطيسية',
    descEn: '+12% surface speed per level.',
    descAr: '+12% سرعة على السطح لكل مستوى.',
    maxLevel: 3,
    cost: (l) => ({ ore: 4 + l * 3, regolith: 4 + l * 3 }),
  },
  {
    id: 'cargo',
    en: 'Cargo rig',
    ar: 'حمالة شحن',
    descEn: '+40 resource capacity per level.',
    descAr: '+40 سعة موارد لكل مستوى.',
    maxLevel: 3,
    cost: (l) => ({ regolith: 6 + l * 4, ice: 3 + l * 2 }),
  },
  {
    id: 'solar',
    en: 'Solar skin',
    ar: 'جلد شمسي',
    descEn: '+25% solar charging per level.',
    descAr: '+25% شحن شمسي لكل مستوى.',
    maxLevel: 3,
    cost: (l) => ({ crystal: 2 + l, ore: 3 + l * 2 }),
  },
];

export interface ModuleDef {
  id: ModuleKind;
  en: string;
  ar: string;
  descEn: string;
  descAr: string;
  cost: Partial<Record<ResourceId, number>>;
  color: string;
  /** Resource produced per hour while at base, or null if none. */
  produces: { id: ResourceId; amountPerHour: number } | null;
}

export const MODULES: ModuleDef[] = [
  {
    id: 'o2gen',
    en: 'O₂ generator',
    ar: 'مولّد أكسجين',
    descEn: 'Refills suit oxygen while you are at base.',
    descAr: 'يعيد تعبئة الأكسجين داخل القاعدة.',
    cost: { ice: 8, regolith: 4 },
    color: '#7fd8ff',
    produces: null,
  },
  {
    id: 'extractor',
    en: 'Water extractor',
    ar: 'مستخرج مياه',
    descEn: 'Pulls drinking water from local ice.',
    descAr: 'يستخرج مياه الشرب من الجليد المحلي.',
    cost: { ice: 10, ore: 4 },
    color: '#66b6ff',
    produces: null,
  },
  {
    id: 'greenhouse',
    en: 'Hydroponics',
    ar: 'زراعة مائية',
    descEn: 'Grows biomass food while the reactor has power.',
    descAr: 'ينتج غذاء حيوي (بيوماس) طالما تتوفر الطاقة.',
    cost: { ice: 6, biomass: 6, regolith: 4 },
    color: '#8ee08a',
    produces: { id: 'biomass', amountPerHour: 0.5 },
  },
  {
    id: 'heater',
    en: 'Thermal hut',
    ar: 'كوخ حراري',
    descEn: 'Holds suit warmth at base through the night.',
    descAr: 'يحفظ حرارة البدلة ليلاً داخل القاعدة.',
    cost: { regolith: 10, ore: 5 },
    color: '#ffb066',
    produces: null,
  },
  {
    id: 'radshield',
    en: 'Rad shelter',
    ar: 'ملجأ إشعاعي',
    descEn: 'Scrubs accumulated dose near the lander.',
    descAr: 'يخفض الجرعة المتراكمة قرب المركبة.',
    cost: { ore: 8, crystal: 2 },
    color: '#c39bff',
    produces: null,
  },
  {
    id: 'solar',
    en: 'Solar array',
    ar: 'مصفوفة شمسية',
    descEn: 'Charges the suit battery, day and night.',
    descAr: 'يشحن بطارية البدلة ليلاً ونهاراً.',
    cost: { regolith: 6, ore: 4, crystal: 3 },
    color: '#ffe08a',
    produces: null,
  },
];

export const MODULE_IDS = MODULES.map((m) => m.id);

/** Effect of each weather type on life-support drain and radiation. */
export interface WeatherEffect {
  /** Multiplier applied to O₂ / warmth / charge drain while active. */
  drainMult: number;
  /** Multiplier applied to radiation gain while active. */
  radiationMult: number;
  /** Visibility reduction for the surface HUD (0 = none, 1 = heavy). */
  visibility: number;
}

export const WEATHER_EFFECTS: Record<WeatherId, WeatherEffect> = {
  clear: { drainMult: 1.0, radiationMult: 1.0, visibility: 0 },
  dust_storm: { drainMult: 1.25, radiationMult: 1.0, visibility: 0.6 },
  radiation_spell: { drainMult: 1.0, radiationMult: 2.0, visibility: 0.2 },
  cold_snap: { drainMult: 1.4, radiationMult: 1.0, visibility: 0.1 },
  heat_wave: { drainMult: 1.15, radiationMult: 1.0, visibility: 0.05 },
  meteor_shower: { drainMult: 1.1, radiationMult: 1.0, visibility: 0.4 },
  solar_flare: { drainMult: 1.05, radiationMult: 1.5, visibility: 0.15 },
  acid_rain: { drainMult: 1.3, radiationMult: 1.0, visibility: 0.5 },
};

export interface UpgradeCostPart {
  id: ResourceId;
  amount: number;
}

export function costParts(cost: Partial<Record<ResourceId, number>>): UpgradeCostPart[] {
  return RESOURCE_IDS.filter((id) => (cost[id] ?? 0) > 0).map((id) => ({ id, amount: cost[id] as number }));
}

/* ------------------------------------------------------------------ tuning */

/** Percent per hour while standing in the open. */
export const DRAIN = {
  o2: 0.62,
  water: 0.42,
  food: 0.3,
  warmth: 0.22,
  charge: 0.12,
  integrity: 0.03,
  radiation: 0.08,
} as const;

/** Metres from the lander that still count as “at base”. */
export const BASE_RADIUS = 9;

/** Real seconds → local hours. One 24 h sol takes ~48 s. */
export const HOURS_PER_SECOND = 0.5;

/** Walking speed in metres/second at upgrade level 0. */
export const WALK_SPEED = 7;

/** Rover unlock cost and speed bonus. All tuning stays in this data file. */
export const ROVER_COST: Partial<Record<ResourceId, number>> = { regolith: 12, ore: 6, crystal: 2 };
export const ROVER_SPEED_BONUS = 0.6; // +60% surface speed when rover is unlocked

/* ------------------------------------------------------------------ sol goals */

/** A daily survival objective, assigned per sol (24 local hours). */
export interface SolGoal {
  id: string;
  en: string;
  ar: string;
  /** How many of the target resource/units must be gathered/built. */
  target: number;
  /** Resource id to gather, or null if not a gather goal. */
  resource: ResourceId | null;
  /** Module kind to build, or null if not a build goal. */
  module: ModuleKind | null;
  /** XP reward on completion. */
  xp: number;
}

export const SOL_GOALS: SolGoal[] = [
  { id: 'gather_ice', en: 'Collect 5 water ice', ar: 'اجمع 5 وحدات جليد', target: 5, resource: 'ice', module: null, xp: 25 },
  { id: 'gather_regolith', en: 'Collect 8 regolith', ar: 'اجمع 8 وحدات تربة سطحية', target: 8, resource: 'regolith', module: null, xp: 20 },
  { id: 'gather_ore', en: 'Collect 4 metal ore', ar: 'اجمع 4 وحدات خام معدني', target: 4, resource: 'ore', module: null, xp: 30 },
  { id: 'gather_crystal', en: 'Collect 3 crystal', ar: 'اجمع 3 وحدات بلورات', target: 3, resource: 'crystal', module: null, xp: 35 },
  { id: 'gather_biomass', en: 'Collect 4 organics', ar: 'اجمع 4 وحدات مواد عضوية', target: 4, resource: 'biomass', module: null, xp: 25 },
  { id: 'build_o2gen', en: 'Build an O₂ generator', ar: 'ابنِ مولّد أكسجين', target: 1, resource: null, module: 'o2gen', xp: 45 },
  { id: 'build_extractor', en: 'Build a water extractor', ar: 'ابنِ مستخرج مياه', target: 1, resource: null, module: 'extractor', xp: 45 },
  { id: 'build_greenhouse', en: 'Build a hydroponics bay', ar: 'ابنِ ذراعًا مائيًا', target: 1, resource: null, module: 'greenhouse', xp: 45 },
  { id: 'build_heater', en: 'Build a thermal hut', ar: 'ابنِ كوخًا حراريًا', target: 1, resource: null, module: 'heater', xp: 45 },
];

/** Pick a deterministic sol goal from seed + sol number. */
export function pickSolGoal(seed: number, sol: number): SolGoal {
  const roll = ((hashString(`${seed}:sol:${sol}`) >>> 0) / 0xffffffff);
  const idx = Math.floor(roll * SOL_GOALS.length);
  return SOL_GOALS[Math.min(idx, SOL_GOALS.length - 1)];
}

export const STARTING_INVENTORY: Record<ResourceId, number> = {
  ice: 6,
  regolith: 5,
  ore: 3,
  crystal: 1,
  biomass: 2,
};

export const NODE_YIELD: Record<ResourceId, number> = {
  ice: 7,
  regolith: 9,
  ore: 6,
  crystal: 4,
  biomass: 6,
};

export const XP = { gather: 10, build: 45, upgrade: 30, scan: 6 } as const;

export function levelForXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / 120);
}

export function xpIntoLevel(xp: number): { level: number; into: number; span: number } {
  const level = levelForXp(xp);
  const base = (level - 1) * 120;
  return { level, into: Math.max(0, xp - base), span: 120 };
}

/** Small deterministic string hash (FNV-1a), used for seeded random picks. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
