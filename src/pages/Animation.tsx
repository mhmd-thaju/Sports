import { useEffect, useState } from "react";

export default function Animation() {
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setFinished(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="animation-page" aria-live="polite">
      <div className="animation-card">
        {finished ? (
          <>
            <div className="animation-check" aria-hidden="true">✓</div>
            <p className="eyebrow">You’re all set</p>
            <h1>Ready when you are.</h1>
            <a className="animation-home" href="/">Go to Sports Meet</a>
          </>
        ) : (
          <>
            <div className="animation-spinner" aria-hidden="true" />
            <p className="eyebrow">DCAS Sports Meet</p>
            <h1>Getting things ready.</h1>
            <p className="animation-copy">Please wait while we connect to live event data.</p>
            <div className="animation-track" aria-hidden="true"><span /></div>
          </>
        )}
      </div>
    </main>
  );
}
