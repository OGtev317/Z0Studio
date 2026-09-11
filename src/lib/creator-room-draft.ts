import type { CreatorRoomTemplate, RoomTemplateId } from "./z0studio-rooms";

export type CreatorRoomDraftPreview = {
  templateId: RoomTemplateId;
  templateName: string;
  roomName: string;
  communityFocus: string;
  accessTier: string;
  entryPrice: string;
};

export function createCreatorRoomDraftPreview(input: {
  template: CreatorRoomTemplate;
  roomName: string;
  communityFocus: string;
}): CreatorRoomDraftPreview {
  return {
    templateId: input.template.id,
    templateName: input.template.name,
    roomName: normalizeRoomName(input.roomName),
    communityFocus: normalizeCommunityFocus(input.communityFocus),
    accessTier: input.template.defaultAccessTier,
    entryPrice: input.template.defaultEntryPrice,
  };
}

function normalizeRoomName(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 2 || normalized.length > 48) throw new Error("ROOM_DRAFT_NAME_INVALID");
  assertNoSensitiveMaterial(normalized);
  return normalized;
}

function normalizeCommunityFocus(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 2 || normalized.length > 120) throw new Error("ROOM_DRAFT_FOCUS_INVALID");
  assertNoSensitiveMaterial(normalized);
  return normalized;
}

function assertNoSensitiveMaterial(value: string): void {
  if (/(private(?:[\s_-])?key|seed phrase|mnemonic|viewing(?:[\s_-])?key|witness|note secret|secret)/i.test(value)) {
    throw new Error("ROOM_DRAFT_SENSITIVE_MATERIAL_REJECTED");
  }
}
