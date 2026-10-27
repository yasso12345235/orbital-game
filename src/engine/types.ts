/**
 * Mission Architect — core engine types.
 * Pure data contracts; no UI, no I/O.
 */
import type { TRANSFER_DV_FROM_LEO_MPS } from './constants';

export type TargetId = keyof typeof TRANSFER_DV_FROM_LEO_MPS;
// 'leo' | 'gto' | 'geo' | 'moon' | 'mars' | 'jupiter' | 'europa'

export type DifficultyId = 'tutorial' | 'normal' | 'engineer' | 'director';

export type ComponentCategory = 'bus' | 'power' | 'propulsion' | 'comms' | 'payload' | 'thermal';

export interface ComponentSpec {
  id: string;
  name: string;
  /** Arabic display name (UI language ar). Optional to keep engine tests light. */
  nameAr?: string;
  category: ComponentCategory;
  /** Dry mass in kg. */
  massKg: number;
  /** Average electrical draw in W (positive = load). Generation handled via solar fields. */
  powerW: number;
  cost: number; // credits
  /** 0..1 probability the unit works for the mission. */
  reliability: number;
  /** Extra mass if redundant copy added (kg). Defaults to massKg. */
  redundancyMassKg?: number;
  /** Extra cost if redundant copy added. Defaults to cost. */
  redundancyCost?: number;
  ispS?: number; // propulsion only
  thrustN?: number;
  propCapacityKg?: number; // max propellant this stage can hold
  solarAreaM2?: number; // power generation (solar)
  solarEfficiency?: number; // 0..1
  /** Constant electrical generation in W (e.g. RTG). Flux-independent — works anywhere. */
  outputPowerW?: number;
  batteryCapacityWh?: number; // storage contributed
  txPowerW?: number; // comms
  antennaGain?: number; // linear system gain incl. ground segment (simplified)
  sciencePower?: number; // payload science yield multiplier
  dataStorageGb?: number;
  /** Grid footprint in builder cells (w x h), proportional to volume. */
  footprintW?: number;
  footprintH?: number;
  /** Tech-tree tier (1 = start, 3 = advanced). */
  tier?: number;
  description?: string;
  descriptionAr?: string;
  source?: string;
}

export interface LauncherSpec {
  id: string;
  name: string;
  nameAr?: string;
  /** Deliverable mass to target orbit in kg (game uses LEO-proxy capacity + target derate). */
  capacityToLeoKg: number;
  cost: number;
  reliability: number; // 0..1 launch success probability
  description?: string;
  descriptionAr?: string;
  source?: string;
}

export interface MissionSpec {
  id: string;
  name: string;
  nameAr?: string;
  target: TargetId;
  /** Orbit altitude above body surface in km (circular proxy). */
  altitudeKm: number;
  inclinationDeg: number;
  durationDays: number;
  /** Monthly operations cost. */
  opsCostPerMonth: number;
  designCost: number;
  /** Required spacecraft transfer dv AFTER launcher separation (m/s). */
  requiredDvMps: number;
  /** Science goal in data units (Gb returned, weighted). */
  scienceGoalGb: number;
  /** Minimum power load that must be served (W) — derived check helper. */
  minPowerW?: number;
  difficultyStars: 1 | 2 | 3 | 4 | 5;
  lockedByDefault?: boolean;
  launchSite?: string;
  launchSiteAr?: string;
  launchWindow?: string;
  launchWindowAr?: string;
  description: string;
  descriptionAr?: string;
  source?: string;
}

export interface SpacecraftDesign {
  missionId: string;
  launcherId: string;
  /** Component ids by slot. Exactly one per category expected (bus required). */
  components: Record<ComponentCategory, string | null>;
  /** Redundancy enabled per category (adds mass/cost, raises reliability). */
  redundancy: Record<ComponentCategory, boolean>;
  propellantMassKg: number;
  /** Override solar area (m^2) — normally derived from power component but player-upgradable. */
  extraSolarAreaM2?: number;
  extraBatteryWh?: number;
}

export interface BudgetBreakdown {
  totalMassKg: number;
  dryMassKg: number;
  propellantMassKg: number;
  launcherCapacityKg: number;
  massMarginKg: number; // capacity - total (negative = over)
  availableDvMps: number;
  requiredDvMps: number;
  dvMarginMps: number;
  generationW: number; // at target, sun-pointed
  loadW: number;
  powerMarginW: number;
  batteryWh: number;
  costTotal: number;
  costBreakdown: { design: number; hardware: number; launcher: number; operations: number };
  reliability: number; // 0..1 overall incl. launcher
  spacecraftReliability: number;
}

export interface ValidationCheck {
  id: 'mass' | 'dv' | 'power' | 'battery' | 'link' | 'cost' | 'reliability';
  pass: boolean;
  /** Positive = margin, negative = shortfall. Units depend on check. */
  margin: number;
  unit: string;
  /** Human-readable explanation incl. numbers and fix suggestion. */
  message: string;
  severity: 'ok' | 'warn' | 'fail';
}

export interface SimState {
  missionId: string;
  difficulty: DifficultyId;
  elapsedDays: number;
  durationDays: number;
  propRemainingKg: number;
  batteryChargeWh: number;
  batteryCapacityWh: number;
  dataStoredGb: number;
  dataReturnedGb: number;
  scienceGoalGb: number;
  dvRemainingMps: number;
  safeMode: boolean;
  failed: boolean;
  complete: boolean;
  failureReason: string | null;
  failureDay: number | null;
  eventLog: SimEventEntry[];
  timeScale: 1 | 10 | 100;
}

export interface SimEventEntry {
  day: number;
  kind: string;
  message: string;
  severity: 'info' | 'warn' | 'critical';
}

export interface DifficultySpec {
  id: DifficultyId;
  name: string;
  budgetMultiplier: number; // applied to player budget cap (1 = generous)
  marginWarning: number; // fractional margin below which warn (e.g. 0.2 = 20%)
  eventRatePerDay: number; // base random-event probability per day
  unannouncedFailures: boolean;
  scienceScale: number;
}

export type CommandName =
  | 'FIRE'
  | 'SCAN'
  | 'NAV'
  | 'COM'
  | 'SHLD'
  | 'WARP'
  | 'CONFIRM'
  | 'BACK'
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'ROTATE_CW'
  | 'ROTATE_CCW'
  | 'PLACE'
  | 'REMOVE'
  | 'NEXT_SLOT'
  | 'ANALYSE'
  | 'PAUSE'
  | 'TAB_CYCLE';
