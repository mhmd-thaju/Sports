import { useState, type ReactNode } from "react";
import { api } from "../api";

export default function PinGate({ role, children }: { role: string; children: (pin: string, name: string) => ReactNode }) {
  const [pin, setPin] = useState(sessionStorage.getItem("pin-" + role) || "");
  const [name, setName] = useState(sessionStorage.getItem("name-" + role) || "");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (pin) return <>{children(pin, name)}</>;

  const login = async () => {
    setSubmitting(true);
    setError("");
    try {
      const result = await api("/auth/verify", { role, pin: draft });
      sessionStorage.setItem("pin-" + role, draft);
      sessionStorage.setItem("name-" + role, result.name);
      setName(result.name);
      setPin(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify the PIN");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card narrow">
      <h2>{role[0].toUpperCase() + role.slice(1)} login</h2>
      <label>
        PIN
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void login()}
        />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn" onClick={() => void login()} disabled={submitting || !draft}>
        {submitting ? "Verifying…" : "Continue"}
      </button>
    </div>
  );
}
