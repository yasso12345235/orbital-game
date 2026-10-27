/**
 * Mission Architect — engine constants.
 * Pure TypeScript, no UI imports.
 * All values are SIMPLIFIED FOR EDUCATION. See `source` notes.
 */

export const G0 = 9.80665; // m/s^2 — standard gravity (CODATA). Source: BIPM SI brochure.
export const MU_EARTH_KM3_S2 = 398600; // km^3/s^2 — Earth GM. Source: NASA GM values.
export const EARTH_RADIUS_KM = 6371; // km — mean radius. Source: NASA Earth fact sheet.
export const MOON_RADIUS_KM = 1737.4;
export const MARS_RADIUS_KM = 3389.5;
export const JUPITER_RADIUS_KM = 69911;
export const SPEED_OF_LIGHT_KM_S = 299792.458; // km/s. Source: SI definition.

/** Solar flux (W/m^2) at target distance — simplified inverse-square anchors. */
export const SOLAR_FLUX_W_M2 = {
  earth: 1361, // Source: SORCE/TIM ~1361 W/m^2 at 1 AU.
  moon: 1361, // Same heliocentric distance as Earth.
  mars: 590, // ~1361 / 1.52^2 ≈ 589. Simplified.
  jupiter: 50, // ~1361 / 5.2^2 ≈ 50. Simplified.
  europa: 50, // Same as Jupiter system.
  venus: 2620, // ~1361 / 0.72^2 ≈ 2626, rounded. Simplified.
  eros: 640, // 433 Eros mean ~1.46 AU: 1361 / 1.46^2 ≈ 638. Simplified.
  titan: 15, // Saturn ~9.54 AU: 1361 / 9.54^2 ≈ 15. Simplified.
} as const;

/** One-way light-time reference distances (km). Mid-range anchors; real values vary. */
export const TARGET_DISTANCE_KM = {
  leo400: 400, // altitude proxy, not light delay
  gto: 35786,
  moon: 384400, // mean Earth–Moon distance. Source: NASA Moon fact sheet.
  mars_near: 54_600_000, // closest approach ~54.6M km
  mars_avg: 225_000_000, // typical transfer arrival distance used in game
  mars_far: 401_000_000, // far side ~401M km
  jupiter_avg: 778_500_000, // ~5.2 AU. Source: NASA Jupiter fact sheet.
  europa_avg: 778_500_000,
  venus_avg: 108_000_000, // ~0.72 AU mean Sun–Venus arrival anchor. Simplified.
  eros_avg: 218_000_000, // 433 Eros mean ~1.46 AU. Simplified.
  titan_avg: 1_280_000_000, // Saturn ~9.54 AU arrival anchor. Simplified.
} as const;

/**
 * Spacecraft transfer delta-v requirements FROM LEO (m/s), educational approximations.
 * Source note: aggregated from NASA trajectory references & launcher manuals, rounded.
 * Real missions use gravity assists / staging; game uses single-impulse equivalent.
 */
export const TRANSFER_DV_FROM_LEO_MPS = {
  leo: 0, // already in LEO
  gto: 2400, // LEO -> GTO ~2.4 km/s
  geo: 3800, // LEO -> GEO incl. circularisation ~3.8 km/s (simplified)
  moon: 3100, // LEO -> TLI + LOI budget ~3.1 km/s (simplified)
  mars: 3600, // LEO -> Mars transfer + capture ~3.6 km/s (simplified)
  jupiter: 6300, // LEO -> Jupiter direct ~6.3 km/s (simplified, often uses assists)
  europa: 6800, // Jupiter + Europa capture extra ~0.5 km/s on top
  venus: 3500, // LEO -> Venus transfer + capture ~3.5 km/s (simplified)
  eros: 4900, // LEO -> 433 Eros rendezvous ~4.9 km/s (NEAR-class proxy, simplified)
  titan: 7300, // LEO -> Saturn direct + Titan capture ~7.3 km/s (no assists, simplified)
} as const;

/** Ascent delta-v Earth surface -> LEO including gravity/drag losses (m/s). */
export const ASCENT_DV_TO_LEO_MPS = 9400; // 9.3–9.4 km/s. Source: standard launch textbooks.

/** Isp reference table (s) — typical ranges, simplified to single game values. */
export const ISP_REFERENCE_S = {
  cold_gas: 60, // 50–70
  monoprop: 220, // hydrazine ~220
  biprop: 320, // 310–330
  kerolox_vac: 310, // LOX/RP-1 vac ~310
  hydrolox_vac: 450, // LOX/LH2 vac ~450
  ion: 2500, // 1500–3500, game anchor 2500
} as const;

export const SIMPLIFICATION_NOTE =
  'All physics values are simplified for education and game balance. Not for real mission design.';
