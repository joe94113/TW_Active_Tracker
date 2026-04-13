import { watchEffect } from 'vue';
import { applySeoMeta } from '../lib/seo';

export function useSeoMeta(source) {
  watchEffect(() => {
    const value = typeof source === 'function' ? source() : source?.value ?? source;
    applySeoMeta(value ?? {});
  });
}
