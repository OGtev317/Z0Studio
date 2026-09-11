import Link from "next/link";
import { SocialAppShell } from "../../components/social-app-shell";
import { encryptedMessages } from "../../lib/social-content";

export default function MessagesPage() {
  return (
    <SocialAppShell active="messages" kicker="Messages" title="Stay close to the creators and communities you follow.">
      <section className="message-inbox" aria-label="Creator inbox">
        <div className="message-toolbar">
          <h2>Creator inbox</h2>
          <Link className="button" href="/profiles">Find creators</Link>
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
            </div>
          </article>
        ))}
      </section>
    </SocialAppShell>
  );
}
