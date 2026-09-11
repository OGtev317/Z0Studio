"use client";

import { useEffect, useState } from "react";

type Account = {
  displayName: string;
  handle: string;
  role: "member" | "creator";
};

type Mode = "register" | "login";

function requestError(value: unknown): string {
  const error = value as { error?: string };
  if (error.error === "ACCOUNT_ALREADY_EXISTS") return "That email or handle is already in use.";
  if (error.error === "INVALID_CREDENTIALS") return "Email or password is not correct.";
  if (error.error === "PASSWORD_INVALID") return "Use a password with at least 12 characters.";
  if (error.error === "HANDLE_INVALID") return "Use 3-24 lowercase letters, numbers, or hyphens for your handle.";
  if (error.error === "EMAIL_INVALID") return "Enter a valid email address.";
  return "We could not complete that right now.";
}

export function AccountControl() {
  const [account, setAccount] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("register");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<{ account: Account | null }> : { account: null })
      .then((result) => setAccount(result.account))
      .catch(() => setAccount(null));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const payload = mode === "register"
      ? { displayName: form.get("displayName"), handle: form.get("handle"), email: form.get("email"), password: form.get("password"), role: form.get("role") === "creator" ? "creator" : "member" }
      : { email: form.get("email"), password: form.get("password") };
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { account?: Account; error?: string };
      if (!response.ok || !result.account) {
        setNotice(requestError(result));
        return;
      }
      setAccount(result.account);
      setOpen(false);
      event.currentTarget.reset();
      window.dispatchEvent(new Event("z0studio:account-changed"));
    } catch {
      setNotice("The account service is unavailable. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      setAccount(null);
      window.dispatchEvent(new Event("z0studio:account-changed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-control">
      {account ? <>
        <span className="account-name">@{account.handle}</span>
        <button className="secondary account-signout" type="button" onClick={() => void signOut()} disabled={busy}>Sign out</button>
      </> : <button className="secondary" type="button" onClick={() => { setOpen(true); setNotice(""); }}>Join Z0Studio</button>}
      {open ? (
        <div className="account-dialog-backdrop" role="presentation" onMouseDown={() => !busy && setOpen(false)}>
          <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="account-dialog-head">
              <div>
                <p className="eyebrow">Z0Studio account</p>
                <h2 id="account-dialog-title">{mode === "register" ? "Make your space yours." : "Welcome back."}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close account dialog" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="account-mode" role="tablist" aria-label="Account action">
              <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => { setMode("register"); setNotice(""); }}>Create account</button>
              <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setNotice(""); }}>Sign in</button>
            </div>
            <form className="account-form" onSubmit={(event) => void submit(event)}>
              {mode === "register" ? <>
                <label>Display name<input name="displayName" autoComplete="name" required maxLength={64} /></label>
                <label>Handle<input name="handle" autoComplete="username" required maxLength={24} pattern="[a-z0-9][a-z0-9-]{2,23}" /></label>
              </> : null}
              <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
              <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={12} maxLength={128} /></label>
              {mode === "register" ? <label className="account-role"><input name="role" type="checkbox" value="creator" /> I create work for a community</label> : null}
              <button type="submit" disabled={busy}>{busy ? "Working..." : mode === "register" ? "Create account" : "Sign in"}</button>
              {notice ? <p className="account-notice" role="status">{notice}</p> : null}
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
