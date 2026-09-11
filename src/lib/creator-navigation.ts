import { creatorProfiles } from "./social-content";

export function creatorProfileHref(handle: string): string {
  return creatorProfiles.some((profile) => profile.handle === handle)
    ? `/profiles#${handle}`
    : "/profiles";
}
