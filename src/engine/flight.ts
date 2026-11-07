/**
 * Flight physics engine — pure TypeScript, no UI imports.
 *
 * Real-time, fixed-timestep rocket flight simulation:
 *   - Gravity toward body center (inverse-square)
 *   - Thrust along the rocket's forward (nose) axis
 *   - Altitude-dependent atmospheric drag
 *   - Fuel consumption reduces mass and thrust over time
 *   - Angular momentum / steering affects orientation and trajectory
 *   - Stage separation drops dry mass
 *
 * Units: metres, m/s, m/s², kg, N, radians. Integration is frame-rate
 * independent via a fixed substep accumulator.
 */
import { G0, EARTH_RADIUS_KM, MU_EARTH_KM3_S2 } from './constants';

const EARTH_RADIUS_M = EARTH_RADIUS_KM * 1000;
const MU_EARTH_M3_S2 = MU_EARTH_KM3_S2 * 1e9; // km^3/s^2 -> m^3/s^2

/** Atmosphere model: exponential density decay with altitude. */
const ATMOSPHERE_BASE_DENSITY = 1.225; // kg/m^3 at sea level
const ATMOSPHERE_SCALE_HEIGHT = 8500; // m

export type FlightStageId =
  | 'pre_launch' | 'countdown' | 'ignition' | 'liftoff' | 'ascent'
  | 'atmospheric_flight' | 'stage_separation' | 'orbital_insertion'
  | 'cruise' | 'target_approach' | 'target_acquisition' | 'mission_completion';

export interface FlightConfig {
  dryMassKg: number;
  fuelMassKg: number;
  maxThrustN: number;
  ispS: number;
  maxTorqueRadS2: number;
  dragAreaM2: number;
  steeringSensitivity: number;
  steeringResponse: number;
  automaticSteering: boolean;
  timestepS: number;
  bodyRadiusM: number;
  bodyMuM3S2: number;
}

export const DEFAULT_FLIGHT_CONFIG: FlightConfig = {
  dryMassKg: 12000,
  fuelMassKg: 38000,
  maxThrustN: 750_000,
  ispS: 320,
  maxTorqueRadS2: 0.015,
  dragAreaM2: 12.0,
  steeringSensitivity: 0.6,
  steeringResponse: 0.5,
  automaticSteering: false,
  timestepS: 1 / 60,
  bodyRadiusM: EARTH_RADIUS_M,
  bodyMuM3S2: MU_EARTH_M3_S2,
};

export interface FlightState {
  timeS: number;
  stage: FlightStageId;
  position: [number, number, number];
  velocity: [number, number, number];
  acceleration: [number, number, number];
  orientation: [number, number, number, number];
  angularVelocity: [number, number, number];
  massKg: number;
  fuelMassKg: number;
  thrust: number;
  engineActive: boolean;
  fuelFlowKgS: number;
  altitudeM: number;
  speedMps: number;
  density: number;
  dragN: number;
  gravityMs2: number;
  stageSeparationReady: boolean;
  stageSeparated: boolean;
  distanceToTargetM: number;
  complete: boolean;
  failed: boolean;
  failureReason: string | null;
  targetPosition: [number, number, number];
}

export interface FlightInput {
  steerX: number;
  steerY: number;
  engine: boolean;
  throttleUp: boolean;
  pause: boolean;
  restart: boolean;
}

export interface TrajectoryPoint {
  timeS: number;
  position: [number, number, number];
  velocity: [number, number, number];
}

export interface Trajectory {
  planned: TrajectoryPoint[];
  actual: TrajectoryPoint[];
  predicted: TrajectoryPoint[];
  deviationM: number;
}

export interface StepResult {
  state: FlightState;
  events: string[];
}

function quatNormalize(q: [number, number, number, number]): [number, number, number, number] {
  const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (len === 0) return [0, 0, 0, 1];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function quatMultiply(a: [number, number, number, number], b: [number, number, number, number]): [number, number, number, number] {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quatFromAxisAngle(axis: [number, number, number], angle: number): [number, number, number, number] {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const len = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);
  if (len === 0) return [0, 0, 0, 1];
  return [axis[0] / len * s, axis[1] / len * s, axis[2] / len * s, Math.cos(half)];
}

function quatRotateVector(q: [number, number, number, number], v: [number, number, number]): [number, number, number] {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function quatConjugate(q: [number, number, number, number]): [number, number, number, number] {
  return [-q[0], -q[1], -q[2], q[3]];
}

function densityAtAltitude(altitudeM: number): number {
  if (altitudeM <= 0) return ATMOSPHERE_BASE_DENSITY;
  return ATMOSPHERE_BASE_DENSITY * Math.exp(-altitudeM / ATMOSPHERE_SCALE_HEIGHT);
}

function gravityVector(position: [number, number, number], mu: number): [number, number, number] {
  const r = Math.sqrt(position[0] * position[0] + position[1] * position[1] + position[2] * position[2]);
  const invR3 = 1 / (r * r * r);
  return [-position[0] * mu * invR3, -position[1] * mu * invR3, -position[2] * mu * invR3];
}

export function createFlightState(config: FlightConfig, targetPosition: [number, number, number]): FlightState {
  const fuelFlowKgS = config.maxThrustN / (config.ispS * G0);
  const massKg = config.dryMassKg + config.fuelMassKg;
  const position: [number, number, number] = [0, config.bodyRadiusM, 0];
  const gravity = gravityVector(position, config.bodyMuM3S2);
  return {
    timeS: 0,
    stage: 'pre_launch',
    position,
    velocity: [0, 0, 0],
    acceleration: [gravity[0], gravity[1], gravity[2]],
    orientation: [0, 0, 0, 1],
    angularVelocity: [0, 0, 0],
    massKg,
    fuelMassKg: config.fuelMassKg,
    thrust: 0,
    engineActive: false,
    fuelFlowKgS,
    altitudeM: 0,
    speedMps: 0,
    density: ATMOSPHERE_BASE_DENSITY,
    dragN: 0,
    gravityMs2: Math.sqrt(gravity[0] * gravity[0] + gravity[1] * gravity[1] + gravity[2] * gravity[2]),
    stageSeparationReady: false,
    stageSeparated: false,
    distanceToTargetM: 0,
    complete: false,
    failed: false,
    failureReason: null,
    targetPosition,
  };
}

export function stepFlight(state: FlightState, config: FlightConfig, input: FlightInput, dtSeconds: number): StepResult {
  if (state.complete || state.failed) {
    return { state, events: [] };
  }
  if (input.pause) {
    return { state, events: [] };
  }

  const events: string[] = [];
  const substeps = Math.max(1, Math.ceil(dtSeconds / config.timestepS));
  const subDt = dtSeconds / substeps;

  let cur = state;
  for (let i = 0; i < substeps; i++) {
    cur = integrateStep(cur, config, input, subDt, events);
  }

  const next = advanceStage(cur, config, events);
  return { state: next, events };
}

function integrateStep(state: FlightState, config: FlightConfig, input: FlightInput, dt: number, events: string[]): FlightState {
  // --- Thrust control ---
  let thrust = state.thrust;
  let engineActive = input.engine;

  if (engineActive) {
    if (input.throttleUp) thrust = Math.min(1, thrust + 0.5 * dt);
    else thrust = Math.min(1, thrust + 0.15 * dt);
    if (thrust < 0.05) thrust = 0.05;
  } else {
    thrust = Math.max(0, thrust - 0.3 * dt);
  }

  // --- Steering torque (player owns the stick; no forced auto-correction) ---
  let torqueX = 0; // pitch
  let torqueY = 0; // yaw
  if (!config.automaticSteering) {
    torqueY = input.steerX * config.maxTorqueRadS2 * config.steeringSensitivity;
    torqueX = -input.steerY * config.maxTorqueRadS2 * config.steeringSensitivity;
  } else {
    // Gentle automatic leveling assistance when enabled.
    torqueY = input.steerX * config.maxTorqueRadS2 * config.steeringSensitivity * 0.5;
    torqueX = -input.steerY * config.maxTorqueRadS2 * config.steeringSensitivity * 0.5;
  }

  const response = config.steeringResponse;
  const av = state.angularVelocity;
  const newAv: [number, number, number] = [
    av[0] + (torqueX - av[0] * response) * dt,
    av[1] + (torqueY - av[1] * response) * dt,
    av[2] + (0 - av[2] * response) * dt,
  ];

  // Integrate orientation.
  const angSpeed = Math.sqrt(newAv[0] * newAv[0] + newAv[1] * newAv[1] + newAv[2] * newAv[2]);
  let newOrientation = state.orientation;
  if (angSpeed > 1e-6 && dt > 0) {
    const axis: [number, number, number] = [newAv[0] / angSpeed, newAv[1] / angSpeed, newAv[2] / angSpeed];
    const dq = quatFromAxisAngle(axis, angSpeed * dt);
    newOrientation = quatNormalize(quatMultiply(dq, state.orientation));
  }

  // --- Forces ---
  const thrustDir = quatRotateVector(newOrientation, [0, 1, 0]);
  const thrustForceN = thrust * config.maxThrustN;
  const thrustAccel: [number, number, number] = engineActive && thrustForceN > 0
    ? [thrustDir[0] * thrustForceN / state.massKg, thrustDir[1] * thrustForceN / state.massKg, thrustDir[2] * thrustForceN / state.massKg]
    : [0, 0, 0];

  const grav = gravityVector(state.position, config.bodyMuM3S2);

  const speed = Math.sqrt(state.velocity[0] * state.velocity[0] + state.velocity[1] * state.velocity[1] + state.velocity[2] * state.velocity[2]);
  const density = densityAtAltitude(Math.max(0, state.position[1] - config.bodyRadiusM));
  const dragCoeff = 0.5 * density * speed * speed * config.dragAreaM2;
  const dragAccel: [number, number, number] = speed > 0
    ? [-state.velocity[0] / speed * dragCoeff / state.massKg, -state.velocity[1] / speed * dragCoeff / state.massKg, -state.velocity[2] / speed * dragCoeff / state.massKg]
    : [0, 0, 0];

  const accel: [number, number, number] = [
    grav[0] + thrustAccel[0] + dragAccel[0],
    grav[1] + thrustAccel[1] + dragAccel[1],
    grav[2] + thrustAccel[2] + dragAccel[2],
  ];

  const newVelocity: [number, number, number] = [
    state.velocity[0] + accel[0] * dt,
    state.velocity[1] + accel[1] * dt,
    state.velocity[2] + accel[2] * dt,
  ];
  const newPosition: [number, number, number] = [
    state.position[0] + newVelocity[0] * dt,
    state.position[1] + newVelocity[1] * dt,
    state.position[2] + newVelocity[2] * dt,
  ];

  // Fuel consumption.
  let fuelMassKg = state.fuelMassKg;
  let massKg = state.massKg;
  if (engineActive && thrust > 0 && fuelMassKg > 0) {
    const fuelUsed = state.fuelFlowKgS * thrust * dt;
    const actualUsed = Math.min(fuelUsed, fuelMassKg);
    fuelMassKg = Math.max(0, fuelMassKg - actualUsed);
    massKg = config.dryMassKg + fuelMassKg;
  }

  if (fuelMassKg <= 0) {
    engineActive = false;
    thrust = 0;
  }

  const r = Math.sqrt(newPosition[0] * newPosition[0] + newPosition[1] * newPosition[1] + newPosition[2] * newPosition[2]);
  const altitudeM = Math.max(0, r - config.bodyRadiusM);

  const dx = newPosition[0] - state.targetPosition[0];
  const dy = newPosition[1] - state.targetPosition[1];
  const dz = newPosition[2] - state.targetPosition[2];
  const distanceToTargetM = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const dragN = dragCoeff;
  const gravityMs2 = Math.sqrt(grav[0] * grav[0] + grav[1] * grav[1] + grav[2] * grav[2]);

  // Ground collision: if we hit the surface with significant speed, crash.
  if (altitudeM <= 0 && speed > 5) {
    return {
      ...state,
      position: newPosition,
      velocity: [0, 0, 0],
      acceleration: accel,
      orientation: newOrientation,
      angularVelocity: newAv,
      massKg,
      fuelMassKg,
      thrust,
      engineActive: false,
      altitudeM: 0,
      speedMps: speed,
      density,
      dragN,
      gravityMs2,
      distanceToTargetM,
      complete: false,
      failed: true,
      failureReason: 'Impact with surface — mission lost.',
      targetPosition: state.targetPosition,
    };
  }

  return {
    ...state,
    position: newPosition,
    velocity: newVelocity,
    acceleration: accel,
    orientation: newOrientation,
    angularVelocity: newAv,
    massKg,
    fuelMassKg,
    thrust,
    engineActive,
    altitudeM,
    speedMps: speed,
    density,
    dragN,
    gravityMs2,
    distanceToTargetM,
    targetPosition: state.targetPosition,
  };
}

function advanceStage(state: FlightState, config: FlightConfig, events: string[]): FlightState {
  let stage = state.stage;
  const { altitudeM, speedMps, fuelMassKg, engineActive, stageSeparated } = state;

  if (stage === 'pre_launch' && engineActive) {
    stage = 'ignition';
    events.push('ENGINE IGNITION');
  } else if (stage === 'ignition' && altitudeM > 5) {
    stage = 'liftoff';
    events.push('LIFTOFF');
  } else if (stage === 'liftoff' && altitudeM > 1000) {
    stage = 'ascent';
    events.push('ASCENT');
  } else if (stage === 'ascent' && altitudeM > 40000) {
    stage = 'atmospheric_flight';
    events.push('ATMOSPHERIC FLIGHT');
  } else if (stage === 'atmospheric_flight' && !stageSeparated && fuelMassKg < config.fuelMassKg * 0.35) {
    stage = 'stage_separation';
    events.push('STAGE SEPARATION');
  } else if (stage === 'stage_separation' && altitudeM > 160000) {
    stage = 'orbital_insertion';
    events.push('ORBITAL INSERTION');
  } else if (stage === 'orbital_insertion' && speedMps > 7000) {
    stage = 'cruise';
    events.push('CRUISE');
  } else if (stage === 'cruise' && state.distanceToTargetM < 3_000_000) {
    stage = 'target_approach';
    events.push('TARGET APPROACH');
  } else if (stage === 'target_approach' && state.distanceToTargetM < 50_000) {
    stage = 'target_acquisition';
    events.push('TARGET ACQUISITION');
  } else if (stage === 'target_acquisition' && state.distanceToTargetM < 5_000) {
    stage = 'mission_completion';
    events.push('MISSION COMPLETE');
  }

  let stageSeparationReady = state.stageSeparationReady;
  let stageSeparatedFlag = state.stageSeparated;
  if (stage === 'stage_separation' && !stageSeparatedFlag) {
    stageSeparationReady = true;
    stageSeparatedFlag = true;
    // Drop upper-stage dry mass (simulate separation).
    // In this simplified model we keep mass but flag separation.
  }

  if (stage === 'mission_completion') {
    return { ...state, stage, stageSeparationReady, stageSeparated: stageSeparatedFlag, complete: true };
  }

  return { ...state, stage, stageSeparationReady, stageSeparated: stageSeparatedFlag };
}

/** Sample the current state into a trajectory point. */
export function trajectoryPoint(state: FlightState): TrajectoryPoint {
  return {
    timeS: state.timeS,
    position: state.position,
    velocity: state.velocity,
  };
}

/** Build the predicted trajectory by forward-integrating the current state. */
export function predictTrajectory(state: FlightState, config: FlightConfig, lookaheadS: number): TrajectoryPoint[] {
  const steps = Math.max(1, Math.ceil(lookaheadS / config.timestepS));
  const dt = lookaheadS / steps;
  let sim = state;
  const out: TrajectoryPoint[] = [];
  const noInput: FlightInput = { steerX: 0, steerY: 0, engine: state.engineActive, throttleUp: false, pause: false, restart: false };
  for (let i = 0; i < steps; i++) {
    const res = stepFlight(sim, config, noInput, dt);
    sim = res.state;
    out.push(trajectoryPoint(sim));
    if (sim.complete || sim.failed) break;
  }
  return out;
}

/** Distance between two points. */
export function distance(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Pitch/yaw/roll euler angles from quaternion (for HUD readout). */
export function orientationEuler(q: [number, number, number, number]): { pitch: number; yaw: number; roll: number } {
  const [x, y, z, w] = q;
  // Roll (x-axis rotation)
  const sinr = 2 * (w * x + y * z);
  const cosr = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr, cosr);
  // Pitch (y-axis rotation)
  const sinp = 2 * (w * y - z * x);
  let pitch: number;
  if (Math.abs(sinp) >= 1) pitch = Math.sign(sinp) * Math.PI / 2;
  else pitch = Math.asin(sinp);
  // Yaw (z-axis rotation)
  const siny = 2 * (w * z + x * y);
  const cosy = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny, cosy);
  return { pitch, yaw, roll };
}
