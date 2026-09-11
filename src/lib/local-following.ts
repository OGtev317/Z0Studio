export const LOCAL_FOLLOWING_STORAGE_KEY = "z0studio.following.v1";

export function parseLocalFollowing(value: string | null): readonly string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const following: string[] = [];
    for (const candidate of parsed) {
      if (typeof candidate !== "string" || !isCreatorHandle(candidate) || following.includes(candidate)) continue;
      following.push(candidate);
      if (following.length === 100) break;
    }
    return following;
  } catch {
    return [];
  }
}

export function toggleLocalFollowing(current: readonly string[], handle: string): readonly string[] {
  if (!isCreatorHandle(handle)) throw new Error("LOCAL_FOLLOW_HANDLE_INVALID");
  const normalized = parseLocalFollowing(JSON.stringify(current));
  return normalized.includes(handle)
    ? normalized.filter((candidate) => candidate !== handle)
    : [...normalized, handle];
}

function isCreatorHandle(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(value);
}
