/** Shared hooks. */
import { useCallback } from 'react';
import { useMission } from './store';
import { translate, type StringKey } from './i18n';

export function useLang() {
  return useMission((s) => s.settings.lang);
}

export function useT() {
  const lang = useLang();
  return useCallback((key: StringKey) => translate(lang, key), [lang]);
}

export function useReducedMotion() {
  const stored = useMission((s) => s.settings.reducedMotion);
  const system = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return stored || system;
}

export function useQuality() {
  return useMission((s) => s.settings.quality);
}
