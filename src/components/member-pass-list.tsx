"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMemberPassStateDetails, type MemberPassState } from "../lib/z0studio-pass-state";

type Pass = {
  room_id: string;
  name: string;
  focus: string;
  state: MemberPassState;
  requested_at: number;
  decided_at: number | null;
  updated_at: number;
};

function historyDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "recently";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

export function MemberPassList() {
  const [passes, setPasses] = useState<Pass[] | null>(null);

  useEffect(() => {
    void fetch("/api/passes", { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<{ passes: Pass[] }> : null)
      .then((result) => setPasses(result?.passes ?? []))
      .catch(() => setPasses([]));
    const listener = () => {
      void fetch("/api/passes", { credentials: "same-origin" })
        .then(async (response) => response.ok ? response.json() as Promise<{ passes: Pass[] }> : { passes: [] })
        .then((result) => setPasses(result.passes))
        .catch(() => setPasses([]));
    };
    window.addEventListener("z0studio:account-changed", listener);
    return () => window.removeEventListener("z0studio:account-changed", listener);
  }, []);

  if (passes === null) return <p className="passes-empty">Loading your passes...</p>;
  if (passes.length === 0) return <p className="passes-empty">Join a room to keep your access history here. <Link href="/rooms">Browse rooms</Link></p>;
  return <section className="receipt-ledger" aria-label="Your room access history">{passes.map((pass) => {
    const details = getMemberPassStateDetails(pass.state);
    const activity = pass.decided_at ?? pass.requested_at;
    return <article className={`ledger-row ledger-row--${pass.state}`} key={pass.room_id}>
      <span>{details.badge}</span>
      <div>
        <h2>{pass.name}</h2>
        <p>{pass.focus}</p>
        <small>{details.label}</small>
        <p className="pass-history-explanation">{details.explanation}</p>
        <p className="pass-history-date">{pass.decided_at ? "Updated" : "Requested"} {historyDate(activity)}</p>
        <Link href={`/rooms#${pass.room_id}`}>{details.actionLabel}</Link>
      </div>
    </article>;
  })}</section>;
}
