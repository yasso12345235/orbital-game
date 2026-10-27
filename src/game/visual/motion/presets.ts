/**
 * Mission Architect — shared motion presets (agnostic values for Framer
 * Motion / GSAP timelines). Durations follow the motion-language tokens.
 */
import { MOTION } from '../theme/tokens';

export const entrance = { duration: MOTION.standard, ease: MOTION.easeEntrance };
export const sceneTransition = { duration: MOTION.scene, ease: MOTION.easeEntrance };
export const heroIntro = { duration: MOTION.hero, ease: MOTION.easeEntrance };
export const springSoft = MOTION.springSoft;

/** Staggered children helper (40–80 ms steps). */
export const staggerContainer = {
  animate: { transition: { staggerChildren: MOTION.stagger } },
};
