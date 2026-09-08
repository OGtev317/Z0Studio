"use client";

import { useRef, useState } from "react";
import { createLocalWorkspaceBackup, decodeMarketplace, parseLocalWorkspaceBackup } from "../lib/local-workspace-backup";
import type { Subscription } from "../lib/subscription";

const MARKETPLACE_KEY = "zeerostream.marketplace.v1";
const SUBSCRIPTIONS_KEY = "zeerostream.subscription-plans.v1";

function subscriptionsFromStorage(value: string | null): Subscription[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed as Subscription[] : []; } catch { return []; }
}

export function LocalDataTools() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("Export contains only browser-local product records. Never place wallet keys, seed phrases, viewing keys, private witnesses, or delivery evidence in it.");
  function exportBackup() {
    try {
      const marketplace = decodeMarketplace(JSON.parse(localStorage.getItem(MARKETPLACE_KEY) ?? "{}"));
      const backup = createLocalWorkspaceBackup(marketplace, subscriptionsFromStorage(localStorage.getItem(SUBSCRIPTIONS_KEY)));
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "zeerostream-local-workspace-v1.json"; anchor.click(); URL.revokeObjectURL(url);
      setNotice("Local backup downloaded. It is not a payment receipt, public listing export, or wallet backup.");
    } catch { setNotice("No valid local workspace exists to export yet."); }
  }
  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      const restored = parseLocalWorkspaceBackup(await file.text());
      localStorage.setItem(MARKETPLACE_KEY, JSON.stringify(createLocalWorkspaceBackup(restored.marketplace, []).marketplace));
      localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(restored.subscriptions));
      setNotice("Validated local backup imported. Reloading this browser workspace…");
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) { setNotice(error instanceof Error ? error.message : "LOCAL_BACKUP_IMPORT_FAILED"); }
  }
  function resetWorkspace() {
    if (!window.confirm("Delete only this browser's Z local marketplace and subscription records? This cannot be recovered unless you exported a backup.")) return;
    localStorage.removeItem(MARKETPLACE_KEY); localStorage.removeItem(SUBSCRIPTIONS_KEY);
    window.location.reload();
  }
  return <section className="local-data-tools" aria-labelledby="local-data-title">
    <div><p className="eyebrow">Local data controls</p><h2 id="local-data-title">Portable, not public.</h2><p>Move validated sample records between browsers with an explicit JSON file. Import replaces only this browser’s Z product records.</p></div>
    <div className="order-actions"><button onClick={exportBackup}>Export local records</button><button className="secondary" onClick={() => inputRef.current?.click()}>Import local records</button><button className="secondary" onClick={resetWorkspace}>Reset this browser</button><input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event.target.files?.[0])} hidden /></div>
    <p className="notice" role="status">{notice}</p>
  </section>;
}
