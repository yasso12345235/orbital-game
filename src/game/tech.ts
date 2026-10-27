/**
 * Tech tree — unlocks components, launchers and missions. Pure data + helpers.
 */
export interface TechNode {
  id: string;
  name: string;
  nameAr: string;
  desc: string;
  descAr: string;
  cost: number; // credits
  requires: string[]; // node ids that must be unlocked first
  unlocks: { components?: string[]; launchers?: string[]; missions?: string[] };
  /** Layout position in the tree (grid units). */
  x: number;
  y: number;
  tier: 1 | 2 | 3 | 4 | 5;
}

export const TECH_NODES: TechNode[] = [
  {
    id: 'basic', name: 'Flight Basics', nameAr: 'أساسيات الطيران',
    desc: 'Ride-share class hardware and Earth-orbit missions.',
    descAr: 'عتاد فئة المشاركة وأساسيات مدار الأرض.',
    cost: 0, requires: [], tier: 1, x: 0, y: 2,
    unlocks: {
      components: ['bus_cubesat', 'bus_small', 'pow_body', 'pow_deploy', 'prop_coldgas', 'prop_monoprop', 'com_uhf', 'com_sband', 'pay_cam', 'thm_passive'],
      launchers: ['electron'],
      missions: ['cubesat_imaging', 'polar_climate'],
    },
  },
  {
    id: 'small_lift', name: 'Small-Lift Operations', nameAr: 'عمليات الرفع الصغير',
    desc: 'Dedicated small launchers and imaging payloads.',
    descAr: 'إطلاق صغير مخصص وحمولات تصوير.',
    cost: 350000, requires: ['basic'], tier: 2, x: 1, y: 1,
    unlocks: {
      components: ['pay_multispec', 'thm_active'],
      launchers: ['vega_c'],
      missions: ['comsat_gto'],
    },
  },
  {
    id: 'medium_lift', name: 'Medium-Lift Workhorses', nameAr: 'صواريخ الرفع المتوسط',
    desc: 'Falcon and Ariane class launchers; biprop propulsion.',
    descAr: 'صواريخ فئة فالكون وأريان؛ دفع ثنائي.',
    cost: 900000, requires: ['small_lift'], tier: 3, x: 2, y: 2,
    unlocks: {
      components: ['bus_medium', 'prop_biprop'],
      launchers: ['falcon9', 'ariane64'],
      missions: [],
    },
  },
  {
    id: 'deep_space', name: 'Deep-Space Systems', nameAr: 'أنظمة الفضاء العميق',
    desc: 'Lunar and Mars transfers, Ka-band, hydrolox stages.',
    descAr: 'انتقالات القمر والمريخ، نطاق Ka، مراحل هيدرولوکس.',
    cost: 1600000, requires: ['medium_lift'], tier: 4, x: 3, y: 1,
    unlocks: {
      components: ['pow_large', 'prop_hydrolox', 'com_xband', 'com_ka'],
      launchers: [],
      missions: ['lunar_probe', 'mars_orbiter', 'curiosity_style'],
    },
  },
  {
    id: 'outer_planets', name: 'Outer Planets', nameAr: 'الكواكب الخارجية',
    desc: 'Super-heavy lift, giant arrays, ion drives, radar.',
    descAr: 'رفع فائق، مصفوفات عملاقة، دفع أيوني، رادار.',
    cost: 3000000, requires: ['deep_space'], tier: 5, x: 4, y: 2,
    unlocks: {
      components: ['bus_heavy', 'pow_xl', 'prop_ion', 'thm_deep', 'pay_radar', 'pay_lab'],
      launchers: ['falcon_heavy'],
      missions: ['jupiter_probe', 'europa_mission', 'voyager_style'],
    },
  },
  {
    id: 'inner_worlds', name: 'Inner-Solar Campaign', nameAr: 'حملة النظام الداخلي',
    desc: 'Venus-bound hardware and optical comms.',
    descAr: 'عتاد متجه إلى الزهرة واتصالات بصرية.',
    cost: 600000, requires: ['medium_lift'], tier: 3, x: 2, y: 0,
    unlocks: {
      components: ['com_laser'],
      launchers: [],
      missions: ['venus_climate'],
    },
  },
  {
    id: 'nuclear_power', name: 'Nuclear Power Systems', nameAr: 'أنظمة الطاقة النووية',
    desc: 'RTG generation that ignores the inverse-square law.',
    descAr: 'توليد نووي يتجاهل قانون التربيع العكسي.',
    cost: 1400000, requires: ['deep_space'], tier: 4, x: 3, y: 0,
    unlocks: {
      components: ['pow_rtg'],
      launchers: [],
      missions: [],
    },
  },
  {
    id: 'small_bodies', name: 'Small-Body Ops', nameAr: 'عمليات الأجسام الصغيرة',
    desc: 'Asteroid rendezvous and dust/chemistry science.',
    descAr: 'لقاء الكويكبات وعلم الغبار والكيمياء.',
    cost: 900000, requires: ['deep_space'], tier: 4, x: 4, y: 0,
    unlocks: {
      components: ['pay_spectro'],
      launchers: [],
      missions: ['eros_rendezvous'],
    },
  },
  {
    id: 'giant_system', name: 'Giant-System Expedition', nameAr: 'بعثة العمالقة',
    desc: 'Saturn-scale direct missions and 100 t lift.',
    descAr: 'مهام زحل المباشرة ورفع 100 طن.',
    cost: 3600000, requires: ['outer_planets', 'nuclear_power'], tier: 5, x: 5, y: 2,
    unlocks: {
      components: [],
      launchers: ['super_heavy'],
      missions: ['titan_explorer'],
    },
  },
];

export const STARTING_NODE = 'basic';

export function unlockedIdsFor(nodes: string[]): { components: Set<string>; launchers: Set<string>; missions: Set<string> } {
  const components = new Set<string>();
  const launchers = new Set<string>();
  const missions = new Set<string>();
  for (const id of nodes) {
    const node = TECH_NODES.find((n) => n.id === id);
    if (!node) continue;
    node.unlocks.components?.forEach((c) => components.add(c));
    node.unlocks.launchers?.forEach((l) => launchers.add(l));
    node.unlocks.missions?.forEach((m) => missions.add(m));
  }
  return { components, launchers, missions };
}

export function canUnlock(node: TechNode, unlocked: string[], credits: number): { ok: boolean; reason: string | null } {
  if (unlocked.includes(node.id)) return { ok: false, reason: 'already' };
  for (const req of node.requires) {
    if (!unlocked.includes(req)) return { ok: false, reason: `missing:${req}` };
  }
  if (credits < node.cost) return { ok: false, reason: 'credits' };
  return { ok: true, reason: null };
}

/** XP levels. */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 300) + 1);
}
export function xpForNextLevel(xp: number): { current: number; needed: number } {
  const lvl = levelForXp(xp);
  const base = (lvl - 1) * 300;
  return { current: xp - base, needed: 300 };
}
