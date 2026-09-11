export const roomAccentColors = ["cyan", "magenta", "silver", "violet"] as const;
export const roomCoverStyles = ["outline", "grid", "spotlight"] as const;

export type RoomAccentColor = typeof roomAccentColors[number];
export type RoomCoverStyle = typeof roomCoverStyles[number];

export type RoomCustomization = {
  accentColor: RoomAccentColor;
  coverStyle: RoomCoverStyle;
  welcomeNote: string;
  postingCadence: string;
  roomRules: string;
};

export type RoomCustomizationInput = {
  accentColor?: unknown;
  coverStyle?: unknown;
  welcomeNote?: unknown;
  postingCadence?: unknown;
  roomRules?: unknown;
};

export type RoomCustomizationDatabaseRow = {
  accent_color?: string | null;
  cover_style?: string | null;
  welcome_note?: string | null;
  posting_cadence?: string | null;
  room_rules?: string | null;
};

export const defaultRoomCustomization: RoomCustomization = {
  accentColor: "cyan",
  coverStyle: "outline",
  welcomeNote: "Start here for updates, drops, and room conversations.",
  postingCadence: "Weekly room posts and drop updates",
  roomRules: "Keep it respectful, on-topic, and creator-led.",
};

export type RoomSetupInput = {
  name: string;
  focus: string;
  entryLabel: string;
  status: "draft" | "published" | "archived";
  customization: RoomCustomization;
};

export type RoomSetupStep = {
  id: "name" | "focus" | "style" | "welcome" | "cadence" | "rules" | "entry" | "publish";
  label: string;
  action: string;
  completed: boolean;
};

export type RoomSetupChecklist = {
  steps: readonly RoomSetupStep[];
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  ready: boolean;
  nextAction: string;
};

const sensitiveRoomMaterial = /\b(private[\s_-]*key|seed[\s_-]*phrase|viewing[\s_-]*key|witness|memo[\s_-]*plaintext|private[\s_-]*balance)\b/i;

function normalizedChoice<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number], code: string): T[number] {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  if (!allowed.includes(normalized)) throw new Error(code);
  return normalized;
}

function normalizedRoomText(value: unknown, fallback: string, maximum: number, code: string): string {
  const normalized = String(value ?? fallback).trim().replace(/\s+/g, " ");
  if (normalized.length > maximum) throw new Error(code);
  if (sensitiveRoomMaterial.test(normalized)) throw new Error(code);
  return normalized || fallback;
}

export function normalizeRoomCustomization(
  input: RoomCustomizationInput,
  fallback: RoomCustomization = defaultRoomCustomization,
): RoomCustomization {
  return {
    accentColor: normalizedChoice(input.accentColor, roomAccentColors, fallback.accentColor, "ROOM_ACCENT_INVALID"),
    coverStyle: normalizedChoice(input.coverStyle, roomCoverStyles, fallback.coverStyle, "ROOM_COVER_INVALID"),
    welcomeNote: normalizedRoomText(input.welcomeNote, fallback.welcomeNote, 180, "ROOM_WELCOME_INVALID"),
    postingCadence: normalizedRoomText(input.postingCadence, fallback.postingCadence, 80, "ROOM_CADENCE_INVALID"),
    roomRules: normalizedRoomText(input.roomRules, fallback.roomRules, 240, "ROOM_RULES_INVALID"),
  };
}

export function roomCustomizationFromDatabaseRow(row: RoomCustomizationDatabaseRow): RoomCustomization {
  return normalizeRoomCustomization({
    accentColor: row.accent_color,
    coverStyle: row.cover_style,
    welcomeNote: row.welcome_note,
    postingCadence: row.posting_cadence,
    roomRules: row.room_rules,
  });
}

export function roomCustomizationToDatabaseValues(customization: RoomCustomization) {
  return {
    accent_color: customization.accentColor,
    cover_style: customization.coverStyle,
    welcome_note: customization.welcomeNote,
    posting_cadence: customization.postingCadence,
    room_rules: customization.roomRules,
  };
}

function hasPersonalText(value: string, fallback: string, minimum: number): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= minimum && normalized !== fallback;
}

export function buildRoomSetupChecklist(room: RoomSetupInput): RoomSetupChecklist {
  const customization = normalizeRoomCustomization(room.customization);
  const steps: RoomSetupStep[] = [
    {
      id: "name",
      label: "Room name",
      action: "Name the room",
      completed: room.name.trim().length >= 2,
    },
    {
      id: "focus",
      label: "Clear focus",
      action: "Describe the room",
      completed: room.focus.trim().replace(/\s+/g, " ").length >= 24,
    },
    {
      id: "style",
      label: "Room look",
      action: "Choose a look",
      completed: customization.accentColor !== defaultRoomCustomization.accentColor
        || customization.coverStyle !== defaultRoomCustomization.coverStyle,
    },
    {
      id: "welcome",
      label: "Welcome note",
      action: "Write a welcome note",
      completed: hasPersonalText(customization.welcomeNote, defaultRoomCustomization.welcomeNote, 12),
    },
    {
      id: "cadence",
      label: "Posting rhythm",
      action: "Set a posting rhythm",
      completed: hasPersonalText(customization.postingCadence, defaultRoomCustomization.postingCadence, 5),
    },
    {
      id: "rules",
      label: "Room rules",
      action: "Add room rules",
      completed: hasPersonalText(customization.roomRules, defaultRoomCustomization.roomRules, 12),
    },
    {
      id: "entry",
      label: "Join button",
      action: "Review the join button",
      completed: room.entryLabel.trim().length >= 4,
    },
    {
      id: "publish",
      label: "Published",
      action: "Publish the room",
      completed: room.status === "published",
    },
  ];
  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const ready = completedCount === totalCount;
  return {
    steps,
    completedCount,
    totalCount,
    completionPercent: Math.round((completedCount / totalCount) * 100),
    ready,
    nextAction: steps.find((step) => !step.completed)?.action ?? "Share the room",
  };
}
