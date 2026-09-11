import {
  cleanLongText,
  cleanShortText,
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  requestParam,
  requireAccount,
  requireSameOrigin,
  validId,
  type PagesContext,
} from "../../../_lib/z0studio-server";
import {
  normalizeRoomCustomization,
  roomCustomizationFromDatabaseRow,
  roomCustomizationToDatabaseValues,
  type RoomCustomizationDatabaseRow,
} from "../../../../src/lib/z0studio-room-customization";

type Room = { owner_id: string } & RoomCustomizationDatabaseRow;

export async function onRequestPatch(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    const roomId = requestParam(context, "roomId");
    if (!validId(roomId)) return json({ error: "ROOM_INVALID" }, { status: 400 });
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    const room = await db.prepare("SELECT owner_id, accent_color, cover_style, welcome_note, posting_cadence, room_rules FROM rooms WHERE id = ?").bind(roomId).first<Room>();
    if (!room) return json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
    if (room.owner_id !== account.id) return json({ error: "CREATOR_ROOM_REQUIRED" }, { status: 403 });
    const body = await parseJsonObject(context.request);
    const name = cleanShortText(body.name, "ROOM_NAME_INVALID", 48);
    const focus = cleanLongText(body.focus, "ROOM_FOCUS_INVALID", 240);
    const entryLabel = cleanShortText(body.entryLabel ?? "Request to join", "ROOM_ENTRY_INVALID", 32);
    const status = body.status === "draft" || body.status === "published" || body.status === "archived" ? body.status : "published";
    const customization = normalizeRoomCustomization((body.customization ?? {}) as Record<string, unknown>, roomCustomizationFromDatabaseRow(room));
    const customizationValues = roomCustomizationToDatabaseValues(customization);
    await db.prepare("UPDATE rooms SET name = ?, focus = ?, entry_label = ?, status = ?, accent_color = ?, cover_style = ?, welcome_note = ?, posting_cadence = ?, room_rules = ?, updated_at = ? WHERE id = ?")
      .bind(
        name,
        focus,
        entryLabel,
        status,
        customizationValues.accent_color,
        customizationValues.cover_style,
        customizationValues.welcome_note,
        customizationValues.posting_cadence,
        customizationValues.room_rules,
        Date.now(),
        roomId,
      ).run();
    return json({ room: { id: roomId, name, focus, entryLabel, status, customization } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "PATCH") return onRequestPatch(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "PATCH" } });
}
