import type { StudentUser } from '../context/StudentAuthContext';

/**
 * Resolves the authoritative student display name using strict priority:
 * 1. Authenticated Google OAuth / saved database full name
 * 2. Fallback name passed from dashboard API if available
 * 3. Email username only as a final fallback
 */
export function resolveStudentDisplayName(
  student?: Pick<StudentUser, 'fullName' | 'email'> | null,
  fallbackName?: string | null
): string {
  const primary = String(student?.fullName || '').trim();
  if (primary && primary.toLowerCase() !== 'student aspirant') {
    return primary;
  }

  const secondary = String(fallbackName || '').trim();
  if (secondary && secondary.toLowerCase() !== 'student aspirant') {
    return secondary;
  }

  const emailLocal = String(student?.email || '').split('@')[0]?.trim();
  if (emailLocal) {
    return emailLocal;
  }

  return 'Student Aspirant';
}

/**
 * Computes 1-2 clean uppercase initials for the circular fallback avatar.
 */
export function getStudentInitials(displayName?: string | null, email?: string | null): string {
  const clean = String(displayName || '').trim();
  if (clean && clean.toLowerCase() !== 'student aspirant') {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  }
  const emailChar = String(email || '').trim().charAt(0).toUpperCase();
  return emailChar || 'S';
}

/**
 * Normalizes Google OAuth profile photo URLs to high-resolution 256px quality
 * so circular avatars remain crisp and sharp on Retina/HiDPI displays.
 */
export function normalizeStudentAvatarUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/googleusercontent\.com/i.test(trimmed)) {
    if (/=s\d+-c/i.test(trimmed)) {
      return trimmed.replace(/=s\d+-c/i, '=s256-c');
    }
    if (!/=s\d+/i.test(trimmed)) {
      return `${trimmed}=s256-c`;
    }
  }
  return trimmed;
}
