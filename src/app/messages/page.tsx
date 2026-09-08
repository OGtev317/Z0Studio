import Link from "next/link";
import { EncryptedMessaging } from "../../components/encrypted-messaging";
import { SocialAppShell } from "../../components/social-app-shell";
import { encryptedMessages } from "../../lib/social-content";

export default function MessagesPage() {
  return (
    <SocialAppShell active="messages" kicker="Encrypted messages" title="Paid replies can carry encrypted notes without exposing the note publicly.">
      <EncryptedMessaging />
      <section className="message-inbox" aria-label="Encrypted message inbox">
        <div className="message-toolbar">
          <h2>Example creator inbox</h2>
          <Link className="button" href="/#pay">Attach note to payment</Link>
        </div>
        {encryptedMessages.map((message) => (
          <article className="message-row" key={`${message.from}:${message.subject}`}>
            <div className="message-avatar" aria-hidden="true">{message.from.slice(-3).toUpperCase()}</div>
            <div>
              <header>
                <b>{message.subject}</b>
                <span>{message.status}</span>
              </header>
              <p>{message.from} to {message.to}</p>
              <small>{message.preview}</small>
              <code>{message.receipt}</code>
            </div>
          </article>
        ))}
      </section>
    </SocialAppShell>
  );
}
