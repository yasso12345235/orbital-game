/**
 * End-to-end (headless) playable-loop test for Mission Architect.
 * Drives the real Zustand store: mission select → prefill → validate → launch → tick → results.
 * No DOM: WebGL/audio paths degrade gracefully in Node.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useMission } from '../src/game/store';
import { TECH_NODES } from '../src/game/tech';

const reset = () => {
  useMission.setState({
    screen: 'home',
    missionId: null,
    launcherId: null,
    sim: null,
    launch: null,
    result: null,
    progress: { credits: 3_000_000, xp: 0, unlockedTech: ['basic'], completed: {}, badges: [] },
    difficulty: 'tutorial',
  });
};

describe('Mission Architect — playable loop', () => {
  beforeEach(reset);

  it('prefills a launchable starter design for the first mission', () => {
    useMission.getState().selectMission('cubesat_imaging');
    const st = useMission.getState();
    expect(st.missionId).toBe('cubesat_imaging');
    expect(st.design.components.bus).toBeTruthy();
    // all six categories filled by the starting tech node
    for (const cat of ['bus', 'power', 'propulsion', 'comms', 'payload', 'thermal'] as const) {
      expect(st.design.components[cat], `empty ${cat}`).toBeTruthy();
    }
    expect(st.validate).toBeTruthy();
    expect(st.validate!.go, `starter design blocked: ${st.validate!.hardFailIds.join(', ')}`).toBe(true);
  });

  it('runs launch → operations → completion and awards score, credits and a badge', () => {
    const st = useMission.getState();
    st.selectMission('cubesat_imaging');
    useMission.getState().beginLaunch();

    const launched = useMission.getState();
    expect(launched.screen).toBe('simulation');
    expect(launched.launch?.phase).toBe('launch');
    expect(launched.sim).toBeTruthy();
    expect(launched.launch!.goNoGo.every((g) => g.go)).toBe(true); // tutorial has no NO-GO gates

    launched.skipLaunch();
    expect(useMission.getState().launch?.phase).toBe('ops');

    // fly the mission in 0.5-day steps (tutorial: zero random events)
    for (let i = 0; i < 900; i++) {
      const cur = useMission.getState();
      if (cur.screen === 'results') break;
      cur.tick(0.5);
    }

    const done = useMission.getState();
    expect(done.screen).toBe('results');
    expect(done.result).toBeTruthy();
    const r = done.result!;
    expect(r.missionId).toBe('cubesat_imaging');
    expect(r.survived).toBe(true);
    // science accrual + auto-downlink produced real data
    expect(r.scienceReturnedGb).toBeGreaterThan(0);
    expect(r.score.total).toBeGreaterThan(0);
    expect(done.progress.xp).toBeGreaterThan(0);
    expect(done.progress.credits).toBeGreaterThan(3_000_000);
    expect(done.progress.completed.cubesat_imaging).toBeTruthy();
    // finishing a mission must be persisted as a score record
    expect(done.progress.completed.cubesat_imaging.score).toBeGreaterThan(0);
  });

  it('blocks launch when a required subsystem is missing and explains why', () => {
    useMission.getState().selectMission('cubesat_imaging');
    useMission.getState().setScreen('builder');
    useMission.getState().setComponent('propulsion', null);
    const st = useMission.getState();
    expect(st.validate!.go).toBe(false);
    expect(st.validate!.hardFailIds.length).toBeGreaterThan(0);

    st.beginLaunch();
    const after = useMission.getState();
    expect(after.launch).toBeNull();
    expect(after.screen).toBe('builder');
    expect(after.toasts.length).toBeGreaterThan(0);
  });

  it('locked missions cannot be started before unlocking the prerequisite tech', () => {
    useMission.getState().selectMission('jupiter_probe');
    expect(useMission.getState().missionId).toBeNull();

    // unlock the whole chain with plenty of credits (two passes resolve prerequisites)
    useMission.setState((s) => ({ progress: { ...s.progress, credits: 20_000_000 } }));
    for (let pass = 0; pass < 2; pass++) {
      for (const n of TECH_NODES) useMission.getState().unlockTech(n.id);
    }
    const st = useMission.getState();
    expect(st.progress.unlockedTech).toEqual(expect.arrayContaining(TECH_NODES.map((n) => n.id)));
    st.selectMission('jupiter_probe');
    expect(useMission.getState().missionId).toBe('jupiter_probe');
  });

  it('command dispatch only mutates sim state through the engine (FIRE burns fuel, refused at zero)', () => {
    useMission.getState().selectMission('cubesat_imaging');
    useMission.getState().beginLaunch();
    useMission.getState().skipLaunch();

    const before = useMission.getState().sim!.propRemainingKg;
    useMission.getState().dispatch('FIRE', { playerInitiated: true });
    const after = useMission.getState().sim!.propRemainingKg;
    expect(after).toBeLessThan(before);

    // WARP cycles the time scale via the engine (×1 → ×10)
    useMission.getState().dispatch('WARP');
    expect(useMission.getState().sim!.timeScale).toBe(10);
    // SHLD toggles safe mode
    useMission.getState().dispatch('SHLD');
    expect(useMission.getState().sim!.safeMode).toBe(true);
  });
});
