/**
 * Design validation — explains failures with numbers instead of just blocking.
 * Data-driven: component / launcher / mission tables are injected (JSON in step 2).
 */
import { availableDvMps } from './propulsion';
import { solarFluxAt, solarPowerW, eclipseFraction, requiredBatteryWh } from './power';
import { SOLAR_FLUX_W_M2 } from '../core/constants';
import { computeCost } from './cost';
import { redundantReliability, systemReliability } from './reliability';
import { dataRateMbps, missionDistanceKm, downlinkHours } from './comms';
import { orbitReadout } from './orbital';
import type {
  BudgetBreakdown,
  ComponentSpec,
  DifficultyId,
  LauncherSpec,
  MissionSpec,
  SpacecraftDesign,
  ValidationCheck,
} from '../core/types';

export interface LookupTables {
  components: Record<string, ComponentSpec>;
  launchers: Record<string, LauncherSpec>;
  missions: Record<string, MissionSpec>;
}

export interface ValidationResult {
  budget: BudgetBreakdown;
  checks: ValidationCheck[];
  go: boolean; // true only if all hard gates pass
  hardFailIds: string[];
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function resolveDesign(
  design: SpacecraftDesign,
  tables: LookupTables,
  budgetCap: number,
): ValidationResult {
  const mission = tables.missions[design.missionId];
  const launcher = tables.launchers[design.launcherId];
  if (!mission) throw new Error(`unknown mission ${design.missionId}`);
  if (!launcher) throw new Error(`unknown launcher ${design.launcherId}`);

  const comps: { spec: ComponentSpec; redundant: boolean }[] = [];
  for (const cat of ['bus', 'power', 'propulsion', 'comms', 'payload', 'thermal'] as const) {
    const id = design.components[cat];
    if (!id) continue;
    const spec = tables.components[id];
    if (!spec) throw new Error(`unknown component ${id}`);
    comps.push({ spec, redundant: !!design.redundancy[cat] });
  }

  // --- Mass ---
  let dryMassKg = 0;
  let hardwareCost = 0;
  for (const { spec, redundant } of comps) {
    dryMassKg += spec.massKg + (redundant ? (spec.redundancyMassKg ?? spec.massKg) : 0);
    hardwareCost += spec.cost + (redundant ? (spec.redundancyCost ?? spec.cost) : 0);
  }
  const propKg = Math.max(0, design.propellantMassKg);
  const totalMassKg = dryMassKg + propKg;
  const massMarginKg = launcher.capacityToLeoKg - totalMassKg;

  // --- Propulsion / dv ---
  const propComp = comps.find((c) => c.spec.category === 'propulsion')?.spec;
  const ispS = propComp?.ispS ?? 0;
  const propCap = propComp?.propCapacityKg ?? propKg;
  const clampedProp = Math.min(propKg, propCap);
  const availableDv = ispS > 0 ? availableDvMps(ispS, dryMassKg, clampedProp) : 0;
  const dvMargin = availableDv - mission.requiredDvMps;

  // --- Power ---
  const powerComp = comps.find((c) => c.spec.category === 'power')?.spec;
  const baseArea = (powerComp?.solarAreaM2 ?? 0) + (design.extraSolarAreaM2 ?? 0);
  const eff = powerComp?.solarEfficiency ?? 0.25;
  // Any target with its own flux entry maps straight through; orbit slots fall back to Earth.
  const fluxTarget = mission.target in SOLAR_FLUX_W_M2 ? mission.target : 'earth';
  const flux = solarFluxAt(fluxTarget);
  const rtgW = powerComp?.outputPowerW ?? 0; // flux-independent nuclear generation
  const generationW = solarPowerW(baseArea, eff, flux, 0) + rtgW;
  let loadW = 0;
  for (const { spec } of comps) loadW += Math.max(0, spec.powerW);
  const batteryWh = (powerComp?.batteryCapacityWh ?? 0) + (design.extraBatteryWh ?? 0);
  const orbit = orbitReadout(mission.altitudeKm);
  const orbitClass = mission.target === 'leo' || mission.target === 'gto' || mission.target === 'geo' ? 'leo' : 'deep';
  const eFrac = eclipseFraction(orbitClass === 'leo' ? 'leo' : 'deep');
  const battNeeded = requiredBatteryWh(loadW, orbit.periodS, eFrac, 1.2);
  const powerMargin = generationW - loadW;

  // --- Cost ---
  const cost = computeCost({
    designCost: mission.designCost,
    hardwareCost,
    launcherCost: launcher.cost,
    opsPerMonth: mission.opsCostPerMonth,
    durationDays: mission.durationDays,
  });

  // --- Reliability ---
  const subR = comps.map(({ spec, redundant }) => redundantReliability(spec.reliability, redundant));
  const scR = subR.length ? subR.reduce((a, b) => a * b, 1) : 0;
  const overallR = systemReliability(subR, launcher.reliability);

  // --- Link ---
  const commsComp = comps.find((c) => c.spec.category === 'comms')?.spec;
  const distKm = missionDistanceKm(mission.target);
  const rateMbps = commsComp ? dataRateMbps({ txPowerW: commsComp.txPowerW ?? 0, antennaGain: commsComp.antennaGain ?? 0, distanceKm: distKm }) : 0;
  const dlHours = downlinkHours(mission.scienceGoalGb, rateMbps);
  const availHours = mission.durationDays * 24 * 0.2; // 20% duty-cycle assumption, documented

  const budget: BudgetBreakdown = {
    totalMassKg,
    dryMassKg,
    propellantMassKg: clampedProp,
    launcherCapacityKg: launcher.capacityToLeoKg,
    massMarginKg,
    availableDvMps: availableDv,
    requiredDvMps: mission.requiredDvMps,
    dvMarginMps: dvMargin,
    generationW,
    loadW,
    powerMarginW: powerMargin,
    batteryWh,
    costTotal: cost.total,
    costBreakdown: { design: cost.design, hardware: cost.hardware, launcher: cost.launcher, operations: cost.operations },
    reliability: overallR,
    spacecraftReliability: scR,
  };

  const checks: ValidationCheck[] = [];

  // MASS (hard gate)
  checks.push({
    id: 'mass',
    pass: massMarginKg >= 0,
    margin: massMarginKg,
    unit: 'kg',
    severity: massMarginKg >= 0 ? (massMarginKg / launcher.capacityToLeoKg < 0.1 ? 'warn' : 'ok') : 'fail',
    message:
      massMarginKg >= 0
        ? `Mass OK: ${fmt(totalMassKg)} kg vs ${fmt(launcher.capacityToLeoKg)} kg capacity (margin +${fmt(massMarginKg)} kg).`
        : `Too heavy: ${fmt(totalMassKg)} kg exceeds ${launcher.name} capacity ${fmt(launcher.capacityToLeoKg)} kg by ${fmt(-massMarginKg)} kg. Remove ${fmt(-massMarginKg)} kg or choose a bigger launcher.`,
  });

  // DV (hard gate)
  if (propKg > propCap) {
    checks.push({
      id: 'dv',
      pass: false,
      margin: propCap - propKg,
      unit: 'kg',
      severity: 'fail',
      message: `Propellant overload: tank holds ${fmt(propCap)} kg but design carries ${fmt(propKg)} kg. Remove ${fmt(propKg - propCap)} kg of propellant (dv uses ${fmt(clampedProp)} kg).`,
    });
  } else if (ispS <= 0) {
    checks.push({
      id: 'dv',
      pass: false,
      margin: -mission.requiredDvMps,
      unit: 'm/s',
      severity: 'fail',
      message: `No propulsion: select a propulsion unit with Isp to gain delta-v (mission needs ${fmt(mission.requiredDvMps, 0)} m/s).`,
    });
  } else {
    checks.push({
      id: 'dv',
      pass: dvMargin >= 0,
      margin: dvMargin,
      unit: 'm/s',
      severity: dvMargin >= 0 ? (dvMargin < 200 ? 'warn' : 'ok') : 'fail',
      message:
        dvMargin >= 0
          ? `Delta-v OK: ${fmt(availableDv, 0)} m/s available vs ${fmt(mission.requiredDvMps, 0)} m/s required (margin +${fmt(dvMargin, 0)} m/s, Isp ${fmt(ispS, 0)} s).`
          : `Not enough delta-v: ${fmt(availableDv, 0)} m/s available vs ${fmt(mission.requiredDvMps, 0)} m/s required (shortfall ${fmt(-dvMargin, 0)} m/s). Add propellant (tank max ${fmt(propCap)} kg), raise Isp, or shed dry mass (now ${fmt(dryMassKg)} kg).`,
    });
  }

  // POWER (hard gate)
  checks.push({
    id: 'power',
    pass: powerMargin >= 0,
    margin: powerMargin,
    unit: 'W',
    severity: powerMargin >= 0 ? (powerMargin < 20 ? 'warn' : 'ok') : 'fail',
    message:
      powerMargin >= 0
        ? `Power OK: ${fmt(generationW)} W generation${rtgW > 0 ? ` (incl. ${fmt(rtgW)} W nuclear)` : ''} vs ${fmt(loadW)} W load (margin +${fmt(powerMargin)} W at ${mission.target}, flux ${fmt(flux, 0)} W/m²).`
        : `Power deficit: ${fmt(generationW)} W generation vs ${fmt(loadW)} W load (shortfall ${fmt(-powerMargin)} W). ${eff * flux > 0 ? `Add ${fmt(-powerMargin / (eff * flux), 2)} m² solar area` : 'Add solar area'}${rtgW > 0 ? ' or raise nuclear output' : ''}, or cut loads.`,
  });

  // BATTERY (hard gate)
  const battMargin = batteryWh - battNeeded;
  checks.push({
    id: 'battery',
    pass: battMargin >= 0,
    margin: battMargin,
    unit: 'Wh',
    severity: battMargin >= 0 ? (battMargin < battNeeded * 0.25 ? 'warn' : 'ok') : 'fail',
    message:
      battMargin >= 0
        ? `Battery OK: ${fmt(batteryWh)} Wh vs ${fmt(battNeeded)} Wh needed for eclipse (margin +${fmt(battMargin)} Wh).`
        : `Battery too small: ${fmt(batteryWh)} Wh vs ${fmt(battNeeded)} Wh needed (shortfall ${fmt(-battMargin)} Wh). Add battery or reduce night loads.`,
  });

  // LINK (soft — affects science, not GO)
  checks.push({
    id: 'link',
    pass: dlHours <= availHours,
    margin: availHours - dlHours,
    unit: 'h',
    severity: dlHours <= availHours ? (dlHours > availHours * 0.7 ? 'warn' : 'ok') : 'warn',
    message:
      rateMbps <= 0
        ? `No downlink: select a comms unit (Tx power + antenna gain).`
        : dlHours <= availHours
          ? `Link OK: ${fmt(rateMbps, 3)} Mbps at ${mission.target} (downlink ${fmt(dlHours)} h vs ${fmt(availHours)} h budget).`
          : `Weak link: ${fmt(rateMbps, 3)} Mbps needs ${fmt(dlHours)} h to return ${fmt(mission.scienceGoalGb)} Gb but only ${fmt(availHours)} h available at 20% duty. Raise Tx power/gain or accept less science.`,
  });

  // COST (soft)
  const costMargin = budgetCap - cost.total;
  checks.push({
    id: 'cost',
    pass: costMargin >= 0,
    margin: costMargin,
    unit: 'credits',
    severity: costMargin >= 0 ? (costMargin < budgetCap * 0.1 ? 'warn' : 'ok') : 'warn',
    message:
      costMargin >= 0
        ? `Budget OK: ${fmt(cost.total, 0)} / ${fmt(budgetCap, 0)} credits (margin +${fmt(costMargin, 0)}).`
        : `Over budget: ${fmt(cost.total, 0)} vs cap ${fmt(budgetCap, 0)} (over by ${fmt(-costMargin, 0)}). Cheaper launcher/parts or shorter ops reduce cost; overruns hurt score, not launch.`,
  });

  // RELIABILITY (soft)
  checks.push({
    id: 'reliability',
    pass: true,
    margin: overallR,
    unit: 'p',
    severity: overallR >= 0.75 ? 'ok' : overallR >= 0.5 ? 'warn' : 'warn',
    message: `Reliability ${(overallR * 100).toFixed(1)}% (spacecraft ${(scR * 100).toFixed(1)}% × launcher ${(launcher.reliability * 100).toFixed(1)}%). ${overallR < 0.5 ? 'High risk — add redundancy to weak subsystems.' : overallR < 0.75 ? 'Moderate risk — consider redundancy.' : 'Healthy margin.'}`,
  });

  const hardFailIds = checks.filter((c) => c.severity === 'fail').map((c) => c.id);
  void (budgetCap as number);
  return { budget, checks, go: hardFailIds.length === 0, hardFailIds };
}

export const DIFFICULTY_BUDGET_CAP: Record<DifficultyId, number> = {
  tutorial: 5_000_000,
  normal: 2_500_000,
  engineer: 1_500_000,
  director: 900_000,
};
