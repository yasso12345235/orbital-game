import { describe, it, expect } from 'vitest';
import { dataRateMbps, lightDelayS, missionDistanceKm, downlinkHours } from '../src/engine/comms';

describe('link budget (simplified)', () => {
  it('reference anchor: 10 W x gain 50 at Moon = 1 Mbps', () => {
    expect(dataRateMbps({ txPowerW: 10, antennaGain: 50, distanceKm: 384400 })).toBeCloseTo(1, 6);
  });
  it('doubling Tx power doubles rate', () => {
    const a = dataRateMbps({ txPowerW: 10, antennaGain: 50, distanceKm: 384400 });
    const b = dataRateMbps({ txPowerW: 20, antennaGain: 50, distanceKm: 384400 });
    expect(b).toBeCloseTo(a * 2, 6);
  });
  it('inverse-square: doubling distance quarters rate', () => {
    const near = dataRateMbps({ txPowerW: 10, antennaGain: 50, distanceKm: 100000 });
    const far = dataRateMbps({ txPowerW: 10, antennaGain: 50, distanceKm: 200000 });
    expect(far).toBeCloseTo(near / 4, 6);
  });
  it('Moon light delay ~1.3 s', () => {
    expect(lightDelayS(384400)).toBeCloseTo(1.28, 1);
  });
  it('Mars light delay is minutes (near ~3 min, far ~22 min)', () => {
    expect(lightDelayS(54_600_000)).toBeGreaterThan(150);
    expect(lightDelayS(54_600_000)).toBeLessThan(250);
    expect(lightDelayS(401_000_000)).toBeGreaterThan(1000);
    expect(lightDelayS(401_000_000)).toBeLessThan(1500);
  });
  it('downlink time scales with data and inverse rate', () => {
    expect(downlinkHours(8, 1)).toBeCloseTo(17.78, 1); // 8 GB at 1 Mbps
    expect(downlinkHours(8, 2)).toBeCloseTo(8.89, 1);
  });
  it('deep-space distances dwarf lunar distance', () => {
    expect(missionDistanceKm('mars')).toBeGreaterThan(missionDistanceKm('moon') * 100);
  });
});
