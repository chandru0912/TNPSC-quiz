/**
 * Backward-compatible synchronous facade delegating to the unified pluggable CacheService.
 * Preserves all existing callers (notes, questions, syllabusRoutes, studyMaterialsManagementRoutes)
 * while routing reads, writes, and prefix invalidations through CacheService.
 */
import { cacheService } from '../services/cacheService';

export function getCached<T>(key: string): T | null {
  return cacheService.getSync<T>(key);
}

export function setCached<T>(key: string, value: T, ttlMs: number = 60_000): void {
  cacheService.setSync(key, value, ttlMs);
}

export function invalidateCachePrefix(prefix: string): void {
  cacheService.invalidatePrefixSync(prefix);
}
