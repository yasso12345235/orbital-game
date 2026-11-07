/**
 * Trajectory system — pure TypeScript.
 *
 * Maintains three concurrent trajectory views:
 *   - Planned: the ideal mission path to the target.
 *   - Actual: the history of positions the rocket has flown.
 *   - Predicted: forward extrapolation from current state.
 *
 * Deviation is measured between actual and planned at the latest point.
 */
import type { FlightConfig, FlightState, Trajectory, TrajectoryPoint } from './flight';
import { trajectoryPoint, predictTrajectory, distance } from './flight';

export interface TrajectoryConfig {
  /** Planned waypoints (world positions, m). */
  plannedWaypoints: [number, number, number][];
  /** Target position, m. */
  target: [number, number, number];
  /** Maximum history length for the actual trajectory. */
  maxHistory: number;
}

export const DEFAULT_TRAJECTORY_CONFIG: TrajectoryConfig = {
  plannedWaypoints: [[0, 0, 0]],
  target: [0, 0, 0],
  maxHistory: 600,
};

/** Build the planned trajectory from waypoints (linear interpolation sample). */
export function buildPlannedTrajectory(waypoints: [number, number, number][], samplesPerSegment = 20): TrajectoryPoint[] {
  const pts: TrajectoryPoint[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    for (let s = 0; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      pts.push({
        timeS: 0,
        position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
        velocity: [0, 0, 0],
      });
    }
  }
  return pts;
}

/** Find the nearest point on the planned trajectory to a position. */
function nearestPlannedPoint(position: [number, number, number], planned: TrajectoryPoint[]): { point: TrajectoryPoint; index: number } {
  let best: TrajectoryPoint | null = null;
  let bestIndex = 0;
  let bestDist = Infinity;
  planned.forEach((p, i) => {
    const d = distance(position, p.position);
    if (d < bestDist) {
      bestDist = d;
      best = p;
      bestIndex = i;
    }
  });
  return { point: best! ?? { timeS: 0, position, velocity: [0, 0, 0] }, index: bestIndex };
}

/**
 * Assemble the full Trajectory from the current flight state and history.
 * actualHistory is maintained by the caller and passed in each frame.
 */
export function computeTrajectory(
  state: FlightState,
  flightConfig: FlightConfig,
  config: TrajectoryConfig,
  actualHistory: TrajectoryPoint[],
): Trajectory {
  // Append current state to actual history.
  const updatedHistory = [...actualHistory, trajectoryPoint(state)].slice(-config.maxHistory);

  const planned = buildPlannedTrajectory(config.plannedWaypoints);
  const predicted = predictTrajectory(state, flightConfig, 10); // 10s lookahead

  // Deviation: distance from latest actual to nearest planned point.
  const latest = updatedHistory[updatedHistory.length - 1];
  const nearest = nearestPlannedPoint(latest.position, planned);
  const deviationM = distance(latest.position, nearest.point.position);

  return {
    planned,
    actual: updatedHistory,
    predicted,
    deviationM,
  };
}

export function targetDistance(state: FlightState): number {
  return distance(state.position, state.targetPosition);
}
