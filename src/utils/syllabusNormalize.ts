/**
 * Safely normalizes matched_topics returned from PostgreSQL JSONB / APIs / legacy strings
 * into a clean deduplicated string[] without ever throwing on arrays, null, undefined, or objects.
 */
export function normalizeMatchedTopics(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      let str = '';
      if (typeof item === 'string') {
        str = item;
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj.topic_name === 'string') str = obj.topic_name;
        else if (typeof obj.title === 'string') str = obj.title;
        else if (typeof obj.name === 'string') str = obj.name;
      }
      if (!str) continue;
      for (const part of str.split(/[,;]/)) {
        const trimmed = part.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          out.push(trimmed);
        }
      }
    }
    return out;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeMatchedTopics(parsed);
        }
      } catch {
        // Fall through to comma/semicolon split
      }
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const part of trimmed.split(/[,;]/)) {
      const item = part.trim();
      if (item && !seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        out.push(item);
      }
    }
    return out;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.topics)) {
      return normalizeMatchedTopics(obj.topics);
    }
    if (typeof obj.topic_name === 'string') {
      return normalizeMatchedTopics(obj.topic_name);
    }
  }

  return [];
}
