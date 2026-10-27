/**
 * Comms / link budget — educational simplification.
 * Real link budget: Pr = Pt*Gt*Gr*(lambda/4pi d)^2 / losses.
 * Game model: dataRate ∝ Pt * G / d^2, anchored to a reference mission.
 * Light delay: t = d / c.
 */
import { SPEED_OF_LIGHT_KM_S, TARGET_DISTANCE_KM } from './constants';

export interface LinkParams {
  txPowerW: number; // transmit power
  antennaGain: number; // linear gain factor (e.g. 10 = 10 dBi-ish proxy)
  distanceKm: number;
}

/** Reference anchor: 1 Mbps at Moon with 10 W * gain 50. All other links scale from it. */
export const LINK_REF = {
  rateMbps: 1,
  txPowerW: 10,
  gain: 50,
  distanceKm: TARGET_DISTANCE_KM.moon,
} as const;

export function dataRateMbps(params: LinkParams): number {
  const { txPowerW, antennaGain, distanceKm } = params;
  if (txPowerW <= 0 || antennaGain <= 0 || distanceKm <= 0) return 0;
  const refPower = LINK_REF.txPowerW * LINK_REF.gain;
  const gotPower = txPowerW * antennaGain;
  const ratio = (gotPower / refPower) * Math.pow(LINK_REF.distanceKm / distanceKm, 2);
  return LINK_REF.rateMbps * ratio;
}

/** One-way light time in seconds. */
export function lightDelayS(distanceKm: number): number {
  if (distanceKm < 0) throw new Error('distanceKm must be >= 0');
  return distanceKm / SPEED_OF_LIGHT_KM_S;
}

/** Representative Earth→target distance for gameplay (km). */
export function missionDistanceKm(target: string): number {
  switch (target) {
    case 'leo':
      return 2000; // ground-station slant range proxy
    case 'gto':
    case 'geo':
      return TARGET_DISTANCE_KM.gto;
    case 'moon':
      return TARGET_DISTANCE_KM.moon;
    case 'mars':
      return TARGET_DISTANCE_KM.mars_avg;
    case 'venus':
      return TARGET_DISTANCE_KM.venus_avg;
    case 'eros':
      return TARGET_DISTANCE_KM.eros_avg;
    case 'titan':
      return TARGET_DISTANCE_KM.titan_avg;
    case 'jupiter':
    case 'europa':
      return TARGET_DISTANCE_KM.jupiter_avg;
    default:
      return TARGET_DISTANCE_KM.moon;
  }
}

/** Downlink duration to dump dataGb at rateMbps, in hours. */
export function downlinkHours(dataGb: number, rateMbps: number): number {
  if (dataGb <= 0) return 0;
  if (rateMbps <= 0) return Infinity;
  const megabits = dataGb * 8000;
  return megabits / rateMbps / 3600;
}
