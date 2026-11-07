/**
 * FlightStore — Zustand store for the interactive flight simulation.
 *
 * Holds the flight state, mission state, trajectory, config and settings.
 * Physics stepping is driven by the FlightScreen render loop.
 */
import { create } from 'zustand';
import {
  createFlightState,
  stepFlight,
  advanceMissionStage,
  computeTrajectory,
  createMissionState,
  type FlightConfig,
  type FlightState,
  type MissionConfig,
  type MissionState,
  type Trajectory,
  type TrajectoryConfig,
  DEFAULT_FLIGHT_CONFIG,
} from '@engine';

export interface FlightSettings {
  steeringSensitivity: number;
  steeringResponse: number;
  automaticSteering: boolean;
  simulationSpeed: number;
  hudVisible: boolean;
}

export const DEFAULT_FLIGHT_SETTINGS: FlightSettings = {
  steeringSensitivity: 0.6,
  steeringResponse: 0.5,
  automaticSteering: false,
  simulationSpeed: 1,
  hudVisible: true,
};

const DEFAULT_TRAJECTORY_CONFIG: TrajectoryConfig = {
  plannedWaypoints: [[0, 0, 0]],
  target: [0, 0, 0],
  maxHistory: 600,
};

export interface FlightStore {
  config: FlightConfig;
  state: FlightState | null;
  mission: MissionState | null;
  trajectory: Trajectory | null;
  trajectoryConfig: TrajectoryConfig;
  settings: FlightSettings;
  isPaused: boolean;
  isRunning: boolean;
  actualHistory: TrajectoryPoint[];

  initFlight: (missionConfig: MissionConfig) => void;
  setPaused: (paused: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  setSetting: <K extends keyof FlightSettings>(k: K, v: FlightSettings[K]) => void;
  restartMission: () => void;
  step: (dtSeconds: number, input: FlightInput) => void;
}

export interface TrajectoryPoint {
  timeS: number;
  position: [number, number, number];
  velocity: [number, number, number];
}

export interface FlightInput {
  steerX: number;
  steerY: number;
  engine: boolean;
  throttleUp: boolean;
  pause: boolean;
  restart: boolean;
}

export const useFlightStore = create<FlightStore>((set, get) => ({
  config: DEFAULT_FLIGHT_CONFIG,
  state: null,
  mission: null,
  trajectory: null,
  trajectoryConfig: DEFAULT_TRAJECTORY_CONFIG,
  settings: { ...DEFAULT_FLIGHT_SETTINGS },
  isPaused: false,
  isRunning: false,
  actualHistory: [],

  initFlight: (missionConfig) => {
    const cfg = missionConfig.flightConfig;
    const state = createFlightState(cfg, missionConfig.targetPosition);
    const mission = createMissionState(missionConfig);
    set({
      config: cfg,
      state,
      mission,
      trajectory: null,
      trajectoryConfig: {
        plannedWaypoints: [
          [0, cfg.bodyRadiusM, 0],
          [0, cfg.bodyRadiusM + 200000, 0],
          [...missionConfig.targetPosition],
        ],
        target: missionConfig.targetPosition,
        maxHistory: 600,
      },
      actualHistory: [],
      isPaused: false,
      isRunning: true,
    });
  },

  setPaused: (paused) => set({ isPaused: paused }),

  setSimulationSpeed: (speed) => set({ settings: { ...get().settings, simulationSpeed: speed } }),

  setSetting: (k, v) => set({ settings: { ...get().settings, [k]: v } }),

  restartMission: () => {
    const { mission, config, trajectoryConfig } = get();
    if (!mission) return;
    const freshState = createFlightState(config, trajectoryConfig.target);
    const freshMission = createMissionState({
      missionId: mission.missionId,
      missionName: mission.missionName,
      target: mission.target,
      targetPosition: trajectoryConfig.target,
      orbitAltitudeM: 0,
      requiresOrbit: mission.requiresOrbit,
      arrivalThresholdM: 5000,
      flightConfig: config,
    });
    set({
      state: freshState,
      mission: freshMission,
      actualHistory: [],
      trajectory: null,
      isPaused: false,
      isRunning: true,
    });
  },

  step: (dtSeconds, input) => {
    const { state, config, settings, actualHistory, trajectoryConfig } = get();
    if (!state || !get().isRunning || get().isPaused) return;

    if (input.restart) {
      get().restartMission();
      return;
    }

    const scaledDt = dtSeconds * settings.simulationSpeed;

    const { state: nextState } = stepFlight(state, config, input, scaledDt);
    void nextState;

    let nextMission = get().mission;
    if (nextMission) {
      nextMission = advanceMissionStage(
        nextMission,
        {
          stage: nextState.stage,
          altitudeM: nextState.altitudeM,
          speedMps: nextState.speedMps,
          distanceToTargetM: nextState.distanceToTargetM,
          engineActive: nextState.engineActive,
          complete: nextState.complete,
          failed: nextState.failed,
          failureReason: nextState.failureReason,
        },
        {
          missionId: nextMission.missionId,
          missionName: nextMission.missionName,
          target: nextMission.target,
          targetPosition: trajectoryConfig.target,
          orbitAltitudeM: 0,
          requiresOrbit: nextMission.requiresOrbit,
          arrivalThresholdM: 5000,
          flightConfig: config,
        },
        scaledDt,
      );
    }

    const traj = computeTrajectory(nextState, config, trajectoryConfig, actualHistory);

    set({
      state: nextState,
      mission: nextMission,
      trajectory: traj,
      actualHistory: traj.actual,
    });

    if (nextState.complete || nextState.failed) {
      set({ isRunning: false });
    }
  },
}));
