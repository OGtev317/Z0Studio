import Link from "next/link";
import {
  canEnterRoom,
  canUnlockDrop,
  demoRoomPass,
  z0StudioRooms,
} from "../lib/z0studio-rooms";

export function CreatorRoomAccessFlow() {
  const now = Date.now();

  return (
    <section className="room-access-flow" aria-labelledby="room-access-title">
      <div className="room-access-head">
        <div>
          <p className="eyebrow">Creator rooms</p>
          <h2 id="room-access-title">Each creator gets a customizable gated social room.</h2>
          <p>
            Public posts can drive discovery. Room passes unlock the creator's private feed, while individual
            drops can still require a separate purchase after room entry.
          </p>
        </div>
        <Link className="button" href="/pro#payment-lanes">Prepare access checkout</Link>
      </div>

      <div className="room-grid">
        {z0StudioRooms.map((room) => {
          const hasRoomAccess = canEnterRoom(demoRoomPass, room.id, now);
          return (
            <article className="room-card" key={room.id}>
              <div className="room-cover" aria-hidden="true" />
              <div className="room-card-body">
                <p className="eyebrow">{room.theme}</p>
                <h3>{room.creator}</h3>
                <small>@{room.handle} · {room.members} members · {room.entryPrice}</small>
                <div className={hasRoomAccess ? "room-feed unlocked" : "room-feed locked"}>
                  <b>{room.feedTitle}</b>
                  <p>{hasRoomAccess ? room.feedBody : "Locked room feed. A valid room pass is required before posts and replies are visible."}</p>
                </div>
                <div className="drop-list">
                  {room.lockedDrops.map((drop) => {
                    const unlocked = canUnlockDrop(demoRoomPass, room.id, drop, now);
                    return (
                      <div className={unlocked ? "drop unlocked" : "drop locked"} key={drop.id}>
                        <span>{unlocked ? "Unlocked" : "Locked"}</span>
                        <b>{drop.title}</b>
                        <small>{drop.price}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="room-boundary">
        Demo pass: subscriber-8f2 can enter Zero Studio and unlock one paid drop. This is local policy evidence,
        not a live payment, wallet signature, or protected content service.
      </p>
    </section>
  );
}
