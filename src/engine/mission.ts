/**
 * Mission state manager — pure TypeScript.
 *
 * Drives the 12-stage mission lifecycle. Each stage is tied to actual
 * simulation state; stage transitions are triggered by real flight
 * conditions (altitude, velocity, fuel, distance). Player decisions
 * (steering, thrust, staging) influence which stages are reached and how.
 */
import type { FlightConfig, FlightStageId } from './flight';

export interface MissionStageDef {
  id: FlightStageId;
  name: string;
  description: string;
}

export const MISSION_STAGES: MissionStageDef[] = [
  { id: 'pre_launch', name: 'Pre-Launch', description: 'Rocket preparation and system checks.' },
  { id: 'countdown', name: 'Countdown', description: 'Interactive countdown sequence.' },
  { id: 'ignition', name: 'Engine Ignition', description: 'Engine activation and thrust initialization.' },
  { id: 'liftoff', name: 'Liftoff', description: 'Rocket launches from the launch platform.' },
  { id: 'ascent', name: 'Ascent', description: 'Continuous controlled rocket ascent.' },
  { id: 'atmospheric_flight', name: 'Atmospheric Flight', description: 'Flight through changing atmospheric conditions.' },
  { id: 'stage_separation', name: 'Stage Separation', description: 'Separate rocket stages when applicable.' },
  { id: 'orbital_insertion', name: 'Orbital Insertion', description: 'Achieve the required orbit when the mission requires it.' },
  { id: 'cruise', name: 'Space Travel', description: 'Continue traveling toward the designated destination.' },
  { id: 'target_approach', name: 'Target Approach', description: 'Navigate toward the target.' },
  { id: 'target_acquisition', name: 'Target Acquisition', description: 'Identify and verify the destination.' },
  { id: 'mission_completion', name: 'Mission Completion', description: 'Complete the mission and evaluate its performance.' },
];

export type StageDef = (typeof MISSION_STAGES)[number];

export function stageDefFor(id: FlightStageId): StageDef {
  return MISSION_STAGES.find((s) => s.id === id)!;
}

export interface MissionConfig {
  missionId: string;
  missionName: string;
  target: string;
  targetPosition: [number, number, number];
  /** Orbit altitude required for insertion, m (0 = no orbit required, flyby/landing). */
  orbitAltitudeM: number;
  /** Whether orbital insertion is required for this mission. */
  requiresOrbit: boolean;
  /** Target arrival distance threshold, m. */
  arrivalThresholdM: number;
  /** Flight config for this mission. */
  flightConfig: FlightConfig;
}

export interface MissionState {
  missionId: string;
  missionName: string;
  target: string;
  currentStage: FlightStageId;
  stageStartTimeS: number;
  stageElapsedS: number;
  totalElapsedS: number;
  stagesCompleted: FlightStageId[];
  complete: boolean;
  failed: boolean;
  failureReason: string | null;
  requiresOrbit: boolean;
  orbitAchieved: boolean;
  targetAcquired: boolean;
}

export function createMissionState(config: MissionConfig): MissionState {
  return {
    missionId: config.missionId,
    missionName: config.missionName,
    target: config.target,
    currentStage: 'pre_launch',
    stageStartTimeS: 0,
    stageElapsedS: 0,
    totalElapsedS: 0,
    stagesCompleted: [],
    complete: false,
    failed: false,
    failureReason: null,
    requiresOrbit: config.requiresOrbit,
    orbitAchieved: false,
    targetAcquired: false,
  };
}

export function advanceMissionStage(
  mission: MissionState,
  flight: { stage: FlightStageId; altitudeM: number; speedMps: number; distanceToTargetM: number; engineActive: boolean; complete: boolean; failed: boolean; failureReason: string | null },
  config: MissionConfig,
  dt: number,
): MissionState {
  if (mission.complete || mission.failed) return mission;

  let next: MissionState = {
    ...mission,
    totalElapsedS: mission.totalElapsedS + dt,
    stageElapsedS: mission.stageElapsedS + dt,
  };

  // Stage transitions driven by actual flight conditions.
  if (next.currentStage === 'pre_launch' && flight.engineActive) {
    next = { ...next, currentStage: 'countdown', stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  } else if (next.currentStage === 'countdown' && flight.engineActive && flight.altitudeM > 2) {
    next = { ...next, currentStage: 'ignition', stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  } else if (next.currentStage === 'ignition' && flight.altitudeM > 5) {
    next = { ...next, currentStage: 'liftoff', stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  } else if (next.currentStage === 'liftoff' && flight.altitudeM > 1000) {
    next = { ...next, currentStage: 'ascent', stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  } else if (next.currentStage === 'ascent' && flight.altitudeM > 40000) {
    next = { ...next, currentStage: 'atmospheric_flight', stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  } else if (next.currentStage === 'atmospheric_flight' && flight.altitudeM > 160000) {
    next = { ...next, currentStage: 'orbital_insertion', stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  } else if (next.currentStage === 'orbital_insertion') {
    if (flight.speedMps > 7000 && !config.requiresOrbit) {
      next = { ...next, currentStage: 'cruise', orbitAchieved: true, stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
    } else if (flight.speedMps > 7800 && config.requiresOrbit) {
      next = { ...next, currentStage: 'cruise', orbitAchieved: true, stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
    }
  } else if (next.currentStage === 'cruise' && flight.distanceToTargetM < 3_000_000) {
    next = { ...next, currentStage: 'target_approach', stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  } else if (next.currentStage === 'target_approach' && flight.distanceToTargetM < 50_000) {
    next = { ...next, currentStage: 'target_acquisition', stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  } else if (next.currentStage === 'target_acquisition' && flight.distanceToTargetM < config.arrivalThresholdM) {
    next = { ...next, currentStage: 'mission_completion', targetAcquired: true, stageStartTimeS: next.totalElapsedS, stageElapsedS: 0 };
  }

  if (next.currentStage === 'mission_completion') {
    next = { ...next, complete: true };
  }

  if (flight.failed) {
    next = { ...next, failed: true, failureReason: flight.failureReason };
  }

  return next;
}

export function missionProgress(mission: MissionState): number {
  const idx = MISSION_STAGES.findIndex((s) => s.id === mission.currentStage);
  return Math.max(0, Math.min(1, (idx + 1) / MISSION_STAGES.length));
}
