import React, { useState, useMemo } from 'react';
import {
  getStudentInitials,
  normalizeStudentAvatarUrl,
  resolveStudentDisplayName,
} from '../utils/studentProfile';
import './StudentAvatar.css';

interface StudentAvatarProps {
  studentId?: number | string | null;
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = React.memo(
  ({ studentId, fullName, email, avatarUrl, size = 40, className = '' }) => {
    const resolvedName = useMemo(
      () => resolveStudentDisplayName({ fullName: fullName || '', email: email || '' }),
      [fullName, email]
    );
    const initials = useMemo(
      () => getStudentInitials(resolvedName, email),
      [resolvedName, email]
    );
    const normalizedUrl = useMemo(() => normalizeStudentAvatarUrl(avatarUrl), [avatarUrl]);
    const cacheKey = `${studentId ?? 'anon'}::${normalizedUrl ?? ''}`;

    const [failedKey, setFailedKey] = useState<string | null>(null);
    const [loadedKey, setLoadedKey] = useState<string | null>(null);

    const showImage = Boolean(normalizedUrl && failedKey !== cacheKey);
    const isLoaded = loadedKey === cacheKey;
    const fontSize = Math.max(10, Math.round(size * 0.4));

    return (
      <div
        className={`tnpsc-student-avatar ${showImage && isLoaded ? 'has-photo' : ''} ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          minHeight: `${size}px`,
          fontSize: `${fontSize}px`,
        }}
        title={email ? `${resolvedName} (${email})` : resolvedName}
      >
        <span className="tnpsc-student-avatar-initials" aria-hidden={showImage && isLoaded}>
          {initials}
        </span>

        {showImage && normalizedUrl && (
          <img
            key={cacheKey}
            src={normalizedUrl}
            alt={resolvedName}
            width={size}
            height={size}
            className={`tnpsc-student-avatar-img ${isLoaded ? 'loaded' : 'loading'}`}
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
            onLoad={() => setLoadedKey(cacheKey)}
            onError={() => setFailedKey(cacheKey)}
          />
        )}
      </div>
    );
  }
);

StudentAvatar.displayName = 'StudentAvatar';
export default StudentAvatar;
