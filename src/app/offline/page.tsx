import Image from "next/image";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <div className="offline-card">
        <Image src="/brand/app-icon.svg" width={72} height={72} alt="ClientLoop" priority />
        <p className="eyebrow">You are offline</p>
        <h1>Your work is still safe.</h1>
        <p>
          Reconnect to view client files or submit a decision. ClientLoop never reports an
          approval as complete until the server has saved it.
        </p>
        <a className="primary-link" href="/">
          Try again
        </a>
      </div>
    </main>
  );
}
