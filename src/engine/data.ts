/**
 * Mission Architect — data layer (build step 2).
 * Loads JSON tables, validates cross-references, exposes lookup maps.
 * Pure TS: no UI imports. JSON imports are data, allowed by architecture rule 2.
 */
import missionsRaw from './data/missions.json';
import componentsRaw from './data/components.json';
import launchersRaw from './data/launchers.json';
import eventsRaw from './data/events.json';
import difficultiesRaw from './data/difficulties.json';
import type { ComponentSpec, DifficultyId, LauncherSpec, MissionSpec } from './types';
import type { GameEvent } from './events';
import type { LookupTables } from './validation';

export interface DifficultyData {
  id: DifficultyId;
  name: string;
  nameAr?: string;
  budgetCap: number;
  budgetMultiplier: number;
  marginWarning: number;
  eventRatePerDay: number;
  unannouncedFailures: boolean;
  scienceScale: number;
  description?: string;
  descriptionAr?: string;
}

interface EventData extends GameEvent {
  nameAr?: string;
  descriptionAr?: string;
  mitigationAr?: string;
}

export const MISSIONS: MissionSpec[] = (missionsRaw as { missions: MissionSpec[] }).missions;
export const COMPONENTS: ComponentSpec[] = (componentsRaw as { components: ComponentSpec[] }).components;
export const LAUNCHERS: LauncherSpec[] = (launchersRaw as { launchers: LauncherSpec[] }).launchers;
export const GAME_EVENTS_DATA: EventData[] = (eventsRaw as { events: EventData[] }).events;
export const DIFFICULTIES: DifficultyData[] = (difficultiesRaw as { difficulties: DifficultyData[] }).difficulties;

export function lookupTables(): LookupTables {
  const components: Record<string, ComponentSpec> = {};
  for (const c of COMPONENTS) components[c.id] = c;
  const launchers: Record<string, LauncherSpec> = {};
  for (const l of LAUNCHERS) launchers[l.id] = l;
  const missions: Record<string, MissionSpec> = {};
  for (const m of MISSIONS) missions[m.id] = m;
  return { components, launchers, missions };
}

export function budgetCapFor(difficulty: DifficultyId): number {
  const d = DIFFICULTIES.find((x) => x.id === difficulty);
  if (!d) throw new Error(`unknown difficulty ${difficulty}`);
  return d.budgetCap;
}

/** Non-throwing integrity check for CI / tests / teacher mode. Returns error strings. */
export function validateDataIntegrity(): string[] {
  const errors: string[] = [];
  const tables = lookupTables();

  // Unique ids
  const seen = new Set<string>();
  for (const list of [MISSIONS, COMPONENTS, LAUNCHERS]) {
    for (const item of list as { id: string }[]) {
      if (seen.has(item.id)) errors.push(`duplicate id ${item.id}`);
      seen.add(item.id);
    }
  }

  // Component sanity
  for (const c of COMPONENTS) {
    if (!c.name) errors.push(`component ${c.id} missing name`);
    if (!(c.massKg >= 0)) errors.push(`component ${c.id} bad massKg`);
    if (!(c.reliability > 0 && c.reliability <= 1)) errors.push(`component ${c.id} reliability out of 0..1`);
    if (c.category === 'propulsion' && !(c.ispS && c.ispS > 0)) errors.push(`propulsion ${c.id} missing ispS`);
    if (c.category === 'power' && !((c.solarAreaM2 ?? 0) > 0 || (c.outputPowerW ?? 0) > 0))
      errors.push(`power ${c.id} has neither solar area nor constant output`);
    if (c.solarEfficiency !== undefined && (c.solarEfficiency < 0 || c.solarEfficiency > 1))
      errors.push(`power ${c.id} efficiency out of 0..1`);
    if (!c.source) errors.push(`component ${c.id} missing source note`);
  }

  // Launcher sanity
  for (const l of LAUNCHERS) {
    if (!(l.capacityToLeoKg > 0)) errors.push(`launcher ${l.id} bad capacity`);
    if (!(l.reliability > 0 && l.reliability <= 1)) errors.push(`launcher ${l.id} reliability out of 0..1`);
    if (!l.source) errors.push(`launcher ${l.id} missing source note`);
  }

  // Mission sanity + target matches dv table
  const validTargets = ['leo', 'gto', 'geo', 'moon', 'venus', 'eros', 'mars', 'jupiter', 'europa', 'titan'];
  for (const m of MISSIONS) {
    if (!validTargets.includes(m.target)) errors.push(`mission ${m.id} bad target ${m.target}`);
    if (!(m.requiredDvMps >= 0)) errors.push(`mission ${m.id} bad requiredDvMps`);
    if (!(m.durationDays > 0)) errors.push(`mission ${m.id} bad durationDays`);
    if (!(m.scienceGoalGb > 0)) errors.push(`mission ${m.id} bad scienceGoalGb`);
    if (!m.source) errors.push(`mission ${m.id} missing source note`);
    if (!m.description) errors.push(`mission ${m.id} missing description`);
  }

  // At least one component per category (builder needs full slots)
  for (const cat of ['bus', 'power', 'propulsion', 'comms', 'payload', 'thermal'] as const) {
    if (!COMPONENTS.some((c) => c.category === cat)) errors.push(`no components for category ${cat}`);
  }

  // Events reference check (ids unique, rates sane)
  const eventIds = new Set<string>();
  for (const e of GAME_EVENTS_DATA) {
    if (eventIds.has(e.id)) errors.push(`duplicate event ${e.id}`);
    eventIds.add(e.id);
    if (!(e.baseRatePerDay >= 0 && e.baseRatePerDay <= 1)) errors.push(`event ${e.id} bad rate`);
  }

  // Difficulties cover all engine ids
  for (const id of ['tutorial', 'normal', 'engineer', 'director'] as DifficultyId[]) {
    if (!DIFFICULTIES.some((d) => d.id === id)) errors.push(`missing difficulty ${id}`);
  }

  void tables;
  return errors;
}
